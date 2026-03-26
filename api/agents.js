/**
 * Vercel Serverless Function: /api/agents
 *
 * Runs all 4 AeroGuard agents on-demand:
 *   WindAgent     — wind shear, mountain wave, extreme winds
 *   HazardAgent   — IFR clusters, icing, fog, PIREP clusters
 *   TrendAgent    — compares cycles (stateless: reports baseline on cold start)
 *   BriefingAgent — Gemini synthesis of all findings
 *
 * Caches result for 5 minutes across warm container reuse.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MISSING_KEY');

let cachedResult = null;
let cacheTime    = 0;
const CACHE_TTL  = 5 * 60 * 1000; // 5 minutes

const BBOXES = [
    "24.0,-90.0,35.0,-75.0",
    "35.0,-90.0,49.0,-75.0",
    "24.0,-105.0,35.0,-90.0",
    "35.0,-105.0,49.0,-90.0",
    "30.0,-125.0,40.0,-105.0",
    "40.0,-125.0,49.0,-105.0",
];

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
                });
            }
        }
    }

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
                message: `IFR cluster: ${bestCluster.count} airports below 3SM visibility within 300nm of ${bestCluster.center.icaoId}. VFR flight not recommended.`,
                lat: bestCluster.center.lat, lon: bestCluster.center.lon,
            });
        }
    }

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
                message: `Structural icing risk: ${icingStations.length} stations near-freezing (around ${rep.temp}°C) with moisture. Icing probable in IMC below 10,000ft.`,
                lat: rep.lat, lon: rep.lon,
            });
        }
    }

    if (Array.isArray(pireps) && pireps.length > 0) {
        const turbPireps = pireps.filter(p => p.type === 'TURBULENCE');
        const icePireps  = pireps.filter(p => p.type === 'ICING');
        if (turbPireps.length >= 3) {
            const sevCount = turbPireps.filter(p => p.severity === 'SEVERE').length;
            findings.push({
                id: `TURB-PIREPS-${ts}`,
                type: 'TURBULENCE_CLUSTER',
                severity: sevCount > 0 ? 'HIGH' : 'MEDIUM',
                message: `${turbPireps.length} turbulence PIREPs${sevCount > 0 ? ` — ${sevCount} SEVERE` : ''}. Altitudes: ${[...new Set(turbPireps.map(p => p.altitude).filter(Boolean))].slice(0, 4).join(', ')}.`,
            });
        }
        if (icePireps.length >= 2) {
            findings.push({
                id: `ICE-PIREPS-${ts}`,
                type: 'ICING_PIREPS',
                severity: 'MEDIUM',
                message: `${icePireps.length} icing PIREPs reported. Verify altitude-specific icing forecasts before IMC.`,
            });
        }
    }

    const fogRisk = ground.filter(s =>
        s.temp != null && s.dewp != null &&
        (s.temp - s.dewp) <= 3 && (s.temp - s.dewp) >= 0 && s.wspd < 8
    );
    if (fogRisk.length >= 6) {
        findings.push({
            id: `FOG-${ts}`,
            type: 'FOG_RISK',
            severity: 'MEDIUM',
            message: `Widespread fog potential: ${fogRisk.length} stations with near-zero temp/dew spread and calm winds. Radiation fog likely overnight and morning hours.`,
        });
    }

    const status = findings.some(f => f.severity === 'HIGH') ? 'alert' : 'ok';
    return { name: 'HazardAgent', role: 'Hazard Detection', status, findings: findings.slice(0, 8), runAt: new Date().toISOString() };
}

// ─── TrendAgent (stateless on serverless — reports baseline) ─────────────────

function runTrendAgent() {
    return {
        name: 'TrendAgent', role: 'Condition Trends', status: 'ok',
        findings: [{ id: 'TREND-SERVERLESS', type: 'INFO', severity: 'INFO', message: 'Trend analysis requires persistent state. Run the Express backend (node server.js) for full trend detection between data cycles.' }],
        runAt: new Date().toISOString(),
    };
}

// ─── BriefingAgent ────────────────────────────────────────────────────────────

async function runBriefingAgent(windResult, hazardResult) {
    const allFindings = [...windResult.findings, ...hazardResult.findings].filter(f => f.severity !== 'INFO');

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
        return { name: 'BriefingAgent', role: 'Situation Synthesis', status: 'ok', briefing: 'No significant weather hazards detected. Conditions appear favorable for VFR flight; review local METARs and TAFs before departure.', runAt: new Date().toISOString() };
    }

    const fmt = arr => arr.map(f => `[${f.severity}] ${f.message}`).join('\n') || 'No findings.';
    const prompt = `You are AeroGuard BriefingAgent, an expert aviation meteorologist AI.

WindAgent findings:
${fmt(windResult.findings)}

HazardAgent findings:
${fmt(hazardResult.findings)}

Write a 3-4 sentence pilot situation briefing. Lead with the most significant hazard. Note developing threats. End with a flight safety recommendation. Use professional aviation language. Flowing prose only — no bullets or headers.`;

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

// ─── Data fetch + agent orchestration ────────────────────────────────────────

async function runAgents() {
    // Fetch ground METARs
    const groundResults = await Promise.all(
        BBOXES.map(box =>
            fetch(`https://aviationweather.gov/api/data/metar?bbox=${box}&format=json`)
                .then(r => r.json()).catch(() => [])
        )
    );
    let ground = [];
    groundResults.forEach(r => { if (Array.isArray(r)) ground = ground.concat(r); });
    const seen = new Set();
    const uniqueGround = [];
    for (const s of ground) {
        if (!seen.has(s.icaoId) && s.lat && s.lon && s.wspd != null) {
            seen.add(s.icaoId);
            uniqueGround.push(s);
        }
    }

    // Fetch winds aloft
    const aloftRaw = await fetch('https://aviationweather.gov/api/data/windtemp?region=all&level=low&fcst=06&format=raw')
        .then(r => r.text()).catch(() => '');
    const aloft = [];
    const parseLvl = str => {
        if (!str || str.length < 4) return null;
        let dir = parseInt(str.substring(0, 2)) * 10;
        let spd = parseInt(str.substring(2, 4));
        if (isNaN(dir) || isNaN(spd)) return null;
        if (dir >= 500) { dir -= 500; spd += 100; }
        let t = null;
        if (str.length >= 6) {
            const sign = str[4];
            if (sign === '+' || sign === '-') { t = parseInt(str.substring(5, 7)); if (!isNaN(t) && sign === '-') t = -t; }
            else t = -Math.abs(parseInt(str.substring(4, 6)));
        }
        return { windDir: dir, windSpeed: spd, temp: t };
    };
    for (const line of aloftRaw.split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 6 && /^[A-Z]{3}$/.test(parts[0])) {
            aloft.push({ icaoId: 'K' + parts[0], levels: { '3k': parseLvl(parts[1]), '6k': parseLvl(parts[2]), '9k': parseLvl(parts[3]), '12k': parseLvl(parts[4]), '18k': parseLvl(parts[5]) } });
        }
    }

    // Fetch PIREPs (best-effort)
    const pirepRaw = await fetch('https://aviationweather.gov/api/data/aircraftreport?format=json')
        .then(r => r.json()).catch(() => []);

    // Run agents
    const windResult    = runWindAgent(uniqueGround, aloft);
    const hazardResult  = runHazardAgent(uniqueGround, pirepRaw);
    const trendResult   = runTrendAgent();
    const briefingResult = await runBriefingAgent(windResult, hazardResult);

    return {
        agents: { wind: windResult, hazard: hazardResult, trend: trendResult, briefing: briefingResult },
        lastRun: new Date().toISOString(),
    };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const now = Date.now();
        if (!cachedResult || (now - cacheTime > CACHE_TTL)) {
            cachedResult = await runAgents();
            cacheTime = now;
        }
        res.status(200).json(cachedResult);
    } catch (err) {
        console.error('Agent handler error:', err);
        res.status(500).json({ error: 'Agent orchestration failed.' });
    }
}
