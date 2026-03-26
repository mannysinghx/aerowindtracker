/**
 * Vercel Serverless Function: /api/agents
 *
 * Runs all 4 AeroGuard agents on-demand:
 *   WindAgent     — wind shear, mountain wave, extreme winds
 *   HazardAgent   — IFR clusters, icing, fog, PIREP clusters
 *   TrendAgent    — compares cycles via Vercel KV (degrades gracefully without KV)
 *   BriefingAgent — Gemini synthesis of all findings
 *
 * Caching strategy (two layers):
 *   L1 — in-memory (warm container reuse, instant)
 *   L2 — Vercel KV (cross-container, survives cold starts, 5-min TTL)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { kv } from '@vercel/kv';
import { fetchMETARs, fetchAloft, fetchPireps } from './_wx.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MISSING_KEY');

const CACHE_TTL   = 5 * 60 * 1000; // 5 minutes
const KV_CACHE_EX = 300;            // seconds
const KV_PREV_EX  = 600;            // 10 min — long enough to survive a cold start gap

let memCache     = null;
let memCacheTime = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── WindAgent ────────────────────────────────────────────────────────────────

function runWindAgent(ground, aloft) {
  const findings = [];
  const ts = Date.now();

  // 1. Wind shear: pairs within 80 km with >15 kt speed diff or >45° direction diff
  let shearFound = 0;
  outer: for (let i = 0; i < ground.length; i++) {
    for (let j = i + 1; j < ground.length; j++) {
      if (shearFound >= 6) break outer;
      const a = ground[i], b = ground[j];
      if (!a.wdir || !b.wdir || a.wspd == null || b.wspd == null) continue;
      const dist = haversineKm(a.lat, a.lon, b.lat, b.lon);
      if (dist > 80) continue;
      let dirDiff = Math.abs(a.wdir - b.wdir);
      if (dirDiff > 180) dirDiff = 360 - dirDiff;
      const spdDiff = Math.abs(a.wspd - b.wspd);
      if (dirDiff > 45 || spdDiff > 15) {
        shearFound++;
        findings.push({
          id: `WS-${a.icaoId}-${b.icaoId}-${ts}`,
          type: 'WIND_SHEAR',
          severity: (dirDiff > 90 || spdDiff > 25) ? 'HIGH' : 'MEDIUM',
          message: `Wind shear between ${a.icaoId} (${a.wspd}kt/${a.wdir}°) and ${b.icaoId} (${b.wspd}kt/${b.wdir}°) — ${Math.round(dist)}nm apart, ${Math.round(spdDiff)}kt speed diff, ${Math.round(dirDiff)}° directional shift.`,
          lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2,
          fromLat: a.lat, fromLon: a.lon, toLat: b.lat, toLon: b.lon,
        });
      }
    }
  }

  // 2. Mountain wave / jet stream: strong aloft winds
  for (const a of aloft.slice(0, 200)) {
    const lvl12 = a.levels?.['12k'];
    const lvl18 = a.levels?.['18k'];
    if ((lvl12?.windSpeed >= 60) || (lvl18?.windSpeed >= 80)) {
      const lvl = lvl18?.windSpeed >= 80 ? lvl18 : lvl12;
      const alt = lvl18?.windSpeed >= 80 ? '18,000' : '12,000';
      findings.push({
        id: `MW-${a.icaoId}-${ts}`,
        type: 'MOUNTAIN_WAVE',
        severity: 'MEDIUM',
        message: `Mountain wave / jet stream near ${a.icaoId}: ${lvl.windSpeed}kt at ${alt}ft. Severe turbulence and rotor zones possible below ridge height.`,
      });
      if (findings.filter(f => f.type === 'MOUNTAIN_WAVE').length >= 3) break;
    }
  }

  // 3. Extreme surface winds (≥40 kt)
  for (const s of ground.filter(s => s.wspd >= 40).slice(0, 4)) {
    findings.push({
      id: `EW-${s.icaoId}-${ts}`,
      type: 'EXTREME_WIND',
      severity: 'HIGH',
      message: `Extreme surface winds at ${s.icaoId}: ${s.wspd}kt${s.wgst ? ` gusting ${s.wgst}kt` : ''}. Ground operations and departures severely restricted.`,
      lat: s.lat, lon: s.lon,
    });
  }

  const status = findings.some(f => f.severity === 'HIGH') ? 'alert' : 'ok';
  return { name: 'WindAgent', role: 'Wind Pattern Analysis', status, findings: findings.slice(0, 10), runAt: new Date().toISOString() };
}

// ─── HazardAgent ──────────────────────────────────────────────────────────────

function runHazardAgent(ground, pireps) {
  const findings = [];
  const ts = Date.now();

  // 1. IFR cluster
  const ifrStations = ground.filter(s => s.visib != null && s.visib < 3);
  if (ifrStations.length >= 3) {
    let bestCluster = null;
    for (const center of ifrStations) {
      const nearby = ifrStations.filter(s => haversineKm(center.lat, center.lon, s.lat, s.lon) < 300);
      if (!bestCluster || nearby.length > bestCluster.count)
        bestCluster = { center, count: nearby.length };
    }
    if (bestCluster?.count >= 3) {
      findings.push({
        id: `IFR-${bestCluster.center.icaoId}-${ts}`,
        type: 'IFR_CLUSTER',
        severity: bestCluster.count >= 8 ? 'HIGH' : 'MEDIUM',
        message: `IFR cluster: ${bestCluster.count} airports reporting visibility below 3SM within 300nm of ${bestCluster.center.icaoId}. VFR flight not recommended in this region.`,
        lat: bestCluster.center.lat, lon: bestCluster.center.lon,
      });
    }
  }

  // 2. Structural icing risk
  const icingStations = ground.filter(s =>
    s.temp != null && s.dewp != null && s.temp >= -10 && s.temp <= 2 && (s.temp - s.dewp) < 4
  );
  if (icingStations.length >= 3) {
    const grid = {};
    for (const s of icingStations) {
      const key = `${Math.round(s.lat / 3) * 3},${Math.round(s.lon / 3) * 3}`;
      (grid[key] = grid[key] || []).push(s);
    }
    const densest = Object.values(grid).sort((a, b) => b.length - a.length)[0];
    if (densest?.length >= 2) {
      const rep = densest[0];
      findings.push({
        id: `ICING-${rep.icaoId}-${ts}`,
        type: 'ICING_RISK',
        severity: 'MEDIUM',
        message: `Structural icing risk: ${icingStations.length} stations with near-freezing temps (around ${rep.temp}°C) and moisture. Icing probable in IMC below 10,000ft.`,
        lat: rep.lat, lon: rep.lon,
      });
    }
  }

  // 3. PIREP cluster analysis
  if (Array.isArray(pireps) && pireps.length > 0) {
    const turbPireps = pireps.filter(p => p.type === 'TURBULENCE');
    const icePireps  = pireps.filter(p => p.type === 'ICING');
    if (turbPireps.length >= 3) {
      const sevCount = turbPireps.filter(p => p.severity === 'SEVERE').length;
      findings.push({
        id: `TURB-PIREPS-${ts}`,
        type: 'TURBULENCE_CLUSTER',
        severity: sevCount > 0 ? 'HIGH' : 'MEDIUM',
        message: `${turbPireps.length} turbulence PIREPs active${sevCount > 0 ? ` — ${sevCount} SEVERE` : ''}. Altitudes: ${[...new Set(turbPireps.map(p => p.altitude).filter(Boolean))].slice(0, 4).join(', ')}.`,
      });
    }
    if (icePireps.length >= 2) {
      findings.push({
        id: `ICE-PIREPS-${ts}`,
        type: 'ICING_PIREPS',
        severity: 'MEDIUM',
        message: `${icePireps.length} icing PIREPs reported. Verify altitude-specific icing forecasts before entering IMC.`,
      });
    }
  }

  // 4. Widespread fog potential
  const fogRisk = ground.filter(s =>
    s.temp != null && s.dewp != null &&
    (s.temp - s.dewp) <= 3 && (s.temp - s.dewp) >= 0 && s.wspd < 8
  );
  if (fogRisk.length >= 6) {
    findings.push({
      id: `FOG-REGIONAL-${ts}`,
      type: 'FOG_RISK',
      severity: 'MEDIUM',
      message: `Widespread fog potential: ${fogRisk.length} stations with near-zero temp/dew spread and calm winds. Radiation fog likely overnight and into morning hours.`,
    });
  }

  const status = findings.some(f => f.severity === 'HIGH') ? 'alert' : 'ok';
  return { name: 'HazardAgent', role: 'Hazard Detection', status, findings: findings.slice(0, 8), runAt: new Date().toISOString() };
}

// ─── TrendAgent ───────────────────────────────────────────────────────────────
// Compares current vs previous data cycle (stored in KV) to detect rapid changes.

function runTrendAgent(current, previous) {
  if (!previous || previous.length === 0) {
    return {
      name: 'TrendAgent', role: 'Condition Trends', status: 'idle',
      findings: [{ id: 'TREND-INIT', type: 'INFO', severity: 'INFO', message: 'Baseline established. Trend analysis begins next cycle (5 min).' }],
      runAt: new Date().toISOString()
    };
  }

  const findings = [];
  const ts = Date.now();
  const prevMap = Object.fromEntries(previous.map(s => [s.icaoId, s]));

  const rapidWindChanges = [];
  const ifrDegrading     = [];
  const pressureDrops    = [];

  for (const curr of current) {
    const prev = prevMap[curr.icaoId];
    if (!prev) continue;

    // Rapid wind speed change (≥12 kt in one 5-min cycle)
    if (curr.wspd != null && prev.wspd != null) {
      const delta = curr.wspd - prev.wspd;
      if (Math.abs(delta) >= 12) rapidWindChanges.push({ station: curr, delta });
    }

    // Visibility suddenly dropping to IFR (was ≥5, now <3)
    if (curr.visib != null && prev.visib != null && prev.visib >= 5 && curr.visib < 3) {
      ifrDegrading.push(curr);
    }

    // Pressure drop (altimeter falling ≥0.04 inHg)
    if (curr.altim != null && prev.altim != null) {
      const drop = prev.altim - curr.altim;
      if (drop >= 0.04) pressureDrops.push({ station: curr, drop });
    }
  }

  if (rapidWindChanges.length > 0) {
    rapidWindChanges.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const top = rapidWindChanges[0];
    findings.push({
      id: `TREND-WIND-${top.station.icaoId}-${ts}`,
      type: 'RAPID_WIND_CHANGE',
      severity: Math.abs(top.delta) >= 20 ? 'HIGH' : 'MEDIUM',
      message: `Rapid wind change at ${top.station.icaoId}: ${top.delta > 0 ? '+' : ''}${top.delta}kt in 5 minutes (now ${top.station.wspd}kt).${rapidWindChanges.length > 1 ? ` ${rapidWindChanges.length - 1} additional station(s) also changing rapidly.` : ''}`,
      lat: top.station.lat, lon: top.station.lon,
    });
  }

  if (ifrDegrading.length > 0) {
    findings.push({
      id: `TREND-VIS-${ts}`,
      type: 'IFR_TREND',
      severity: 'MEDIUM',
      message: `${ifrDegrading.length} station(s) rapidly degrading to IFR: ${ifrDegrading.slice(0, 3).map(s => s.icaoId).join(', ')}. Active weather deterioration in progress.`,
    });
  }

  if (pressureDrops.length >= 4) {
    pressureDrops.sort((a, b) => b.drop - a.drop);
    const top = pressureDrops[0];
    findings.push({
      id: `TREND-PRESSURE-${ts}`,
      type: 'PRESSURE_DROP',
      severity: 'MEDIUM',
      message: `Falling pressure trend: ${pressureDrops.length} stations showing dropping altimeter settings. Largest drop at ${top.station.icaoId} (−${top.drop.toFixed(2)} inHg). Incoming weather system likely.`,
    });
  }

  if (findings.length === 0) {
    findings.push({ id: `TREND-STABLE-${ts}`, type: 'INFO', severity: 'INFO', message: 'Conditions stable. No significant changes detected from previous 5-minute cycle.' });
  }

  const status = findings.some(f => f.severity === 'HIGH') ? 'alert' : 'ok';
  return { name: 'TrendAgent', role: 'Condition Trends', status, findings, runAt: new Date().toISOString() };
}

// ─── BriefingAgent ────────────────────────────────────────────────────────────

async function runBriefingAgent(windResult, hazardResult, trendResult) {
  const allFindings = [
    ...windResult.findings,
    ...hazardResult.findings,
    ...trendResult.findings,
  ].filter(f => f.severity !== 'INFO');

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MISSING_KEY') {
    const high = allFindings.filter(f => f.severity === 'HIGH');
    const med  = allFindings.filter(f => f.severity === 'MEDIUM');
    const briefing = high.length > 0
      ? `${high.length} high-priority condition(s) active. ${high[0].message}${med.length > 0 ? ` Additionally, ${med.length} moderate concern(s) exist.` : ''}`
      : med.length > 0
        ? `${med.length} moderate condition(s) detected. ${med[0].message}`
        : 'No significant weather hazards detected. Conditions appear favorable for VFR operations.';
    return { name: 'BriefingAgent', role: 'Situation Synthesis', status: high.length > 0 ? 'alert' : 'ok', briefing, runAt: new Date().toISOString() };
  }

  if (allFindings.length === 0) {
    return {
      name: 'BriefingAgent', role: 'Situation Synthesis', status: 'ok',
      briefing: 'No significant weather hazards detected across monitored airspace. Conditions appear favorable for VFR flight; pilots should review local METARs and TAFs before departure.',
      runAt: new Date().toISOString()
    };
  }

  const fmt = arr => arr.length > 0
    ? arr.map(f => `[${f.severity}] ${f.message}`).join('\n')
    : 'No findings.';

  const prompt = `You are AeroGuard BriefingAgent, an expert aviation meteorologist AI.

Three specialized agents completed their analysis. Produce a PILOT SITUATION BRIEFING.

WindAgent (${windResult.findings.length} findings):
${fmt(windResult.findings)}

HazardAgent (${hazardResult.findings.length} findings):
${fmt(hazardResult.findings)}

TrendAgent (${trendResult.findings.length} findings):
${fmt(trendResult.findings)}

Write a 3-4 sentence pilot briefing that:
1. Leads with the most operationally significant hazard
2. Notes any developing or trend-based threat pilots should monitor
3. Ends with a concise flight safety recommendation

Use professional aviation language. Be direct and specific. Write flowing prose only — no bullets, no headers.`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const briefing = result.response.text().trim();
    const status = allFindings.some(f => f.severity === 'HIGH') ? 'alert' : 'ok';
    return { name: 'BriefingAgent', role: 'Situation Synthesis', status, briefing, runAt: new Date().toISOString() };
  } catch (err) {
    console.error('BriefingAgent error:', err);
    return { name: 'BriefingAgent', role: 'Situation Synthesis', status: 'ok', briefing: 'Situation synthesis temporarily unavailable.', runAt: new Date().toISOString() };
  }
}

// ─── KV helpers (graceful degradation when KV not configured) ─────────────────

async function kvGet(key) {
  try { return await kv.get(key); } catch { return null; }
}

async function kvSet(key, value, ex) {
  try { await kv.set(key, value, { ex }); } catch { /* KV unavailable */ }
}

// ─── Agent orchestration ──────────────────────────────────────────────────────

async function runAgents() {
  const [ground, aloft, pirepRaw] = await Promise.all([
    fetchMETARs(),
    fetchAloft(),
    fetchPireps(),
  ]);

  // Retrieve previous ground data for TrendAgent from KV
  let prevGround = [];
  const prevRaw = await kvGet('agents:prev_ground');
  if (prevRaw) {
    try { prevGround = JSON.parse(prevRaw); } catch { /* corrupted — start fresh */ }
  }

  const windResult     = runWindAgent(ground, aloft);
  const hazardResult   = runHazardAgent(ground, pirepRaw);
  const trendResult    = runTrendAgent(ground, prevGround);
  const briefingResult = await runBriefingAgent(windResult, hazardResult, trendResult);

  // Persist compact ground snapshot for next TrendAgent cycle
  const compact = ground.map(s => ({
    icaoId: s.icaoId, wspd: s.wspd, wdir: s.wdir, wgst: s.wgst,
    visib: s.visib, temp: s.temp, dewp: s.dewp, altim: s.altim,
    lat: s.lat, lon: s.lon,
  }));
  await kvSet('agents:prev_ground', JSON.stringify(compact), KV_PREV_EX);

  return {
    agents: { wind: windResult, hazard: hazardResult, trend: trendResult, briefing: briefingResult },
    lastRun: new Date().toISOString(),
  };
}

// Exported so api/refresh.js (cron) can call it directly to pre-populate KV.
export { runAgents };

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const now = Date.now();

    // L1: in-memory cache (warm container reuse)
    if (memCache && (now - memCacheTime < CACHE_TTL)) {
      return res.status(200).json(memCache);
    }

    // L2: KV cache (survives cold starts, cross-container)
    const kvCached = await kvGet('agents:cache');
    if (kvCached) {
      try {
        const parsed = JSON.parse(kvCached);
        const age = now - new Date(parsed.lastRun).getTime();
        if (age < CACHE_TTL) {
          memCache = parsed;
          memCacheTime = now - age;
          return res.status(200).json(parsed);
        }
      } catch { /* corrupted cache — fall through */ }
    }

    // Cache miss — run all agents
    const result = await runAgents();
    memCache = result;
    memCacheTime = now;
    await kvSet('agents:cache', JSON.stringify(result), KV_CACHE_EX);

    res.status(200).json(result);
  } catch (err) {
    console.error('Agent handler error:', err);
    res.status(500).json({ error: 'Agent orchestration failed.' });
  }
}
