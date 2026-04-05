/**
 * Vercel Serverless Function: /api/notams
 *
 * GET /api/notams?icao=KSEA
 *
 * Fetches active NOTAMs for an airport from the FAA NOTAM search API,
 * then uses Gemini to produce a 2-sentence AI digest summarising the
 * most operationally significant items for pilots.
 *
 * Cache: Vercel KV at wx:notams:{ICAO} with 30-minute TTL.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { kv } from '@vercel/kv';

const KV_TTL = 1800; // 30 minutes
const NOTAM_SEARCH_URL = 'https://notams.aim.faa.gov/notamSearch/search';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MISSING_KEY');

async function kvGet(key) {
  try { return await kv.get(key); } catch { return null; }
}
async function kvSet(key, value, ex) {
  try { await kv.set(key, value, { ex }); } catch { /* KV unavailable */ }
}

// Map FAA NOTAM keyword to a display category
function categorise(keyword = '', text = '') {
  const kw = keyword.toUpperCase();
  const tx = text.toUpperCase();
  if (/^(RWY|RUNWAY)/.test(kw) || /RWY\s+\d/.test(tx)) return 'Runway';
  if (/^(TWY|TAXIWAY|APRON)/.test(kw)) return 'Taxiway/Apron';
  if (/^(NAV|ILS|VOR|VORTAC|NDB|LOC|GP|DME|TACAN)/.test(kw)) return 'Navigation';
  if (/^(COM|ATIS|ASOS|AWOS)/.test(kw)) return 'Communications';
  if (/^(OBST|OBSTACLE|CRANE|TOWER)/.test(kw)) return 'Obstacle';
  if (/^(AIRSPACE|TFR|MOA|SUA|RESTRICTED|WARNING)/.test(kw)) return 'Airspace';
  if (/^(SVC|SERVICE|FUEL|AVGAS|JET)/.test(kw)) return 'Services';
  return 'General';
}

async function fetchNotamsFromFAA(icao) {
  const body = new URLSearchParams({
    searchType: '0',
    designatorsForLocation: icao,
    notamsOnly: 'false',
    domesticOrInternational: 'Domestic',
    offset: '0',
  });

  const res = await fetch(NOTAM_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'AeroWindTracker/1.0',
    },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`FAA NOTAM search returned ${res.status}`);
  return res.json();
}

async function generateDigest(icao, notams) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MISSING_KEY') {
    return notams.length === 0
      ? `No active NOTAMs found for ${icao}.`
      : `${notams.length} active NOTAM${notams.length > 1 ? 's' : ''} at ${icao}. Review items below before departure.`;
  }

  if (notams.length === 0) return `No active NOTAMs found for ${icao} at this time.`;

  const sample = notams.slice(0, 10).map(n => n.text).join('\n');

  const prompt = `You are AeroGuard AI, an expert aviation dispatcher.
Summarise the following NOTAMs for ${icao} in 1-2 sentences for a pilot about to depart.
Lead with the most operationally critical item (runway closures, navigation outages, TFRs).
Be concise and use aviation terminology. Do not list every item — synthesise the key hazards.

NOTAMs:
${sample}

Reply with the digest only. No bullet points, no markdown.`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch {
    return `${notams.length} NOTAM${notams.length !== 1 ? 's' : ''} active at ${icao}. Review items below.`;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  let icao = (req.query.icao || '').toUpperCase().trim();
  if (!icao) return res.status(400).json({ error: 'icao required' });
  // Normalise 3-letter FAA codes to 4-letter ICAO (SEA → KSEA)
  if (icao.length === 3 && /^[A-Z]{3}$/.test(icao)) icao = 'K' + icao;

  // L2 KV cache
  const cacheKey = `wx:notams:${icao}`;
  const cached = await kvGet(cacheKey);
  if (cached) {
    const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
    return res.status(200).json({ ...data, fromCache: true });
  }

  try {
    const faaData = await fetchNotamsFromFAA(icao);
    const rawList = faaData?.notamList || [];

    const stripHtml = s => s.replace(/<[^>]*>/g, '').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();

    const notams = rawList.map((n, i) => {
      const text = stripHtml(n.notamDescription || n.icaoMessage || n.traditionalMessage || '');
      const keyword = n.keyword || n.classification || '';
      return {
        id: n.id || `NOTAM-${i}`,
        category: categorise(keyword, text),
        keyword: keyword.toUpperCase(),
        text: text.trim(),
        location: n.icaoLocation || icao,
        effectiveStart: n.effectiveStart || null,
        effectiveEnd: n.effectiveEnd || null,
      };
    }).filter(n => n.text.length > 0);

    const digest = await generateDigest(icao, notams);

    const result = {
      icao,
      count: notams.length,
      digest,
      notams,
      fetchedAt: new Date().toISOString(),
    };

    await kvSet(cacheKey, JSON.stringify(result), KV_TTL);
    return res.status(200).json(result);
  } catch (e) {
    console.error('[notams] error:', e);
    return res.status(500).json({ error: e.message, icao });
  }
}
