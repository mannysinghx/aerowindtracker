import { GoogleGenerativeAI } from '@google/generative-ai';
import { kv } from '@vercel/kv';
import { fetchMETARs, fetchAloft, fetchPireps, generateAlerts } from './_wx.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MISSING_KEY');

const KV_DATA_KEY = 'wx:data';
const KV_DATA_EX  = 600; // 10-min TTL — outlasts one METAR cycle gap
const CACHE_TTL   = 5 * 60 * 1000;

let cache = null;
let lastFetchTime = 0;

async function kvGet(key) {
  try { return await kv.get(key); } catch { return null; }
}
async function kvSet(key, value, ex) {
  try { await kv.set(key, value, { ex }); } catch { /* KV unavailable */ }
}

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

// Exported so api/refresh.js (cron) can call it directly to pre-populate KV.
export async function buildWeatherData() {
  const [ground, aloft, pirepRaw] = await Promise.all([
    fetchMETARs(),
    fetchAloft(),
    fetchPireps(),
  ]);

  const alerts = generateAlerts(ground);
  const aiParsedPireps = await parseSeverePireps(pirepRaw);

  const data = { ground, aloft, alerts, pireps: aiParsedPireps, lastUpdated: new Date().toISOString() };
  await kvSet(KV_DATA_KEY, JSON.stringify(data), KV_DATA_EX);
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const now = Date.now();

  // L1: in-memory (warm container, instant)
  if (cache && (now - lastFetchTime < CACHE_TTL)) {
    return res.status(200).json(cache);
  }

  // L2: KV (pre-populated by cron — survives cold starts, cross-container)
  const kvRaw = await kvGet(KV_DATA_KEY);
  if (kvRaw) {
    try {
      const parsed = typeof kvRaw === 'string' ? JSON.parse(kvRaw) : kvRaw;
      cache = parsed;
      lastFetchTime = now;
      return res.status(200).json(parsed);
    } catch { /* corrupted — fall through to live fetch */ }
  }

  // L3: Live fetch (first cold start before cron has run)
  try {
    const data = await buildWeatherData();
    cache = data;
    lastFetchTime = now;
    res.status(200).json(data);
  } catch (e) {
    console.error('Data fetch error:', e);
    if (cache) return res.status(200).json(cache); // serve stale if available
    res.status(500).json({ error: 'Internal Server Error syncing AI telemetry.' });
  }
}
