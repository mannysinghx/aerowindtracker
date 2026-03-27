/**
 * Vercel Serverless Function: /api/flightpath
 *
 * GET /api/flightpath?from=KSEA&to=KLAX&time=14:30
 *
 * Returns wind and precipitation prediction data along a flight route
 * at multiple altitudes (surface, 3k, 6k, 9k, 12k, 18k ft).
 */

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcBearing(lat1, lon1, lat2, lon2) {
  const toRad = x => x * Math.PI / 180;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return Math.round(((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360);
}

// Parse winds-aloft encoding: "DDSSTT" where DD=dir/10, SS=speed, TT=temp
function parseLvl(str) {
  if (!str || str.length < 4) return null;
  let dir = parseInt(str.substring(0, 2)) * 10;
  let spd = parseInt(str.substring(2, 4));
  if (isNaN(dir) || isNaN(spd)) return null;
  if (dir >= 500) { dir -= 500; spd += 100; } // 100+ kt encoding
  let t = null;
  if (str.length >= 5) {
    const rest = str.substring(4);
    const sign = rest[0];
    const digits = rest.substring(1, 3);
    if ((sign === '+' || sign === '-') && /^\d+$/.test(digits)) {
      t = parseInt(digits);
      if (sign === '-') t = -t;
    } else {
      const raw = parseInt(rest.substring(0, 2));
      if (!isNaN(raw)) t = -Math.abs(raw);
    }
  }
  return { windDir: dir, windSpeed: spd, temp: t };
}

function parsePrecip(wxStr) {
  if (!wxStr) return null;
  const s = wxStr.toUpperCase();
  if (s.includes('TS')) return { type: 'Thunderstorm', severity: 'high', icon: '⛈' };
  if (s.includes('FZRA') || s.includes('FZDZ')) return { type: 'Freezing Rain', severity: 'high', icon: '🧊' };
  if (s.includes('+SN') || s.includes('BLSN')) return { type: 'Heavy Snow', severity: 'medium', icon: '❄️' };
  if (s.includes('SN')) return { type: 'Snow', severity: 'medium', icon: '🌨' };
  if (s.includes('+RA')) return { type: 'Heavy Rain', severity: 'medium', icon: '🌧' };
  if (s.includes('-RA')) return { type: 'Light Rain', severity: 'low', icon: '🌦' };
  if (s.includes('RA')) return { type: 'Rain', severity: 'medium', icon: '🌧' };
  if (s.includes('DZ')) return { type: 'Drizzle', severity: 'low', icon: '🌦' };
  if (s.includes('FG') || s.includes('BR')) return { type: 'Fog/Mist', severity: 'medium', icon: '🌫' };
  return null;
}

function getCeiling(metar) {
  for (let i = 1; i <= 3; i++) {
    const cvg = metar[`cldCvg${i}`];
    const bas = metar[`cldBas${i}`];
    if ((cvg === 'BKN' || cvg === 'OVC') && bas != null) return bas;
  }
  return null;
}

function flightCategory(ceiling, visSM) {
  const c = ceiling ?? Infinity;
  const v = parseFloat(visSM) ?? 10;
  if (c < 500 || v < 1) return 'LIFR';
  if (c < 1000 || v < 3) return 'IFR';
  if (c < 3000 || v < 5) return 'MVFR';
  return 'VFR';
}

// ─── Altitude Recommendation Engine ──────────────────────────────────────────

// Approximate CONUS magnetic variation by longitude band
function magVariation(avgLon) {
  if (avgLon < -115) return 15;   // Pacific Northwest / Cascades: ~15°E
  if (avgLon < -105) return 12;   // Rockies / Intermountain: ~12°E
  if (avgLon < -90)  return 4;    // Great Plains: ~4°E
  if (avgLon < -75)  return -8;   // Midwest / Mid-Atlantic: ~8°W
  return -14;                      // Eastern Seaboard: ~14°W
}

// Positive = tailwind, negative = headwind
function tailwindComponent(windFromDir, windSpeed, routeBearing) {
  const angle = ((windFromDir - routeBearing + 180) + 360) % 360;
  return windSpeed * Math.cos(angle * Math.PI / 180);
}

// Map VFR candidate altitude to nearest aloft data key
function altToKey(alt) {
  if (alt <= 4500)  return '3k';
  if (alt <= 7000)  return '6k';
  if (alt <= 10500) return '9k';
  if (alt <= 15000) return '12k';
  return '18k';
}

// Detect FAA Part 95 mountainous areas the route crosses
function getMountainousRegions(waypoints) {
  const regions = new Set();
  for (const wp of waypoints) {
    const { lat, lon } = wp;
    if (lat >= 31 && lat <= 49 && lon >= -116 && lon <= -102) regions.add('Rocky Mountains');
    if (lat >= 35 && lat <= 42 && lon >= -123 && lon <= -116) regions.add('Sierra Nevada');
    if (lat >= 42 && lat <= 49 && lon >= -124 && lon <= -118) regions.add('Cascade Range');
    if (lat >= 30 && lat <= 37 && lon >= -123 && lon <= -115) regions.add('Coast Ranges (CA)');
  }
  return [...regions];
}

function computeAltitudeRecommendation(trueBearing, distanceNm, waypoints) {
  const avgLon = waypoints.reduce((s, w) => s + w.lon, 0) / waypoints.length;
  const magVar  = magVariation(avgLon);
  const magBearing = ((trueBearing + magVar) + 360) % 360;
  const eastbound  = magBearing < 180;

  // VFR cruising altitudes — FAR 91.159
  // Eastbound: odd thousands + 500 ft | Westbound: even thousands + 500 ft
  const vfrSet = eastbound
    ? [3500, 5500, 7500, 9500, 11500, 13500]
    : [4500, 6500, 8500, 10500, 12500];

  // Distance-based practical ceiling (rule: spend ≥1/3 of route in level cruise)
  let distCeil;
  if (distanceNm < 150)       distCeil = eastbound ? 5500 : 6500;
  else if (distanceNm < 300)  distCeil = eastbound ? 7500 : 8500;
  else if (distanceNm < 600)  distCeil = eastbound ? 9500 : 10500;
  else                        distCeil = eastbound ? 11500 : 12500;

  // Terrain floor from mountainous area detection
  const mountainRegions = getMountainousRegions(waypoints);
  let terrainFloor = 0;
  const terrainWarnings = [];
  if (mountainRegions.includes('Rocky Mountains')) {
    terrainFloor = Math.max(terrainFloor, 11500);
    terrainWarnings.push({ region: 'Rocky Mountains', detail: 'Peaks reach 14,440 ft (Mt. Elbert, CO). Minimum 11,500 ft MSL en route; plan 13,500 ft over highest sections. FAR 91.177 requires 2,000 ft obstacle clearance IFR.' });
  }
  if (mountainRegions.includes('Sierra Nevada')) {
    terrainFloor = Math.max(terrainFloor, 11500);
    terrainWarnings.push({ region: 'Sierra Nevada', detail: 'Peaks reach 14,505 ft (Mt. Whitney, CA). Minimum 11,500 ft en route; higher may be required over the crest. Check sectional MEFs.' });
  }
  if (mountainRegions.includes('Cascade Range')) {
    terrainFloor = Math.max(terrainFloor, 9500);
    terrainWarnings.push({ region: 'Cascade Range', detail: 'Mt. Rainier reaches 14,411 ft. Minimum 9,500 ft en route; 11,500+ ft over the crest. Cross ridgelines at 45° angle for escape options.' });
  }
  if (mountainRegions.includes('Coast Ranges (CA)')) {
    terrainFloor = Math.max(terrainFloor, 5500);
    terrainWarnings.push({ region: 'California Coast Ranges', detail: 'Peaks to ~8,000 ft. Minimum 5,500 ft MSL. Monitor for marine layer and coastal fog.' });
  }

  // Build candidate list respecting terrain floor and distance ceiling
  let candidates = vfrSet.filter(a => a >= terrainFloor && a <= 18000);
  // If terrain forces above distance ceiling, allow it — safety first
  if (candidates.length === 0) candidates = vfrSet.filter(a => a >= terrainFloor);
  // Apply distance ceiling only when terrain floor doesn't override
  const practicalCandidates = candidates.filter(a => a <= Math.max(distCeil, terrainFloor));
  if (practicalCandidates.length > 0) candidates = practicalCandidates;

  // Average tailwind component at each candidate altitude across all waypoints
  const windAt = {};
  for (const alt of vfrSet) {
    const key = altToKey(alt);
    let sum = 0, n = 0;
    for (const wp of waypoints) {
      const d = wp.aloft?.[key];
      if (d?.windDir != null && d?.windSpeed != null) {
        sum += tailwindComponent(d.windDir, d.windSpeed, trueBearing);
        n++;
      }
    }
    windAt[alt] = n > 0 ? Math.round(sum / n) : null;
  }

  // Score each candidate: wind component + small altitude bonus for long routes
  const scored = candidates.map(alt => ({
    alt,
    windComp: windAt[alt] ?? 0,
    score: (windAt[alt] ?? 0) + (distanceNm > 300 ? (alt / 1000) * 0.8 : 0),
  })).sort((a, b) => b.score - a.score);

  const best       = scored[0]?.alt ?? candidates[0];
  const bestWind   = windAt[best] ?? 0;
  const bestAltKey = altToKey(best);

  // ── Reasons ──
  const reasons = [];

  const legalAlts = vfrSet.map(a => `${(a/1000).toFixed(1)}k`).join(' / ');
  reasons.push({
    rule: 'FAR 91.159 — VFR Cruising',
    icon: '📐',
    text: `${eastbound ? 'Eastbound' : 'Westbound'} flight (${Math.round(magBearing)}° mag). Above 3,000 ft AGL, VFR aircraft must maintain ${eastbound ? 'odd thousands + 500 ft' : 'even thousands + 500 ft'}. Legal altitudes for this heading: ${legalAlts} ft MSL.`,
  });

  if (bestWind !== null && Math.abs(bestWind) > 2) {
    const betterAlt = scored.find(s => s.alt !== best && (windAt[s.alt] ?? 0) > bestWind);
    reasons.push({
      rule: 'Winds Aloft',
      icon: '💨',
      text: bestWind > 0
        ? `Average ${bestWind}-kt tailwind at ${(best/1000).toFixed(1)}k ft along this route${betterAlt ? ` (vs ${windAt[betterAlt.alt] ?? 0} kt at ${(betterAlt.alt/1000).toFixed(1)}k)` : ''}. Tailwinds reduce fuel burn and flight time.`
        : `Average ${Math.abs(bestWind)}-kt headwind at ${(best/1000).toFixed(1)}k ft. This is the best VFR-legal altitude available for this direction — consider filing IFR for ATC altitude flexibility.`,
    });
  } else {
    reasons.push({
      rule: 'Winds Aloft',
      icon: '💨',
      text: `Light wind component (${bestWind >= 0 ? '+' : ''}${bestWind} kt avg) at ${(best/1000).toFixed(1)}k ft. Winds are relatively neutral — altitude choice is not strongly wind-driven.`,
    });
  }

  const cruiseNm = Math.round(distanceNm / 3);
  if (distanceNm >= 150) {
    reasons.push({
      rule: 'Distance & Efficiency',
      icon: '📏',
      text: `${distanceNm} nm route — climb to ${(best/1000).toFixed(1)}k ft is practical. At this altitude, TAS increases ~${Math.round((best / 1000) * 2)}% vs sea level for piston aircraft. Plan ≈${cruiseNm} nm of level cruise (1/3 rule).`,
    });
  } else {
    reasons.push({
      rule: 'Distance & Efficiency',
      icon: '📏',
      text: `${distanceNm} nm is a shorter leg. Climbing too high (>${distCeil.toLocaleString()} ft) means most of the flight is spent climbing/descending with little cruise benefit.`,
    });
  }

  if (terrainFloor > 0) {
    reasons.push({
      rule: 'Terrain Clearance',
      icon: '⛰️',
      text: `FAA Part 95 mountainous area(s) on route require minimum ${terrainFloor.toLocaleString()} ft MSL for safe terrain clearance. Always add 1,000–2,000 ft above the highest MEF shown on the sectional chart.`,
    });
  }

  // ── Warnings ──
  const warnings = [];

  for (const tw of terrainWarnings) {
    warnings.push({ type: 'terrain', icon: '⛰️', severity: 'high', title: tw.region, text: tw.detail });
  }

  // IFR conditions
  const ifrWps = waypoints.filter(wp => wp.surface?.flightCategory === 'IFR' || wp.surface?.flightCategory === 'LIFR');
  if (ifrWps.length > 0) {
    warnings.push({
      type: 'ifr', icon: '🌫️', severity: 'high', title: 'IFR Conditions En Route',
      text: `IFR or LIFR conditions at ${ifrWps.length} of ${waypoints.length} waypoints (${ifrWps.map(w => w.label).join(', ')}). VFR flight may not be possible. Obtain a full weather briefing before departure.`,
    });
  }

  // Precipitation
  const precipWps = waypoints.filter(wp => wp.surface?.precip);
  if (precipWps.length > 0) {
    const types = [...new Set(precipWps.map(wp => wp.surface.precip.type))];
    const sev   = precipWps.some(wp => wp.surface.precip.severity === 'high');
    warnings.push({
      type: 'precip', icon: precipWps[0].surface.precip.icon, severity: sev ? 'high' : 'medium',
      title: 'Precipitation Along Route',
      text: `${types.join(', ')} reported at ${precipWps.length} waypoint${precipWps.length > 1 ? 's' : ''}. ${sev ? 'Thunderstorms or freezing precipitation present — avoid or obtain IFR clearance.' : 'Monitor for icing and visibility impacts.'}`,
    });
  }

  // Oxygen thresholds — FAR 91.211
  if (best > 15000) {
    warnings.push({ type: 'oxygen', icon: '🩸', severity: 'critical', title: 'Oxygen — All Occupants (FAR 91.211)',
      text: `Above 15,000 ft MSL, supplemental O₂ must be available for every passenger on board (crew use mandatory above 14,000 ft).` });
  } else if (best > 14000) {
    warnings.push({ type: 'oxygen', icon: '🩸', severity: 'critical', title: 'Crew Oxygen Required (FAR 91.211)',
      text: `Above 14,000 ft MSL, flight crew must use supplemental oxygen for the entire duration at this altitude.` });
  } else if (best > 12500) {
    warnings.push({ type: 'oxygen', icon: '🩸', severity: 'medium', title: 'Oxygen — 30-min Rule (FAR 91.211)',
      text: `Above 12,500 ft MSL, required flight crew must use supplemental oxygen if time at this altitude exceeds 30 minutes.` });
  }

  // Class A proximity
  if (best >= 16500) {
    warnings.push({ type: 'airspace', icon: '🚫', severity: 'high', title: 'Approaching Class A (FL180)',
      text: `Class A airspace begins at FL180 (18,000 ft MSL). VFR is prohibited. IFR clearance, two-way radio, Mode C transponder, and IFR flight plan required. Set altimeter to 29.92 in Hg at FL180.` });
  }

  // ── Alternatives ──
  const alternatives = scored.slice(1, 3).filter(s => s.alt !== best).map(s => ({
    alt: s.alt,
    label: `${s.alt.toLocaleString()} ft MSL`,
    windComp: windAt[s.alt] ?? 0,
    note: s.alt < best
      ? `Shorter climb, ${Math.abs((windAt[s.alt] ?? 0) - bestWind)} kt less wind advantage`
      : `Better winds (+${(windAt[s.alt] ?? 0) - bestWind} kt), higher climb cost`,
  }));

  // ── Compliance summary ──
  const complianceNotes = [
    `${eastbound ? 'Eastbound' : 'Westbound'} → ${eastbound ? 'odd' : 'even'} thousands + 500 ft (FAR 91.159)`,
    best <= 12500
      ? 'No supplemental O₂ required (FAR 91.211)'
      : best <= 14000
        ? 'O₂ req\'d after 30 min above 12,500 ft (FAR 91.211)'
        : 'Continuous crew O₂ required (FAR 91.211)',
    best < 18000 ? 'Below FL180 — Class A not entered' : 'FL180+ — IFR only, ATC clearance required',
    mountainRegions.length > 0 ? `Mountainous terrain: FAA Part 95 MEAs apply` : 'Non-mountainous route: standard 1,000 ft obstacle clearance',
  ];

  return {
    recommendedAlt: best,
    recommendedAltLabel: `${best.toLocaleString()} ft MSL`,
    altKey: bestAltKey,
    magneticBearing: Math.round(magBearing),
    magneticVariation: magVar,
    eastbound,
    reasons,
    warnings,
    alternatives,
    complianceNotes,
    windComponents: Object.fromEntries(vfrSet.map(a => [a, windAt[a]])),
    terrainRegions: mountainRegions,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const fromIcao = (req.query.from || '').toUpperCase().trim();
  const toIcao = (req.query.to || '').toUpperCase().trim();
  const time = req.query.time || '12:00';

  if (!fromIcao || !toIcao) {
    return res.status(400).json({ error: 'from and to ICAO codes are required' });
  }

  try {
    // Step 1: Fetch endpoint METARs to get coordinates
    const [fromMet, toMet] = await Promise.all([
      fetch(`https://aviationweather.gov/api/data/metar?ids=${fromIcao}&format=json`, {
        headers: { 'User-Agent': 'AeroWindTracker/1.0' }
      }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`https://aviationweather.gov/api/data/metar?ids=${toIcao}&format=json`, {
        headers: { 'User-Agent': 'AeroWindTracker/1.0' }
      }).then(r => r.ok ? r.json() : []).catch(() => []),
    ]);

    if (!fromMet[0]) {
      return res.status(404).json({ error: `No METAR data found for ${fromIcao}. Try a major airport with ICAO code.` });
    }
    if (!toMet[0]) {
      return res.status(404).json({ error: `No METAR data found for ${toIcao}. Try a major airport with ICAO code.` });
    }

    const fromLat = fromMet[0].lat;
    const fromLon = fromMet[0].lon;
    const toLat = toMet[0].lat;
    const toLon = toMet[0].lon;

    // Step 2: Calculate 6 intermediate waypoints (8 total including endpoints)
    const NUM_SEGMENTS = 6;
    const waypoints = Array.from({ length: NUM_SEGMENTS + 1 }, (_, i) => {
      const t = i / NUM_SEGMENTS;
      return {
        index: i,
        lat: fromLat + t * (toLat - fromLat),
        lon: fromLon + t * (toLon - fromLon),
        fraction: t,
        label: i === 0 ? fromIcao : i === NUM_SEGMENTS ? toIcao : `WP${i}`,
      };
    });

    const totalDistNm = Math.round(haversineKm(fromLat, fromLon, toLat, toLon) * 0.539957);
    const routeBearing = calcBearing(fromLat, fromLon, toLat, toLon);

    // Step 3: Fetch METAR data + winds-aloft data for the route bounding box
    const pad = 3;
    const minLat = Math.min(fromLat, toLat) - pad;
    const maxLat = Math.max(fromLat, toLat) + pad;
    const minLon = Math.min(fromLon, toLon) - pad;
    const maxLon = Math.max(fromLon, toLon) + pad;

    const [metarStations, aloftRaw] = await Promise.all([
      fetch(
        `https://aviationweather.gov/api/data/metar?bbox=${minLat},${minLon},${maxLat},${maxLon}&format=json`,
        { headers: { 'User-Agent': 'AeroWindTracker/1.0' } }
      ).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(
        'https://aviationweather.gov/api/data/windtemp?region=all&level=low&fcst=06&format=raw',
        { headers: { 'User-Agent': 'AeroWindTracker/1.0' } }
      ).then(r => r.ok ? r.text() : '').catch(() => ''),
    ]);

    // Parse aloft data: 3-letter station IDs → altitude levels
    const aloftMap = new Map();
    for (const line of aloftRaw.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5 && /^[A-Z]{3}$/.test(parts[0])) {
        aloftMap.set(parts[0], {
          '3k':  parseLvl(parts[1]),
          '6k':  parseLvl(parts[2]),
          '9k':  parseLvl(parts[3]),
          '12k': parseLvl(parts[4]),
          '18k': parts[5] ? parseLvl(parts[5]) : null,
        });
      }
    }

    // Build merged station list: METAR stations enriched with matching aloft data
    // The aloft 3-letter ID (e.g. "SEA") maps to K+ID METAR station (e.g. "KSEA")
    const mergedStations = metarStations
      .filter(m => m.lat != null && m.lon != null)
      .map(m => {
        const shortId = (m.icaoId || '').replace(/^K/, '');
        return { ...m, aloft: aloftMap.get(shortId) || null };
      });

    // Step 4: For each waypoint, find nearest stations
    const waypointData = waypoints.map(wp => {
      let nearestMetar = null;
      let nearestMetarDistKm = Infinity;
      let bestAloft = null;
      let bestAloftDistKm = Infinity;

      for (const st of mergedStations) {
        const d = haversineKm(wp.lat, wp.lon, st.lat, st.lon);
        if (d < nearestMetarDistKm) {
          nearestMetarDistKm = d;
          nearestMetar = st;
        }
        if (st.aloft && d < bestAloftDistKm) {
          bestAloftDistKm = d;
          bestAloft = st;
        }
      }

      const ceiling = nearestMetar ? getCeiling(nearestMetar) : null;
      const visSM = nearestMetar?.visib ?? 10;
      const wxStr = nearestMetar?.wxString || nearestMetar?.wxstring || '';

      return {
        ...wp,
        distFromDep: Math.round(totalDistNm * wp.fraction),
        nearestStation: nearestMetar?.icaoId || null,
        nearestStationDistNm: Math.round(nearestMetarDistKm * 0.539957),
        surface: nearestMetar ? {
          windDir: nearestMetar.wdir ?? null,
          windSpeed: nearestMetar.wspd ?? null,
          windGust: nearestMetar.wgst ?? null,
          temp: nearestMetar.temp ?? null,
          dewpoint: nearestMetar.dewp ?? null,
          visibility: visSM,
          ceiling,
          wxString: wxStr,
          precip: parsePrecip(wxStr),
          flightCategory: flightCategory(ceiling, visSM),
        } : null,
        aloft: bestAloft?.aloft || null,
      };
    });

    const altitudeRecommendation = computeAltitudeRecommendation(routeBearing, totalDistNm, waypointData);

    return res.status(200).json({
      from: { icao: fromIcao, lat: fromLat, lon: fromLon },
      to: { icao: toIcao, lat: toLat, lon: toLon },
      route: { distanceNm: totalDistNm, bearing: routeBearing },
      departureTime: time,
      waypoints: waypointData,
      altitudeRecommendation,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[flightpath] error:', e);
    return res.status(500).json({ error: e.message });
  }
}
