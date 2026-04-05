/**
 * Vercel Serverless Function: /api/airport
 *
 * GET /api/airport?icao=KPAE
 *
 * Returns airport details from OurAirports open data:
 *   - Elevation, city, state
 *   - Runway details (length, surface, lighting)
 *   - Communications frequencies (ATIS, Tower, Ground, CTAF/UNICOM, App/Dep, AWOS)
 *
 * Cache: Vercel KV at wx:apt:{ICAO} with 30-day TTL (airport data rarely changes).
 */

import { kv } from '@vercel/kv';

const KV_TTL = 60 * 60 * 24 * 30; // 30 days

async function kvGet(key) {
  try { return await kv.get(key); } catch { return null; }
}
async function kvSet(key, value, ex) {
  try { await kv.set(key, value, { ex }); } catch { /* KV unavailable in local dev */ }
}

// Parse a CSV line that may have quoted fields containing commas.
function parseCSVLine(line) {
  const cols = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cols.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
}

function col(cols, idx) {
  return (cols[idx] ?? '').trim();
}

// Civilian VHF aviation band: 108–136.975 MHz (nav + comm).
// Anything outside this range is military/HF/UHF — not useful for civilian pilots.
const MIN_CIVIL_MHZ = 108;
const MAX_CIVIL_MHZ = 137;

// Types that are never useful to civilian pilots — filter entirely.
const SKIP_TYPES = new Set(['MISC', 'PMSV', 'MIL', 'RMP', 'PTD', 'GTE', 'TML', 'COMD POST', 'ARTC']);

// Map OurAirports frequency type codes → friendly display labels.
const FREQ_TYPE_LABEL = {
  ATIS:    'ATIS',
  'D-ATIS':'D-ATIS',
  ASOS:    'ASOS',
  AWOS:    'AWOS',
  'AWOS-3':'AWOS',
  AWOS3:   'AWOS',
  AWIS:    'AWIS',
  CTAF:    'CTAF',
  'CTAF/UNICOM': 'CTAF',
  UNICOM:  'UNICOM',
  UNIC:    'UNICOM',
  UNI:     'UNICOM',
  GND:     'Ground',
  GROUND:  'Ground',
  GRN:     'Ground',
  GRD:     'Ground',
  TWR:     'Tower',
  TOWER:   'Tower',
  APP:     'Approach',
  APCH:    'Approach',
  APPR:    'Approach',
  'APP/DEP':  'App/Dep',
  'APP/RAD':  'Approach',
  'RAD/APP':  'Approach',
  'A/D':   'App/Dep',
  'APP/TWR':  'App/Twr',
  'TWR/APP':  'App/Twr',
  DEP:     'Departure',
  CLNC:    'Clnc Del',
  CLD:     'Clnc Del',
  CD:      'Clnc Del',
  DEL:     'Clnc Del',
  DELIVERY:'Clnc Del',
  CNTR:    'Center',
  CTR:     'Center',
  CENTER:  'Center',
  ACC:     'Area Ctrl',
  OPS:     'Operations',
  OPER:    'Operations',
  FSS:     'FSS',
  RCO:     'FSS',
  RDO:     'Radio',
  RADIO:   'Radio',
  'A/G':   'Air/Ground',
  INFO:    'Information',
  AFIS:    'Flight Info',
  ATF:     'Traffic Freq',
  EMR:     'Emergency',
  EMERG:   'Emergency',
  MULTICOM:'Multicom',
};

function freqLabel(type) {
  return FREQ_TYPE_LABEL[type.toUpperCase()] ?? FREQ_TYPE_LABEL[type] ?? type;
}

// Frequency display priority for sorting.
const FREQ_ORDER = [
  'ATIS', 'D-ATIS', 'ASOS', 'AWOS', 'AWOS3', 'AWIS',
  'CLD', 'CLNC', 'CD', 'DEL', 'DELIVERY',
  'GND', 'GROUND', 'GRN', 'GRD',
  'TWR', 'TOWER',
  'APP', 'APCH', 'APPR', 'A/D', 'APP/DEP',
  'DEP',
  'CTAF', 'UNICOM', 'UNIC',
  'CNTR', 'CTR', 'CENTER', 'ACC',
  'FSS', 'RCO',
  'RDO', 'RADIO', 'OPS', 'A/G', 'INFO',
];
function freqSortKey(type) {
  const idx = FREQ_ORDER.indexOf(type.toUpperCase());
  return idx === -1 ? 99 : idx;
}

// Map OurAirports airport type to a friendly label.
const TYPE_LABEL = {
  large_airport:  'Large Airport',
  medium_airport: 'Medium Airport',
  small_airport:  'Small Airport',
  closed:         'Closed',
};

function fetchCSV(url) {
  return fetch(url, {
    headers: { 'User-Agent': 'AeroWindTracker/1.0', Accept: 'text/plain' },
  }).then(r => {
    if (!r.ok) throw new Error(`CSV fetch failed: ${r.status}`);
    return r.text();
  });
}

async function lookupAirport(icao) {
  // Attempt to find the row in airports.csv where either
  //   - col[1] (ident, ICAO-style like "KPAE") matches, or
  //   - col[14] (local_code, like "PAE") matches.
  // We also accept bare 3-letter identifiers that can be found as "K{icao}".
  const targets = new Set([icao]);
  if (icao.startsWith('K') && icao.length === 4) targets.add(icao.slice(1)); // PAE
  if (icao.length === 3) targets.add('K' + icao);                            // PAE → KPAE

  const [airportsCsv, freqCsv, runwaysCsv] = await Promise.all([
    fetchCSV('https://davidmegginson.github.io/ourairports-data/airports.csv'),
    fetchCSV('https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv'),
    fetchCSV('https://davidmegginson.github.io/ourairports-data/runways.csv'),
  ]);

  // ── Parse airports.csv ────────────────────────────────────────────────
  // Columns: id, ident, type, name, lat, lon, elevation_ft, continent,
  //          iso_country, iso_region, municipality, scheduled_service,
  //          gps_code, iata_code, local_code, home_link, wikipedia_link, keywords
  let airportRow = null;
  let resolvedIdent = null;  // The ident (ICAO-style) used in frequencies/runways files

  for (const line of airportsCsv.split('\n')) {
    if (!line) continue;
    const c = parseCSVLine(line);
    const ident = col(c, 1);
    const localCode = col(c, 14);
    if (targets.has(ident) || targets.has(localCode)) {
      airportRow = c;
      resolvedIdent = ident; // frequencies CSV uses this ident
      break;
    }
  }

  if (!airportRow) return null;

  const elevRaw = col(airportRow, 6);
  const elevation_ft = elevRaw ? parseInt(elevRaw, 10) : null;
  const isoRegion = col(airportRow, 9);          // e.g. "US-WA"
  const state = isoRegion.includes('-') ? isoRegion.split('-')[1] : isoRegion;
  const city = col(airportRow, 10);
  const type = col(airportRow, 2);
  const scheduledService = col(airportRow, 11) === 'yes';

  // ── Parse airport-frequencies.csv ────────────────────────────────────
  // Columns: id, airport_ref, airport_ident, type, description, frequency_mhz
  const freqsByType = {};
  for (const line of freqCsv.split('\n')) {
    if (!line) continue;
    const c = parseCSVLine(line);
    if (col(c, 2) !== resolvedIdent) continue;
    const fType = col(c, 3).toUpperCase();
    const desc  = col(c, 4);
    const mhz   = parseFloat(col(c, 5));
    if (isNaN(mhz)) continue;
    // Skip non-civilian types and out-of-band frequencies
    if (SKIP_TYPES.has(fType)) continue;
    if (mhz < MIN_CIVIL_MHZ || mhz > MAX_CIVIL_MHZ) continue;
    const key = fType;
    if (!freqsByType[key]) freqsByType[key] = [];
    freqsByType[key].push({ type: freqLabel(fType), rawType: fType, description: desc, mhz });
  }

  const frequencies = Object.entries(freqsByType)
    .sort(([a], [b]) => freqSortKey(a) - freqSortKey(b))
    .flatMap(([, list]) => list);

  // ── Parse runways.csv ────────────────────────────────────────────────
  // Columns (0-indexed): id, airport_ref, airport_ident, length_ft, width_ft,
  //   surface, lighted, closed, le_ident, le_latitude, le_longitude,
  //   le_elevation, le_heading, le_displaced_threshold, he_ident, he_latitude,
  //   he_longitude, he_elevation, he_heading, he_displaced_threshold
  const runways = [];
  for (const line of runwaysCsv.split('\n')) {
    if (!line) continue;
    const c = parseCSVLine(line);
    if (col(c, 2) !== resolvedIdent) continue;
    if (col(c, 7) === '1') continue; // closed
    const length = parseInt(col(c, 3), 10) || null;
    const width  = parseInt(col(c, 4), 10) || null;
    const surface = col(c, 5) || null;
    const lighted = col(c, 6) === '1';
    const le_ident  = col(c, 8)  || null;
    const le_heading = parseFloat(col(c, 12)) || null;
    const he_ident  = col(c, 14) || null;
    const he_heading = parseFloat(col(c, 18)) || null;
    runways.push({ le_ident, he_ident, length, width, surface, lighted, le_heading, he_heading });
  }

  return {
    icao,
    ident: resolvedIdent,
    name: col(airportRow, 3),
    type: TYPE_LABEL[type] ?? type,
    scheduledService,
    city,
    state,
    elevation_ft: isNaN(elevation_ft) ? null : elevation_ft,
    lat: parseFloat(col(airportRow, 4)) || null,
    lon: parseFloat(col(airportRow, 5)) || null,
    iataCode: col(airportRow, 13) || null,
    frequencies,
    runways,
    fetchedAt: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const icao = (req.query.icao || '').toUpperCase().trim();
  if (!icao) return res.status(400).json({ error: 'icao required' });

  const cacheKey = `wx:apt:${icao}`;
  const cached = await kvGet(cacheKey);
  if (cached) {
    const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
    return res.status(200).json({ ...data, fromCache: true });
  }

  try {
    const data = await lookupAirport(icao);
    if (!data) return res.status(404).json({ error: 'Airport not found', icao });
    await kvSet(cacheKey, JSON.stringify(data), KV_TTL);
    return res.status(200).json(data);
  } catch (e) {
    console.error('[airport] error:', e);
    return res.status(500).json({ error: e.message, icao });
  }
}
