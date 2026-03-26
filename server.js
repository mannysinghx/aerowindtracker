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
app.use(express.json()); // Enable JSON body parsing

const AI_AGENT = {
    name: 'AeroGuard AI',
    role: 'Aviation Safety & Anomaly Detection'
};

let cache = {
    ground: [],
    aloft: [],
    alerts: [],
    lastUpdated: null
};

const BBOXES = [
  "24.0,-90.0,35.0,-75.0",   // SE
  "35.0,-90.0,49.0,-75.0",   // NE
  "24.0,-105.0,35.0,-90.0",  // S-Mid
  "35.0,-105.0,49.0,-90.0",  // N-Mid
  "30.0,-125.0,40.0,-105.0", // SW
  "40.0,-125.0,49.0,-105.0"  // NW
];

async function generateAIAlerts(ground) {
    const alerts = [];
    
    // 1. High Winds / Microburst detection
    const severeWinds = ground.filter(s => s.wspd >= 35 || s.wgst >= 45);
    for (const w of severeWinds.slice(0, 10)) { // limit alerts
        alerts.push({
            id: `WIND-${w.icaoId}-${Date.now()}`,
            type: 'SEVERE_WIND',
            location: w.icaoId,
            message: `URGENT: ${AI_AGENT.name} detected sustained winds of ${w.wspd}kts (gusting ${w.wgst || 'N/A' + 'kts'}) at ${w.icaoId}. Microburst or frontal boundary likely.`,
            severity: 'HIGH'
        });
    }

    // 2. Sudden Fog / Low Visibility detection
    const fogRisks = ground.filter(s => s.temp !== null && s.dewp !== null && (s.temp - s.dewp) <= 2 && (s.temp - s.dewp) >= 0 && s.wspd < 10);
    for (const f of fogRisks.slice(0, 5)) {
        alerts.push({
            id: `FOG-${f.icaoId}-${Date.now()}`,
            type: 'VISIBILITY',
            location: f.icaoId,
            message: `NOTICE: ${AI_AGENT.name} predicts imminent fog formation at ${f.icaoId}. Temp/Dew spread is critical (${f.temp}°C / ${f.dewp}°C) with calm winds.`,
            severity: 'MEDIUM'
        });
    }

    alerts.push({
         id: `SYS-${Date.now()}`,
         type: 'SYSTEM',
         location: 'GLOBAL',
         message: `${AI_AGENT.name} active. Analyzing ${ground.length} remote weather stations autonomously.`,
         severity: 'INFO'
    });

    return alerts.sort((a,b) => b.severity === 'HIGH' ? -1 : 1);
}

async function parseSeverePireps(pireps) {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MISSING_KEY') {
        return []; 
    }
    
    // Extract severe or urgent (UUA) PIREPs
    const severePireps = pireps.filter(p => p.rawOb && (p.rawOb.includes('SEV') || p.rawOb.includes('MOD-SEV') || p.rawOb.includes('UUA'))).slice(0, 5);
    if (severePireps.length === 0) return [];

    const prompt = `You are an expert aviation AI. Analyze the following raw PIREPs (Pilot Reports).
Return a raw JSON array of objects with these exact keys: 
- id (string, generate a unique ID like PIREP-123)
- type ("TURBULENCE", "ICING", or "OTHER")
- lat (number, use exact provided)
- lon (number, use exact provided)
- severity ("SEVERE" or "MODERATE")
- description (A clear, plain-english 1-sentence translation of the report)
- altitude (string, e.g., "FL350")

Raw PIREPs:
${JSON.stringify(severePireps.map((p, i) => ({ raw: p.rawOb, lat: p.lat, lon: p.lon })))}

Respond ONLY with a valid JSON array. Do not include markdown formatting, backticks, or other text.`;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        let text = result.response.text();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (err) {
        console.error("PIREP LLM Parsing Error:", err);
        return [];
    }
}

async function fetchAllData() {
    console.log(`[${new Date().toISOString()}] Agent autonomously fetching global data...`);
    try {
        const groundPromises = BBOXES.map(box => 
           fetch(`https://aviationweather.gov/api/data/metar?bbox=${box}&format=json`)
           .then(r => r.json())
           .catch(() => [])
        );
        const groundResults = await Promise.all(groundPromises);
        let ground = [];
        groundResults.forEach(res => { if(Array.isArray(res)) ground = ground.concat(res); });
        
        const uniqueGround = [];
        const seen = new Set();
        for (const s of ground) {
            if (!seen.has(s.icaoId) && s.lat && s.lon && s.wspd !== null) {
                seen.add(s.icaoId);
                uniqueGround.push(s);
            }
        }

        const aloftRaw = await fetch('https://aviationweather.gov/api/data/windtemp?region=all&level=low&fcst=06&format=raw').then(r => r.text()).catch(() => "");
        
        const aloft = [];
        const lines = aloftRaw.split('\n');
        for (const line of lines) {
             if (line.trim().length > 30 && !line.includes('FT') && !line.includes('VALID')) {
                const icaoId = line.substring(0, 3).trim();
                const parseLvl = (str) => {
                    const s = str.trim();
                    if (!s || s.length < 4) return null;
                    let dir = parseInt(s.substring(0, 2)) * 10;
                    let spd = parseInt(s.substring(2, 4));
                    if (dir >= 500) { dir -= 500; spd += 100; }
                    let t = s.length >= 6 ? parseInt(s.substring(4, 6)) : null;
                    if (t !== null && s.includes('-')) t = -t;
                    return { windDir: dir, windSpeed: spd, temp: t };
                }
                aloft.push({
                   icaoId: 'K' + icaoId,
                   levels: {
                       '3k': parseLvl(line.substring(4, 9)),
                       '6k': parseLvl(line.substring(9, 17)),
                       '9k': parseLvl(line.substring(17, 24)),
                       '12k': parseLvl(line.substring(24, 31)),
                       '18k': parseLvl(line.substring(31, 38))
                   }
                });
             }
        }

        const alerts = await generateAIAlerts(uniqueGround);
        
        // Fetch and Parse PIREPs via LLM Agent
        const pirepRaw = await fetch('https://aviationweather.gov/api/data/aircraftreport?format=json').then(r => r.json()).catch(() => []);
        const aiParsedPireps = await parseSeverePireps(pirepRaw);

        cache = {
            ground: uniqueGround,
            aloft,
            alerts,
            pireps: aiParsedPireps,
            lastUpdated: new Date().toISOString()
        };
        console.log(`[${new Date().toISOString()}] Agent data ingestion & LLM parsing complete.`);

    } catch (e) {
        console.error("Agent ingestion error:", e);
    }
}

fetchAllData();
setInterval(fetchAllData, 5 * 60 * 1000); 

app.get('/api/data', (req, res) => {
    res.json(cache);
});

// Mock Vercel KV endpoint for local testing
app.post('/api/tracking', (req, res) => {
    console.log(`[KV Mock] Saved tracking data for user: ${req.body.userId}`);
    res.json({ success: true, message: 'Tracking data recorded (mocked locally)' });
});

// Mock Vercel AI Chat endpoint for local testing
app.post('/api/chat', (req, res) => {
    res.json({ reply: `[Local Mock AI] Received your message: "${req.body.message}". In production this uses Gemini with context: ${req.body.context?.id || 'none'}` });
});

// Host Vite's compiled static dist payload
app.use(express.static(path.join(__dirname, 'dist')));

// Intercept routing errors, forwarding UI to React Router 
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`AI Backend running on port ${PORT}`);
});
