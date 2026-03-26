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
                        const ft = l.base * 100;
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
                clouds: (fc.clouds || []).map(c => `${c.cover}${c.base != null ? c.base * 100 : ''}`).join(' '),
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
        const notams = (faaData.notamList || []).map((n, i) => {
            const text = n.notamDescription || n.icaoMessage || n.traditionalMessage || '';
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

// Static files + React Router fallback
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`AeroGuard Multi-Agent Backend running on port ${PORT}`);
});
