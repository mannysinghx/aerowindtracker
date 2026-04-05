/**
 * Shared weather data utilities for Vercel serverless functions.
 * Files starting with _ are not treated as API routes by Vercel.
 */

export const BBOXES = [
  "24.0,-90.0,35.0,-75.0",   // SE
  "35.0,-90.0,49.0,-75.0",   // NE
  "24.0,-105.0,35.0,-90.0",  // S-Mid
  "35.0,-105.0,49.0,-90.0",  // N-Mid
  "30.0,-125.0,40.0,-105.0", // SW
  "40.0,-125.0,49.0,-105.0", // NW
];

/** Parse a single winds-aloft encoded level string (e.g. "2735-08"). */
export function parseLvl(str) {
  if (!str || str.length < 4) return null;
  let dir = parseInt(str.substring(0, 2)) * 10;
  let spd = parseInt(str.substring(2, 4));
  if (isNaN(dir) || isNaN(spd)) return null;
  if (dir >= 500) { dir -= 500; spd += 100; } // 100+ kt encoded as dir+500
  let t = null;
  if (str.length >= 6) {
    const sign = str[4];
    if (sign === '+' || sign === '-') {
      t = parseInt(str.substring(5, 7));
      if (!isNaN(t) && sign === '-') t = -t;
    } else {
      t = -Math.abs(parseInt(str.substring(4, 6)));
    }
  }
  return { windDir: dir, windSpeed: spd, temp: t };
}

/** Fetch and deduplicate METARs across all 6 continental US bounding boxes. */
export async function fetchMETARs() {
  const results = await Promise.all(
    BBOXES.map(box => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      return fetch(`https://aviationweather.gov/api/data/metar?bbox=${box}&format=json`, {
        headers: { 'User-Agent': 'AeroWindTracker/1.0', 'Accept': 'application/json' },
        signal: ctrl.signal,
      })
        .then(r => { clearTimeout(timer); return r.ok ? r.json() : (console.error('[_wx] METAR bbox', box, 'status', r.status), []); })
        .catch(e => { clearTimeout(timer); console.error('[_wx] METAR bbox', box, 'error', e.message); return []; });
    })
  );
  let ground = [];
  results.forEach(r => { if (Array.isArray(r)) ground = ground.concat(r); });
  const seen = new Set();
  const unique = [];
  for (const s of ground) {
    if (!seen.has(s.icaoId) && s.lat && s.lon && s.wspd != null) {
      seen.add(s.icaoId);
      unique.push(s);
    }
  }
  return unique;
}

/** Fetch and parse winds-aloft data for 3k–18k ft. */
export async function fetchAloft() {
  const raw = await fetch('https://aviationweather.gov/api/data/windtemp?region=all&level=low&fcst=06&format=raw')
    .then(r => r.text()).catch(() => '');
  const aloft = [];
  for (const line of raw.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 6 && /^[A-Z]{3}$/.test(parts[0])) {
      aloft.push({
        icaoId: 'K' + parts[0],
        levels: {
          '3k':  parseLvl(parts[1]),
          '6k':  parseLvl(parts[2]),
          '9k':  parseLvl(parts[3]),
          '12k': parseLvl(parts[4]),
          '18k': parseLvl(parts[5]),
        }
      });
    }
  }
  return aloft;
}

/** Fetch raw PIREPs from aviationweather.gov. */
export async function fetchPireps() {
  return fetch('https://aviationweather.gov/api/data/aircraftreport?format=json')
    .then(r => r.json()).catch(() => []);
}

/** Severity sort order — HIGH first, INFO last. */
const SEV_ORDER = { HIGH: 0, MEDIUM: 1, INFO: 2 };

/** Sort alerts by severity (HIGH → MEDIUM → INFO). */
export function sortAlerts(alerts) {
  return alerts.sort((a, b) => (SEV_ORDER[a.severity] ?? 3) - (SEV_ORDER[b.severity] ?? 3));
}

/** Generate rule-based alerts for the SidebarLeft alert feed. */
export function generateAlerts(ground) {
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
  return sortAlerts(alerts);
}
