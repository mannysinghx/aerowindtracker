/**
 * Lightweight lat/lon → IANA timezone lookup.
 * Covers North America with reasonable accuracy; falls back to UTC elsewhere.
 * Not perfect for edge cases (AZ, IN, parts of ID/ND), but covers >95% of airports.
 */
export function getTimezoneFromLatLon(lat, lon) {
  // Hawaii
  if (lat < 25 && lon < -140) return 'Pacific/Honolulu';
  // Alaska (mainland + Aleutians split)
  if (lat > 51 && lon < -141) return 'Pacific/Honolulu'; // Aleutians west of 141°W
  if (lon < -130 && lat > 51) return 'America/Anchorage';

  // Continental US / Canada
  if (lat >= 24 && lat <= 72 && lon >= -141 && lon <= -52) {
    // Atlantic Canada (NS, NB, PEI, NL eastern)
    if (lon > -63) return 'America/Halifax';
    // Eastern
    if (lon > -87.5) return 'America/New_York';
    // Central
    if (lon > -101.5) return 'America/Chicago';
    // Mountain
    if (lon > -116) return 'America/Denver';
    // Pacific
    if (lon > -130) return 'America/Los_Angeles';
    return 'America/Anchorage';
  }

  // Rough international coverage
  if (lon >= -30 && lon < 0) return 'Atlantic/Azores';
  if (lon >= 0 && lon < 15) return 'Europe/London';
  if (lon >= 15 && lon < 22.5) return 'Europe/Paris';
  if (lon >= 22.5 && lon < 37.5) return 'Europe/Helsinki';
  if (lon >= 37.5 && lon < 52.5) return 'Asia/Dubai';
  if (lon >= 52.5 && lon < 67.5) return 'Asia/Karachi';
  if (lon >= 67.5 && lon < 82.5) return 'Asia/Kolkata';
  if (lon >= 82.5 && lon < 97.5) return 'Asia/Bangkok';
  if (lon >= 97.5 && lon < 112.5) return 'Asia/Shanghai';
  if (lon >= 112.5 && lon < 127.5) return 'Asia/Tokyo';
  if (lon >= 127.5 && lon < 142.5) return 'Asia/Tokyo';
  if (lon >= 142.5 && lon < 157.5) return 'Pacific/Port_Moresby';
  if (lon >= 157.5 || lon < -157.5) return 'Pacific/Auckland';

  return 'UTC';
}

/**
 * Format a Date to local airport time, returning e.g. "14:30 MDT"
 */
export function fmtLocalTime(date, timezone) {
  if (!date || isNaN(date)) return '—';
  try {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: timezone, timeZoneName: 'short',
    }).replace(',', '');
  } catch {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: 'UTC', timeZoneName: 'short',
    }).replace(',', '');
  }
}

/**
 * Format a NOTAM date string (YYMMDDHHMM) to readable local time.
 * e.g. "2603291330" → "Mar 29, 2026 13:30 UTC" or local.
 */
export function parseNotamDate(str, timezone) {
  if (!str) return null;
  const s = str.trim();
  if (s === 'PERM') return 'Permanent';
  // Strip trailing timezone suffix like EST, CST, etc.
  const cleaned = s.replace(/[A-Z]+$/, '').trim();
  // YYMMDDHHMM format
  const m = cleaned.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!m) return s;
  const [, yy, mo, dd, hh, mm] = m;
  const year = 2000 + parseInt(yy);
  const date = new Date(Date.UTC(year, parseInt(mo) - 1, parseInt(dd), parseInt(hh), parseInt(mm)));
  if (isNaN(date)) return s;
  try {
    const local = date.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: timezone || 'UTC', timeZoneName: 'short',
    });
    return local;
  } catch {
    return date.toUTCString().replace(' GMT', 'Z');
  }
}
