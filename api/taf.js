/**
 * Vercel Serverless Function: /api/taf
 *
 * GET /api/taf?icao=KSEA
 *
 * Fetches the TAF (Terminal Aerodrome Forecast) for a given airport from
 * aviationweather.gov and returns parsed forecast periods with flight categories.
 *
 * Cache: Vercel KV at wx:taf:{ICAO} with 20-minute TTL.
 */

import { kv } from '@vercel/kv';

const KV_TTL = 1200; // 20 minutes

async function kvGet(key) {
  try { return await kv.get(key); } catch { return null; }
}
async function kvSet(key, value, ex) {
  try { await kv.set(key, value, { ex }); } catch { /* KV unavailable in local dev */ }
}

function flightCategory(ceilingFt, visSM) {
  if (ceilingFt < 500 || visSM < 1) return 'LIFR';
  if (ceilingFt < 1000 || visSM < 3) return 'IFR';
  if (ceilingFt < 3000 || visSM < 5) return 'MVFR';
  return 'VFR';
}

function parsePeriod(fc) {
  // Extract lowest BKN/OVC ceiling (JSON API returns base already in feet)
  let ceilingFt = Infinity;
  if (Array.isArray(fc.clouds)) {
    for (const layer of fc.clouds) {
      if ((layer.cover === 'BKN' || layer.cover === 'OVC') && layer.base != null) {
        const ft = layer.base;
        if (ft < ceilingFt) ceilingFt = ft;
      }
    }
  }

  // Visibility — aviationweather.gov returns it as a string like "6" or "1/2"
  let visSM = 10;
  if (fc.visib != null) {
    const v = parseFloat(fc.visib);
    if (!isNaN(v)) visSM = v;
    // Handle fractional SM values encoded as decimals (e.g. 0.5 = ½ SM)
  }

  const cat = flightCategory(ceilingFt === Infinity ? 9999 : ceilingFt, visSM);

  return {
    timeFrom: fc.timeFrom,
    timeTo: fc.timeTo,
    type: fc.fcstType || fc.type || 'FM',
    windDir: fc.wdir ?? null,
    windSpeed: fc.wspd ?? null,
    windGust: fc.wgst ?? null,
    windVariable: fc.wdir === 0 && fc.wspd === 0,
    visibility: visSM >= 10 ? '10+' : String(visSM),
    ceiling: ceilingFt === Infinity ? 'Unlimited' : `${ceilingFt.toLocaleString()} ft`,
    ceilingFt: ceilingFt === Infinity ? null : ceilingFt,
    weather: fc.wxString || '',
    clouds: (fc.clouds || []).map(c => `${c.cover}${c.base != null ? c.base : ''}`).join(' '),
    flightCategory: cat,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  let icao = (req.query.icao || '').toUpperCase().trim();
  if (!icao) return res.status(400).json({ error: 'icao required' });
  // Normalise 3-letter FAA codes to 4-letter ICAO (SEA → KSEA)
  if (icao.length === 3 && /^[A-Z]{3}$/.test(icao)) icao = 'K' + icao;

  // L2 KV cache
  const cacheKey = `wx:taf:${icao}`;
  const cached = await kvGet(cacheKey);
  if (cached) {
    const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
    return res.status(200).json({ ...data, fromCache: true });
  }

  try {
    const url = `https://aviationweather.gov/api/data/taf?ids=${icao}&format=json`;
    const raw = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'AeroWindTracker/1.0' }
    }).then(r => r.ok ? r.json() : null).catch(() => null);

    if (!raw || !Array.isArray(raw) || raw.length === 0) {
      return res.status(404).json({ error: 'No TAF available', icao });
    }

    const taf = raw[0];
    const forecast = (taf.fcsts || []).map(parsePeriod);

    const result = {
      icao,
      rawText: taf.rawTAF || '',
      issueTime: taf.issueTime,
      validFrom: taf.validTimeFrom,
      validTo: taf.validTimeTo,
      forecast,
      fetchedAt: new Date().toISOString(),
    };

    await kvSet(cacheKey, JSON.stringify(result), KV_TTL);
    return res.status(200).json(result);
  } catch (e) {
    console.error('[taf] error:', e);
    return res.status(500).json({ error: e.message, icao });
  }
}
