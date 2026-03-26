const BBOXES = [
  "24.0,-90.0,35.0,-75.0",
  "35.0,-90.0,49.0,-75.0",
  "24.0,-105.0,35.0,-90.0",
  "35.0,-105.0,49.0,-90.0",
  "30.0,-125.0,40.0,-105.0",
  "40.0,-125.0,49.0,-105.0"
];

function generateAlerts(ground) {
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

  return alerts.sort((a, b) => b.severity === 'HIGH' ? -1 : 1);
}

function parseLvl(str) {
  if (!str || str.length < 4) return null;
  let dir = parseInt(str.substring(0, 2)) * 10;
  let spd = parseInt(str.substring(2, 4));
  if (isNaN(dir) || isNaN(spd)) return null;
  if (dir >= 500) { dir -= 500; spd += 100; }
  let t = null;
  if (str.length >= 6) {
    const sign = str[4];
    const digits = str.substring(5, 7);
    if (sign === '+' || sign === '-') {
      t = parseInt(digits);
      if (!isNaN(t) && sign === '-') t = -t;
    } else {
      t = -Math.abs(parseInt(str.substring(4, 6)));
    }
  }
  return { windDir: dir, windSpeed: spd, temp: t };
}

async function fetchAloftDirect() {
  try {
    const raw = await fetch('/wx/api/data/windtemp?region=all&level=low&fcst=06&format=raw')
      .then(r => r.ok ? r.text() : '')
      .catch(() => '');
    if (!raw) return [];

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
            '18k': parseLvl(parts[5])
          }
        });
      }
    }
    return aloft;
  } catch (e) {
    return [];
  }
}

async function fetchMetarDirect() {
  // Use /wx proxy (Vite rewrites to aviationweather.gov server-side, bypassing CORS)
  const promises = BBOXES.map(box =>
    fetch(`/wx/api/data/metar?bbox=${box}&format=json`)
      .then(r => r.ok ? r.json() : [])
      .catch(() => [])
  );
  const results = await Promise.all(promises);

  let ground = [];
  results.forEach(r => { if (Array.isArray(r)) ground = ground.concat(r); });

  // Deduplicate, same logic as server.js
  const unique = [];
  const seen = new Set();
  for (const s of ground) {
    if (!seen.has(s.icaoId) && s.lat && s.lon && s.wspd !== null) {
      seen.add(s.icaoId);
      unique.push(s);
    }
  }
  return unique;
}

export async function fetchLiveAIData() {
  // Primary: backend server (AI alerts, PIREP parsing, aloft wind data)
  try {
    const res = await fetch('/api/data');
    if (res.ok) return await res.json();
  } catch (e) { /* server unavailable, fall through */ }

  // Fallback: fetch METAR directly from aviationweather.gov
  // This gives wind barbs on the map even without the Express server running
  try {
    console.log("Server unavailable — fetching METAR & WINDTEMP directly from aviationweather.gov");
    const [ground, aloft] = await Promise.all([fetchMetarDirect(), fetchAloftDirect()]);
    return {
      ground,
      aloft,
      alerts: generateAlerts(ground),
      pireps: [],
      lastUpdated: new Date().toISOString()
    };
  } catch (e) {
    console.error("Direct METAR fetch also failed:", e);
    return null;
  }
}
