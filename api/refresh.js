/**
 * Vercel Cron Job: /api/refresh
 *
 * Runs every 5 minutes (see vercel.json → crons).
 * Pre-populates Vercel KV with fresh weather data and agent results so that
 * every user request is served from the DB cache (sub-100 ms) rather than
 * triggering a live fetch to aviationweather.gov or a Gemini LLM call.
 *
 * Cache keys written:
 *   wx:data       — METARs, aloft, PIREPs, alerts  (TTL 10 min)
 *   agents:cache  — WindAgent / HazardAgent / TrendAgent / BriefingAgent (TTL 10 min)
 *   agents:prev_ground — compact METAR snapshot for TrendAgent delta (TTL 10 min)
 *
 * Security: Vercel injects  Authorization: Bearer <CRON_SECRET>  on cron requests.
 * Set CRON_SECRET in Vercel project settings → Environment Variables.
 */

import { kv } from '@vercel/kv';
import { buildWeatherData } from './data.js';
import { runAgents } from './agents.js';

const KV_AGENTS_KEY = 'agents:cache';
const KV_AGENTS_EX  = 600; // 10 min

async function kvSet(key, value, ex) {
  try { await kv.set(key, value, { ex }); } catch { /* KV unavailable */ }
}

export default async function handler(req, res) {
  // Only accept GET (Vercel cron) or explicit POST (manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).end();
  }

  // Verify Vercel cron secret — skip check if CRON_SECRET not set (dev/staging)
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const started = Date.now();
  const results = {};

  // ── 1. Refresh weather data ─────────────────────────────────────────────────
  // buildWeatherData() fetches METARs + aloft + PIREPs, parses with Gemini,
  // generates alerts, and writes the result to KV key wx:data automatically.
  try {
    const data = await buildWeatherData();
    results.data = {
      ok: true,
      stations: data.ground?.length ?? 0,
      alerts: data.alerts?.length ?? 0,
      pireps: data.pireps?.length ?? 0,
    };
  } catch (e) {
    console.error('[refresh] weather data error:', e);
    results.data = { ok: false, error: e.message };
  }

  // ── 2. Refresh agent results ────────────────────────────────────────────────
  // runAgents() re-fetches live data, runs all 4 agents, persists prev_ground
  // for TrendAgent, and returns the full agent payload.
  try {
    const agents = await runAgents();
    await kvSet(KV_AGENTS_KEY, JSON.stringify(agents), KV_AGENTS_EX);
    results.agents = {
      ok: true,
      lastRun: agents.lastRun,
      windFindings: agents.agents?.wind?.findings?.length ?? 0,
      hazardFindings: agents.agents?.hazard?.findings?.length ?? 0,
    };
  } catch (e) {
    console.error('[refresh] agent error:', e);
    results.agents = { ok: false, error: e.message };
  }

  const elapsed = Date.now() - started;
  console.log(`[refresh] completed in ${elapsed}ms`, results);

  res.status(200).json({ ok: true, elapsed, refreshed: new Date().toISOString(), ...results });
}
