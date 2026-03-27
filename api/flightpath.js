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

    return res.status(200).json({
      from: { icao: fromIcao, lat: fromLat, lon: fromLon },
      to: { icao: toIcao, lat: toLat, lon: toLon },
      route: { distanceNm: totalDistNm, bearing: routeBearing },
      departureTime: time,
      waypoints: waypointData,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[flightpath] error:', e);
    return res.status(500).json({ error: e.message });
  }
}
