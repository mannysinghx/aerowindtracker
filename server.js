import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MISSING_KEY');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// ─── State ────────────────────────────────────────────────────────────────────

let cache = {
    ground: [],
    aloft: [],
    alerts: [],
    pireps: [],
    lastUpdated: null
};

let previousGround = [];   // used by TrendAgent to detect changes between cycles

let agentCache = {
    agents: {
        wind:     { name: 'WindAgent',     role: 'Wind Pattern Analysis',   status: 'idle', findings: [], runAt: null },
        hazard:   { name: 'HazardAgent',   role: 'Hazard Detection',         status: 'idle', findings: [], runAt: null },
        trend:    { name: 'TrendAgent',    role: 'Condition Trends',         status: 'idle', findings: [], runAt: null },
        briefing: { name: 'BriefingAgent', role: 'Situation Synthesis',      status: 'idle', briefing: '', runAt: null },
    },
    lastRun: null
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BBOXES = [
    "24.0,-90.0,35.0,-75.0",   // SE
    "35.0,-90.0,49.0,-75.0",   // NE
    "24.0,-105.0,35.0,-90.0",  // S-Mid
    "35.0,-105.0,49.0,-90.0",  // N-Mid
    "30.0,-125.0,40.0,-105.0", // SW
    "40.0,-125.0,49.0,-105.0"  // NW
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

// ─── Legacy Alert Generator (kept for backward compat with /api/data) ─────────

function generateAIAlerts(ground) {
    const alerts = [];
    const severeWinds = ground.filter(s => s.wspd >= 35 || s.wgst >= 45);
    for (const w of severeWinds.slice(0, 10)) {
        alerts.push({
            id: `WIND-${w.icaoId}-${Date.now()}`,
            type: 'SEVERE_WIND',
            location: w.icaoId,
            lat: w.lat,
            lon: w.lon,
            message: `URGENT: AeroGuard AI detected sustained winds of ${w.wspd}kts (gusting ${w.wgst || 'N/A'}kts) at ${w.icaoId}. Microburst or frontal boundary likely.`,
            severity: 'HIGH'
        });
    }
    const fogRisks = ground.filter(s =>
        s.temp !== null && s.dewp !== null &&
        (s.temp - s.dewp) <= 2 && (s.temp - s.dewp) >= 0 && s.wspd < 10
    );
    for (const f of fogRisks.slice(0, 5)) {
        alerts.push({
            id: `FOG-${f.icaoId}-${Date.now()}`,
            type: 'VISIBILITY',
            location: f.icaoId,
            lat: f.lat,
            lon: f.lon,
            message: `NOTICE: AeroGuard AI predicts imminent fog formation at ${f.icaoId}. Temp/Dew spread is critical (${f.temp}°C / ${f.dewp}°C) with calm winds.`,
            severity: 'MEDIUM'
        });
    }
    alerts.push({
        id: `SYS-${Date.now()}`,
        type: 'SYSTEM',
        location: 'GLOBAL',
        message: `AeroGuard AI active. Analyzing ${ground.length} remote weather stations autonomously.`,
        severity: 'INFO'
    });
    const SEV_ORDER = { HIGH: 0, MEDIUM: 1, INFO: 2 };
    return alerts.sort((a, b) => (SEV_ORDER[a.severity] ?? 3) - (SEV_ORDER[b.severity] ?? 3));
}

// ─── PIREP Parser (LLM) ───────────────────────────────────────────────────────

async function parseSeverePireps(pireps) {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MISSING_KEY') return [];
    const severePireps = pireps.filter(p =>
        p.rawOb && (p.rawOb.includes('SEV') || p.rawOb.includes('MOD-SEV') || p.rawOb.includes('UUA'))
    ).slice(0, 5);
    if (severePireps.length === 0) return [];

    const prompt = `You are an expert aviation AI. Analyze the following raw PIREPs (Pilot Reports).
Return a raw JSON array with keys: id, type ("TURBULENCE"/"ICING"/"OTHER"), lat, lon, severity ("SEVERE"/"MODERATE"), description (1-sentence plain English), altitude (e.g. "FL350").
Raw PIREPs: ${JSON.stringify(severePireps.map(p => ({ raw: p.rawOb, lat: p.lat, lon: p.lon })))}
Respond ONLY with a valid JSON array. No markdown, no backticks.`;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        let text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (err) {
        console.error('PIREP LLM Error:', err);
        return [];
    }
}

// ─── WindAgent ────────────────────────────────────────────────────────────────
// Detects wind shear corridors, mountain wave activity, and extreme surface winds.

function runWindAgent(ground, aloft) {
    const findings = [];
    const ts = Date.now();

    // 1. Wind Shear: pairs within 80 km with >15 kt speed diff or >45° direction diff
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

    // 2. Mountain wave: strong aloft winds (≥60 kt at 12k or ≥80 kt at 18k)
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
                message: `Mountain wave / jet stream activity near ${a.icaoId}: ${lvl.windSpeed}kt winds at ${alt}ft. Severe turbulence and rotor zones possible below ridge height.`,
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
// Detects IFR clusters, icing corridors, fog regions, and PIREP-based hazards.

function runHazardAgent(ground, pireps) {
    const findings = [];
    const ts = Date.now();

    // 1. IFR cluster: 3+ stations within 300 km with visibility < 3 SM
    const ifrStations = ground.filter(s => s.visib != null && s.visib < 3);
    if (ifrStations.length >= 3) {
        let bestCluster = null;
        for (const center of ifrStations) {
            const nearby = ifrStations.filter(s => haversineKm(center.lat, center.lon, s.lat, s.lon) < 300);
            if (!bestCluster || nearby.length > bestCluster.count)
                bestCluster = { center, count: nearby.length, stations: nearby };
        }
        if (bestCluster && bestCluster.count >= 3) {
            findings.push({
                id: `IFR-${bestCluster.center.icaoId}-${ts}`,
                type: 'IFR_CLUSTER',
                severity: bestCluster.count >= 8 ? 'HIGH' : 'MEDIUM',
                message: `IFR cluster: ${bestCluster.count} airports reporting visibility below 3SM within 300nm of ${bestCluster.center.icaoId}. VFR flight not recommended in this region.`,
                lat: bestCluster.center.lat, lon: bestCluster.center.lon,
            });
        }
    }

    // 2. Structural icing risk: temp −10 to +2°C, dew spread < 4°C
    const icingStations = ground.filter(s =>
        s.temp != null && s.dewp != null &&
        s.temp >= -10 && s.temp <= 2 && (s.temp - s.dewp) < 4
    );
    if (icingStations.length >= 3) {
        // Find densest regional cluster (1° grid cells)
        const grid = {};
        for (const s of icingStations) {
            const key = `${Math.round(s.lat / 3) * 3},${Math.round(s.lon / 3) * 3}`;
            (grid[key] = grid[key] || []).push(s);
        }
        const densest = Object.values(grid).sort((a, b) => b.length - a.length)[0];
        if (densest && densest.length >= 2) {
            const rep = densest[0];
            findings.push({
                id: `ICING-${rep.icaoId}-${ts}`,
                type: 'ICING_RISK',
                severity: 'MEDIUM',
                message: `Structural icing risk: ${icingStations.length} stations with near-freezing temps (around ${rep.temp}°C) and moisture. Icing probable in IMC below 10,000ft. PIREPs recommended before entering clouds.`,
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

    // 4. Widespread fog potential (temp/dew ≤ 3°C + calm winds)
    const fogRisk = ground.filter(s =>
        s.temp != null && s.dewp != null &&
        (s.temp - s.dewp) <= 3 && (s.temp - s.dewp) >= 0 && s.wspd < 8
    );
    if (fogRisk.length >= 6) {
        findings.push({
            id: `FOG-REGIONAL-${ts}`,
            type: 'FOG_RISK',
            severity: 'MEDIUM',
            message: `Widespread fog potential: ${fogRisk.length} stations with near-zero temp/dew spread and calm winds. Radiation fog likely overnight and into morning hours across affected region.`,
        });
    }

    const status = findings.some(f => f.severity === 'HIGH') ? 'alert' : 'ok';
    return { name: 'HazardAgent', role: 'Hazard Detection', status, findings: findings.slice(0, 8), runAt: new Date().toISOString() };
}

// ─── TrendAgent ───────────────────────────────────────────────────────────────
// Compares current vs previous data cycle to detect rapidly changing conditions.

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
    const ifrDegrading = [];
    const pressureDrops = [];

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
            message: `Rapid wind change at ${top.station.icaoId}: ${top.delta > 0 ? '+' : ''}${top.delta}kt in 5 minutes (now ${top.station.wspd}kt). ${rapidWindChanges.length > 1 ? `${rapidWindChanges.length - 1} additional station(s) also changing rapidly.` : ''}`,
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

// ─── BriefingAgent (LLM) ──────────────────────────────────────────────────────
// Synthesizes all agent findings into a pilot-ready situational briefing.

async function runBriefingAgent(windResult, hazardResult, trendResult) {
    const allFindings = [
        ...windResult.findings,
        ...hazardResult.findings,
        ...trendResult.findings,
    ].filter(f => f.severity !== 'INFO');

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MISSING_KEY') {
        const high = allFindings.filter(f => f.severity === 'HIGH');
        const med  = allFindings.filter(f => f.severity === 'MEDIUM');
        let briefing = high.length > 0
            ? `${high.length} high-priority condition(s) active. ${high[0].message}${med.length > 0 ? ` Additionally, ${med.length} moderate concern(s) exist.` : ''}`
            : med.length > 0
                ? `${med.length} moderate condition(s) detected. ${med[0].message}`
                : 'No significant weather hazards detected. Conditions appear favorable for VFR operations across most of the coverage area.';
        const status = high.length > 0 ? 'alert' : 'ok';
        return { name: 'BriefingAgent', role: 'Situation Synthesis', status, briefing, runAt: new Date().toISOString() };
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
        console.error('BriefingAgent LLM error:', err);
        return { name: 'BriefingAgent', role: 'Situation Synthesis', status: 'ok', briefing: 'Situation synthesis temporarily unavailable.', runAt: new Date().toISOString() };
    }
}

// ─── Data Ingestion ───────────────────────────────────────────────────────────

async function fetchAllData() {
    console.log(`[${new Date().toISOString()}] Fetching weather data + running agent cycle...`);
    try {
        // Ground METARs
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

        // Winds aloft
        const aloftRaw = await fetch('https://aviationweather.gov/api/data/windtemp?region=all&level=low&fcst=06&format=raw')
            .then(r => r.text()).catch(() => '');
        const aloft = [];
        const parseLvl = str => {
            if (!str || str.length < 4) return null;
            let dir = parseInt(str.substring(0, 2)) * 10;
            let spd = parseInt(str.substring(2, 4));
            if (isNaN(dir) || isNaN(spd)) return null;
            if (dir >= 500) { dir -= 500; spd += 100; }
            if (dir === 990 || str.startsWith('9900')) return { windDir: null, windSpeed: 0, temp: null };
            if (dir > 360 || spd > 250) return null;
            let t = null;
            if (str.length >= 6) {
                const sign = str[4];
                const digits = str.substring(5, 7);
                if (sign === '+' || sign === '-') { t = parseInt(digits); if (!isNaN(t) && sign === '-') t = -t; }
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

        // PIREPs
        const pirepRaw = await fetch('https://aviationweather.gov/api/data/aircraftreport?format=json')
            .then(r => r.json()).catch(() => []);
        const aiParsedPireps = await parseSeverePireps(pirepRaw);

        // Legacy alerts
        const alerts = generateAIAlerts(uniqueGround);

        // ── Run all agents in parallel ──────────────────────────────────────
        const windResult    = runWindAgent(uniqueGround, aloft);
        const hazardResult  = runHazardAgent(uniqueGround, aiParsedPireps);
        const trendResult   = runTrendAgent(uniqueGround, previousGround);
        const briefingResult = await runBriefingAgent(windResult, hazardResult, trendResult);

        // Persist this cycle's ground data for the next TrendAgent run
        previousGround = [...uniqueGround];

        agentCache = {
            agents: {
                wind:     windResult,
                hazard:   hazardResult,
                trend:    trendResult,
                briefing: briefingResult,
            },
            lastRun: new Date().toISOString()
        };

        cache = {
            ground: uniqueGround,
            aloft,
            alerts,
            pireps: aiParsedPireps,
            lastUpdated: new Date().toISOString()
        };

        const totalFindings = windResult.findings.length + hazardResult.findings.length + trendResult.findings.length;
        console.log(`[${new Date().toISOString()}] Agent cycle complete. ${totalFindings} findings. Briefing: ${briefingResult.status.toUpperCase()}`);

    } catch (e) {
        console.error('Agent ingestion error:', e);
    }
}

fetchAllData();
setInterval(fetchAllData, 5 * 60 * 1000);

// ─── API Routes ───────────────────────────────────────────────────────────────

app.get('/api/data', (req, res) => {
    res.json(cache);
});

app.post('/api/refresh', async (req, res) => {
    console.log('[manual refresh] Cache flush requested');
    await fetchAllData();
    res.json({ ok: true, lastUpdated: cache.lastUpdated });
});

// ─── Admin (Vercel KV mocked for local dev) ───────────────────────────────────

const DEFAULT_ADMIN_SETTINGS = {
    fontFamily: 'Inter',
    accentColor: '#3b82f6',
    panelOpacity: 0.75,
    defaultMapStyle: 'dark',
    defaultAltitude: 'ground',
    barbSize: 28,
    runwayFontSize: 13,
    defaultPanels: { alerts: true, agents: false, weather: false },
};

let localAdminSettings = { ...DEFAULT_ADMIN_SETTINGS };

app.get('/api/settings', (req, res) => {
    res.json(localAdminSettings);
});

app.get('/api/admin', (req, res) => {
    const secret = req.query.secret || req.headers['x-admin-secret'];
    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    // Return mock data — real user list requires Vercel KV in production
    res.json({
        users: [],
        stats: { total: 0, active24h: 0, active7d: 0, withLocation: 0 },
        settings: localAdminSettings,
    });
});

app.post('/api/admin', (req, res) => {
    const secret = req.query.secret || req.headers['x-admin-secret'];
    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { settings } = req.body;
    if (settings && typeof settings === 'object') {
        localAdminSettings = { ...DEFAULT_ADMIN_SETTINGS, ...settings };
    }
    res.json({ success: true });
});

app.get('/api/agents', (req, res) => {
    res.json(agentCache);
});

// Vercel KV tracking (mock for local dev)
app.post('/api/tracking', (req, res) => {
    console.log(`[KV Mock] Saved tracking data for user: ${req.body.userId}`);
    res.json({ success: true, message: 'Tracking data recorded (mocked locally)' });
});

// Pilot Copilot chat — powered by Gemini with live weather context
app.post('/api/chat', async (req, res) => {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MISSING_KEY') {
        return res.json({ reply: "AeroGuard AI copilot requires a GEMINI_API_KEY. Add it to your environment variables to enable live intelligence." });
    }

    const { message, context, history } = req.body;
    const agentSummary = agentCache.agents.briefing?.briefing || 'No agent briefing available yet.';

    const systemContext = `You are AeroGuard AI Copilot, an expert aviation weather assistant with access to live data.

Current situation (${new Date().toLocaleTimeString()}):
- ${cache.ground.length} METAR stations active
- ${cache.alerts?.length || 0} active alerts
- Agent briefing: ${agentSummary}

${context ? `Selected airport: ${JSON.stringify(context)}` : 'No airport selected.'}

Provide expert, concise aviation weather guidance. Always note that official sources (ForeFlight, AviationWeather.gov, ATIS) must be checked before actual flight operations.`;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const chatHistory = [
            { role: 'user', parts: [{ text: systemContext }] },
            { role: 'model', parts: [{ text: 'Understood. I am AeroGuard AI Copilot, ready to provide aviation weather intelligence.' }] },
            ...(history || []).slice(-12)
        ];
        const chat = model.startChat({ history: chatHistory });
        const result = await chat.sendMessage(message);
        res.json({ reply: result.response.text() });
    } catch (err) {
        console.error('Chat LLM error:', err);
        res.json({ reply: 'AeroGuard AI is temporarily unavailable. Please try again.' });
    }
});

// TAF endpoint — proxies aviationweather.gov
app.get('/api/taf', async (req, res) => {
    const icao = (req.query.icao || '').toUpperCase().trim();
    if (!icao) return res.status(400).json({ error: 'icao required' });
    try {
        const url = `https://aviationweather.gov/api/data/taf?ids=${icao}&format=json`;
        const raw = await fetch(url, { headers: { 'Accept': 'application/json' } })
            .then(r => r.ok ? r.json() : null).catch(() => null);
        if (!raw || !Array.isArray(raw) || raw.length === 0)
            return res.status(404).json({ error: 'No TAF found', icao });

        const taf = raw[0];
        const periods = (taf.fcsts || []).map(fc => {
            let ceilingFt = Infinity;
            if (Array.isArray(fc.clouds)) {
                for (const l of fc.clouds) {
                    if ((l.cover === 'BKN' || l.cover === 'OVC') && l.base != null) {
                        const ft = l.base;
                        if (ft < ceilingFt) ceilingFt = ft;
                    }
                }
            }
            let visSM = 10;
            if (fc.visib != null) { const v = parseFloat(fc.visib); if (!isNaN(v)) visSM = v; }
            const cat = ceilingFt < 500 || visSM < 1 ? 'LIFR'
                : ceilingFt < 1000 || visSM < 3 ? 'IFR'
                : ceilingFt < 3000 || visSM < 5 ? 'MVFR' : 'VFR';
            return {
                timeFrom: fc.timeFrom, timeTo: fc.timeTo,
                type: fc.fcstType || fc.type || 'FM',
                windDir: fc.wdir ?? null, windSpeed: fc.wspd ?? null, windGust: fc.wgst ?? null,
                visibility: visSM >= 10 ? '10+' : String(visSM),
                ceiling: ceilingFt === Infinity ? 'Unlimited' : `${ceilingFt.toLocaleString()} ft`,
                ceilingFt: ceilingFt === Infinity ? null : ceilingFt,
                weather: fc.wxString || '',
                clouds: (fc.clouds || []).map(c => `${c.cover}${c.base != null ? c.base : ''}`).join(' '),
                flightCategory: cat,
            };
        });
        res.json({ icao, rawText: taf.rawTAF || '', issueTime: taf.issueTime, validFrom: taf.validTimeFrom, validTo: taf.validTimeTo, forecast: periods, fetchedAt: new Date().toISOString() });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// NOTAM endpoint — proxies FAA NOTAM search + Gemini digest
app.get('/api/notams', async (req, res) => {
    const icao = (req.query.icao || '').toUpperCase().trim();
    if (!icao) return res.status(400).json({ error: 'icao required' });

    function categorise(kw = '', tx = '') {
        const k = kw.toUpperCase(); const t = tx.toUpperCase();
        if (/^(RWY|RUNWAY)/.test(k) || /RWY\s+\d/.test(t)) return 'Runway';
        if (/^(TWY|TAXIWAY|APRON)/.test(k)) return 'Taxiway/Apron';
        if (/^(NAV|ILS|VOR|VORTAC|NDB|LOC|GP|DME|TACAN)/.test(k)) return 'Navigation';
        if (/^(COM|ATIS|ASOS|AWOS)/.test(k)) return 'Communications';
        if (/^(OBST|OBSTACLE|CRANE|TOWER)/.test(k)) return 'Obstacle';
        if (/^(AIRSPACE|TFR|MOA|SUA|RESTRICTED|WARNING)/.test(k)) return 'Airspace';
        if (/^(SVC|SERVICE|FUEL|AVGAS|JET)/.test(k)) return 'Services';
        return 'General';
    }

    try {
        const body = new URLSearchParams({ searchType: '0', designatorsForLocation: icao, notamsOnly: 'false', domesticOrInternational: 'Domestic', offset: '0' });
        const faaRes = await fetch('https://notams.aim.faa.gov/notamSearch/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            body: body.toString(),
        });
        const faaData = faaRes.ok ? await faaRes.json() : { notamList: [] };
        const stripHtml = s => s.replace(/<[^>]*>/g, '').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
        const notams = (faaData.notamList || []).map((n, i) => {
            const text = stripHtml(n.notamDescription || n.icaoMessage || n.traditionalMessage || '');
            const keyword = n.keyword || n.classification || '';
            return { id: n.id || `NOTAM-${i}`, category: categorise(keyword, text), keyword: keyword.toUpperCase(), text: text.trim(), location: n.icaoLocation || icao, effectiveStart: n.effectiveStart || null, effectiveEnd: n.effectiveEnd || null };
        }).filter(n => n.text.length > 0);

        let digest = notams.length === 0
            ? `No active NOTAMs found for ${icao} at this time.`
            : `${notams.length} NOTAM${notams.length !== 1 ? 's' : ''} active at ${icao}. Review items below.`;

        if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MISSING_KEY' && notams.length > 0) {
            try {
                const prompt = `You are AeroGuard AI. Summarise these NOTAMs for ${icao} in 1-2 sentences for a departing pilot. Lead with the most critical item (runway closures, TFRs, nav outages). Be concise. No bullets.\n\n${notams.slice(0, 10).map(n => n.text).join('\n')}`;
                const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                const result = await model.generateContent(prompt);
                digest = result.response.text().trim();
            } catch { /* use fallback digest */ }
        }

        res.json({ icao, count: notams.length, digest, notams, fetchedAt: new Date().toISOString() });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── Flight Path Winds ────────────────────────────────────────────────────────

function fpHaversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function fpCalcBearing(lat1, lon1, lat2, lon2) {
    const toRad = x => x * Math.PI / 180;
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1))*Math.sin(toRad(lat2)) - Math.sin(toRad(lat1))*Math.cos(toRad(lat2))*Math.cos(dLon);
    return Math.round(((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360);
}

function fpParseLvl(str) {
    if (!str || str.length < 4) return null;
    let dir = parseInt(str.substring(0, 2)) * 10;
    let spd = parseInt(str.substring(2, 4));
    if (isNaN(dir) || isNaN(spd)) return null;
    if (dir >= 500) { dir -= 500; spd += 100; }
    if (dir === 990 || str.startsWith('9900')) return { windDir: null, windSpeed: 0, temp: null };
    if (dir > 360 || spd > 250) return null;
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

function fpParsePrecip(wxStr) {
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

function fpGetCeiling(metar) {
    for (let i = 1; i <= 3; i++) {
        const cvg = metar[`cldCvg${i}`];
        const bas = metar[`cldBas${i}`];
        if ((cvg === 'BKN' || cvg === 'OVC') && bas != null) return bas;
    }
    return null;
}

function fpFlightCategory(ceiling, visSM) {
    const c = ceiling ?? Infinity;
    const v = parseFloat(visSM) || 10;
    if (c < 500 || v < 1) return 'LIFR';
    if (c < 1000 || v < 3) return 'IFR';
    if (c < 3000 || v < 5) return 'MVFR';
    return 'VFR';
}

// ─── Altitude Recommendation Engine (mirrors api/flightpath.js) ──────────────

function fpMagVariation(avgLon) {
    if (avgLon < -115) return 15;
    if (avgLon < -105) return 12;
    if (avgLon < -90)  return 4;
    if (avgLon < -75)  return -8;
    return -14;
}

function fpTailwindComponent(windFromDir, windSpeed, routeBearing) {
    const angle = ((windFromDir - routeBearing + 180) + 360) % 360;
    return windSpeed * Math.cos(angle * Math.PI / 180);
}

function fpAltToKey(alt) {
    if (alt <= 4500)  return '3k';
    if (alt <= 7000)  return '6k';
    if (alt <= 10500) return '9k';
    if (alt <= 15000) return '12k';
    return '18k';
}

function fpGetMountainousRegions(waypoints) {
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

function fpComputeAltitudeRecommendation(trueBearing, distanceNm, waypoints) {
    const avgLon     = waypoints.reduce((s, w) => s + w.lon, 0) / waypoints.length;
    const magVar     = fpMagVariation(avgLon);
    const magBearing = ((trueBearing + magVar) + 360) % 360;
    const eastbound  = magBearing < 180;

    const vfrSet = eastbound
        ? [3500, 5500, 7500, 9500, 11500, 13500]
        : [4500, 6500, 8500, 10500, 12500];

    let distCeil;
    if (distanceNm < 150)       distCeil = eastbound ? 5500 : 6500;
    else if (distanceNm < 300)  distCeil = eastbound ? 7500 : 8500;
    else if (distanceNm < 600)  distCeil = eastbound ? 9500 : 10500;
    else                        distCeil = eastbound ? 11500 : 12500;

    const mountainRegions = fpGetMountainousRegions(waypoints);
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

    let candidates = vfrSet.filter(a => a >= terrainFloor && a <= 18000);
    if (candidates.length === 0) candidates = vfrSet.filter(a => a >= terrainFloor);
    const practicalCandidates = candidates.filter(a => a <= Math.max(distCeil, terrainFloor));
    if (practicalCandidates.length > 0) candidates = practicalCandidates;

    const windAt = {};
    for (const alt of vfrSet) {
        const key = fpAltToKey(alt);
        let sum = 0, n = 0;
        for (const wp of waypoints) {
            const d = wp.aloft?.[key];
            if (d?.windDir != null && d?.windSpeed != null) {
                sum += fpTailwindComponent(d.windDir, d.windSpeed, trueBearing);
                n++;
            }
        }
        windAt[alt] = n > 0 ? Math.round(sum / n) : null;
    }

    const scored = candidates.map(alt => ({
        alt,
        windComp: windAt[alt] ?? 0,
        score: (windAt[alt] ?? 0) + (distanceNm > 300 ? (alt / 1000) * 0.8 : 0),
    })).sort((a, b) => b.score - a.score);

    const best       = scored[0]?.alt ?? candidates[0];
    const bestWind   = windAt[best] ?? 0;
    const bestAltKey = fpAltToKey(best);

    const legalAlts = vfrSet.map(a => `${(a/1000).toFixed(1)}k`).join(' / ');
    const reasons = [
        {
            rule: 'FAR 91.159 — VFR Cruising',
            icon: '📐',
            text: `${eastbound ? 'Eastbound' : 'Westbound'} flight (${Math.round(magBearing)}° mag). Above 3,000 ft AGL, VFR aircraft must maintain ${eastbound ? 'odd thousands + 500 ft' : 'even thousands + 500 ft'}. Legal altitudes for this heading: ${legalAlts} ft MSL.`,
        },
        {
            rule: 'Winds Aloft',
            icon: '💨',
            text: bestWind > 2
                ? `Average ${bestWind}-kt tailwind at ${(best/1000).toFixed(1)}k ft along this route. Tailwinds reduce fuel burn and flight time.`
                : bestWind < -2
                    ? `Average ${Math.abs(bestWind)}-kt headwind at ${(best/1000).toFixed(1)}k ft. This is the best VFR-legal altitude — consider IFR for ATC altitude flexibility.`
                    : `Light wind component (${bestWind >= 0 ? '+' : ''}${bestWind} kt avg) at ${(best/1000).toFixed(1)}k ft. Winds are relatively neutral at this altitude.`,
        },
        distanceNm >= 150 ? {
            rule: 'Distance & Efficiency',
            icon: '📏',
            text: `${distanceNm} nm route — climbing to ${(best/1000).toFixed(1)}k ft is practical. TAS increases ~${Math.round((best/1000)*2)}% vs sea level. Plan ≈${Math.round(distanceNm/3)} nm of level cruise (1/3 rule).`,
        } : {
            rule: 'Distance & Efficiency',
            icon: '📏',
            text: `${distanceNm} nm is a shorter leg. A lower cruise altitude keeps descent manageable and avoids unnecessary climb time.`,
        },
    ];
    if (terrainFloor > 0) {
        reasons.push({
            rule: 'Terrain Clearance',
            icon: '⛰️',
            text: `FAA Part 95 mountainous area(s) on route require minimum ${terrainFloor.toLocaleString()} ft MSL. Always add 1,000–2,000 ft above the highest MEF shown on the sectional chart.`,
        });
    }

    const warnings = [];
    for (const tw of terrainWarnings) {
        warnings.push({ type: 'terrain', icon: '⛰️', severity: 'high', title: tw.region, text: tw.detail });
    }
    const ifrWps = waypoints.filter(wp => wp.surface?.flightCategory === 'IFR' || wp.surface?.flightCategory === 'LIFR');
    if (ifrWps.length > 0) {
        warnings.push({ type: 'ifr', icon: '🌫️', severity: 'high', title: 'IFR Conditions En Route',
            text: `IFR or LIFR at ${ifrWps.length} of ${waypoints.length} waypoints (${ifrWps.map(w => w.label).join(', ')}). VFR may not be possible. Obtain full weather briefing.` });
    }
    const precipWps = waypoints.filter(wp => wp.surface?.precip);
    if (precipWps.length > 0) {
        const types = [...new Set(precipWps.map(wp => wp.surface.precip.type))];
        const sev   = precipWps.some(wp => wp.surface.precip.severity === 'high');
        warnings.push({ type: 'precip', icon: precipWps[0].surface.precip.icon, severity: sev ? 'high' : 'medium',
            title: 'Precipitation Along Route',
            text: `${types.join(', ')} at ${precipWps.length} waypoint${precipWps.length > 1 ? 's' : ''}. ${sev ? 'Thunderstorms/freezing precip — avoid or obtain IFR clearance.' : 'Monitor for icing and visibility impacts.'}` });
    }
    if (best > 15000) {
        warnings.push({ type: 'oxygen', icon: '🩸', severity: 'critical', title: 'O₂ All Occupants (FAR 91.211)', text: 'Above 15,000 ft MSL — supplemental O₂ must be available for every person on board.' });
    } else if (best > 14000) {
        warnings.push({ type: 'oxygen', icon: '🩸', severity: 'critical', title: 'Crew Oxygen Required (FAR 91.211)', text: 'Above 14,000 ft MSL — crew must use supplemental oxygen for the entire duration.' });
    } else if (best > 12500) {
        warnings.push({ type: 'oxygen', icon: '🩸', severity: 'medium', title: 'Oxygen — 30-min Rule (FAR 91.211)', text: 'Above 12,500 ft MSL — crew must use O₂ if time at this altitude exceeds 30 consecutive minutes.' });
    }
    if (best >= 16500) {
        warnings.push({ type: 'airspace', icon: '🚫', severity: 'high', title: 'Approaching Class A (FL180)', text: 'Class A begins at FL180. VFR prohibited. IFR clearance, ADS-B Out, Mode C, and IFR flight plan required. Set 29.92 at FL180.' });
    }

    const alternatives = scored.slice(1, 3).filter(s => s.alt !== best).map(s => ({
        alt: s.alt, label: `${s.alt.toLocaleString()} ft MSL`, windComp: windAt[s.alt] ?? 0,
        note: s.alt < best ? `Shorter climb, less wind advantage` : `Better winds, higher climb cost`,
    }));

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
        complianceNotes: [
            `${eastbound ? 'Eastbound' : 'Westbound'} → ${eastbound ? 'odd' : 'even'} thousands + 500 ft (FAR 91.159)`,
            best <= 12500 ? 'No O₂ req\'d (FAR 91.211)' : best <= 14000 ? 'O₂ req\'d >30 min at altitude (FAR 91.211)' : 'Continuous crew O₂ (FAR 91.211)',
            best < 18000 ? 'Below FL180 — Class A not entered' : 'FL180+ — IFR only required',
            mountainRegions.length > 0 ? 'Mountainous terrain: FAA Part 95 MEAs apply' : 'Non-mountainous: standard 1,000 ft obstacle clearance',
        ],
        windComponents: Object.fromEntries(vfrSet.map(a => [a, windAt[a]])),
        terrainRegions: mountainRegions,
    };
}

app.get('/api/flightpath', async (req, res) => {
    const fromIcao = (req.query.from || '').toUpperCase().trim();
    const toIcao   = (req.query.to   || '').toUpperCase().trim();
    const time     = req.query.time  || '12:00';

    if (!fromIcao || !toIcao) {
        return res.status(400).json({ error: 'from and to ICAO codes are required' });
    }

    try {
        const AWC = 'https://aviationweather.gov/api/data';
        const HDRS = { 'User-Agent': 'AeroWindTracker/1.0' };

        const [fromMet, toMet] = await Promise.all([
            fetch(`${AWC}/metar?ids=${fromIcao}&format=json`, { headers: HDRS }).then(r => r.ok ? r.json() : []).catch(() => []),
            fetch(`${AWC}/metar?ids=${toIcao}&format=json`,   { headers: HDRS }).then(r => r.ok ? r.json() : []).catch(() => []),
        ]);

        if (!fromMet[0]) return res.status(404).json({ error: `No METAR data for ${fromIcao}. Try a major airport.` });
        if (!toMet[0])   return res.status(404).json({ error: `No METAR data for ${toIcao}. Try a major airport.` });

        const fromLat = fromMet[0].lat, fromLon = fromMet[0].lon;
        const toLat   = toMet[0].lat,   toLon   = toMet[0].lon;

        const NUM_SEGMENTS = 6;
        const waypoints = Array.from({ length: NUM_SEGMENTS + 1 }, (_, i) => {
            const t = i / NUM_SEGMENTS;
            return {
                index: i, fraction: t,
                lat: fromLat + t * (toLat - fromLat),
                lon: fromLon + t * (toLon - fromLon),
                label: i === 0 ? fromIcao : i === NUM_SEGMENTS ? toIcao : `WP${i}`,
            };
        });

        const totalDistNm = Math.round(fpHaversineKm(fromLat, fromLon, toLat, toLon) * 0.539957);
        const routeBearing = fpCalcBearing(fromLat, fromLon, toLat, toLon);

        const pad = 3;
        const bbox = `${Math.min(fromLat,toLat)-pad},${Math.min(fromLon,toLon)-pad},${Math.max(fromLat,toLat)+pad},${Math.max(fromLon,toLon)+pad}`;

        const [metarStations, aloftRaw] = await Promise.all([
            fetch(`${AWC}/metar?bbox=${bbox}&format=json`, { headers: HDRS }).then(r => r.ok ? r.json() : []).catch(() => []),
            fetch(`${AWC}/windtemp?region=all&level=low&fcst=06&format=raw`, { headers: HDRS }).then(r => r.ok ? r.text() : '').catch(() => ''),
        ]);

        const aloftMap = new Map();
        for (const line of aloftRaw.split('\n')) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 5 && /^[A-Z]{3}$/.test(parts[0])) {
                aloftMap.set(parts[0], {
                    '3k':  fpParseLvl(parts[1]),
                    '6k':  fpParseLvl(parts[2]),
                    '9k':  fpParseLvl(parts[3]),
                    '12k': fpParseLvl(parts[4]),
                    '18k': parts[5] ? fpParseLvl(parts[5]) : null,
                });
            }
        }

        const merged = metarStations
            .filter(m => m.lat != null && m.lon != null)
            .map(m => ({ ...m, aloft: aloftMap.get((m.icaoId || '').replace(/^K/, '')) || null }));

        const waypointData = waypoints.map(wp => {
            let nearestMetar = null, nearestDistKm = Infinity;
            let bestAloft    = null, bestAloftKm   = Infinity;
            for (const st of merged) {
                const d = fpHaversineKm(wp.lat, wp.lon, st.lat, st.lon);
                if (d < nearestDistKm) { nearestDistKm = d; nearestMetar = st; }
                if (st.aloft && d < bestAloftKm) { bestAloftKm = d; bestAloft = st; }
            }
            const ceiling = nearestMetar ? fpGetCeiling(nearestMetar) : null;
            const visSM   = nearestMetar?.visib ?? 10;
            const wxStr   = nearestMetar?.wxString || nearestMetar?.wxstring || '';
            return {
                ...wp,
                distFromDep: Math.round(totalDistNm * wp.fraction),
                nearestStation: nearestMetar?.icaoId || null,
                nearestStationDistNm: Math.round(nearestDistKm * 0.539957),
                surface: nearestMetar ? {
                    windDir:  nearestMetar.wdir ?? null,
                    windSpeed: nearestMetar.wspd ?? null,
                    windGust:  nearestMetar.wgst ?? null,
                    temp:      nearestMetar.temp ?? null,
                    dewpoint:  nearestMetar.dewp ?? null,
                    visibility: visSM,
                    ceiling,
                    wxString: wxStr,
                    precip: fpParsePrecip(wxStr),
                    flightCategory: fpFlightCategory(ceiling, visSM),
                } : null,
                aloft: bestAloft?.aloft || null,
            };
        });

        res.json({
            from: { icao: fromIcao, lat: fromLat, lon: fromLon },
            to:   { icao: toIcao,   lat: toLat,   lon: toLon   },
            route: { distanceNm: totalDistNm, bearing: routeBearing },
            departureTime: time,
            waypoints: waypointData,
            altitudeRecommendation: fpComputeAltitudeRecommendation(routeBearing, totalDistNm, waypointData),
            fetchedAt: new Date().toISOString(),
        });
    } catch (e) {
        console.error('[flightpath]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Static files + React Router fallback
app.use(express.static(path.join(__dirname, 'dist')));
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`AeroGuard Multi-Agent Backend running on port ${PORT}`);
});
