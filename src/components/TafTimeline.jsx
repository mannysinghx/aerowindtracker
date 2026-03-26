import React, { useState } from 'react';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { fmtLocalTime } from '../utils/timezone';

const CAT_COLOR = {
  VFR:  { bg: '#10b981', text: '#fff', label: 'VFR' },
  MVFR: { bg: '#3b82f6', text: '#fff', label: 'MVFR' },
  IFR:  { bg: '#ef4444', text: '#fff', label: 'IFR' },
  LIFR: { bg: '#a855f7', text: '#fff', label: 'LIFR' },
};

const CAT_DESC = {
  VFR: 'Visual Flight Rules — good visibility and ceiling',
  MVFR: 'Marginal VFR — reduced visibility or ceiling',
  IFR: 'Instrument Flight Rules — low visibility or ceiling',
  LIFR: 'Low IFR — very poor visibility or ceiling',
};

const COMPASS = ['North','North-Northeast','Northeast','East-Northeast','East','East-Southeast',
  'Southeast','South-Southeast','South','South-Southwest','Southwest','West-Southwest',
  'West','West-Northwest','Northwest','North-Northwest'];

function compassDir(deg) {
  if (deg == null) return '';
  return COMPASS[Math.round(deg / 22.5) % 16];
}

const WX_CODES = {
  FZRA:'Freezing rain', FZDZ:'Freezing drizzle', TSGR:'Thunderstorm with hail',
  TSRA:'Thunderstorm with rain', TSSN:'Thunderstorm with snow', TSPL:'Thunderstorm with ice pellets',
  SHRA:'Rain showers', SHSN:'Snow showers', SHGR:'Hail showers', SHPL:'Ice pellet showers',
  BLSN:'Blowing snow', DRSN:'Drifting snow', DRDU:'Drifting dust', DRSA:'Drifting sand',
  MIFG:'Shallow fog', BCFG:'Patchy fog', PRFG:'Partial fog', FZFG:'Freezing fog',
  TS:'Thunderstorm', RA:'Rain', SN:'Snow', DZ:'Drizzle', GR:'Hail', PL:'Ice pellets',
  SG:'Snow grains', FG:'Fog', BR:'Mist', HZ:'Haze', FU:'Smoke', SA:'Sand', DU:'Dust',
  SH:'Showers', FC:'Funnel cloud / tornado', VA:'Volcanic ash', SQ:'Squall',
};

function decodeWx(wx) {
  if (!wx) return '';
  let s = wx;
  // Intensity prefix
  s = s.replace(/^\+/, 'Heavy ').replace(/^-/, 'Light ').replace(/^VC/, 'In vicinity — ');
  // Replace longest matches first
  const sorted = Object.entries(WX_CODES).sort((a, b) => b[0].length - a[0].length);
  for (const [code, desc] of sorted) {
    s = s.replace(new RegExp(code, 'g'), desc);
  }
  return s;
}

function decodePeriod(p) {
  const lines = [];
  // Wind
  if (p.windSpeed != null && p.windSpeed > 0) {
    const dir = p.windDir === 'VRB' || p.windDir === 0
      ? 'Variable direction'
      : `${compassDir(p.windDir)} (${p.windDir}°)`;
    const gust = p.windGust ? `, gusting to ${p.windGust} kt` : '';
    lines.push(`Wind: ${dir} at ${p.windSpeed} knots${gust}`);
  } else {
    lines.push('Wind: Calm');
  }
  // Visibility
  const vis = p.visibility === '10+' ? 'Greater than 10 statute miles' : `${p.visibility} statute miles`;
  lines.push(`Visibility: ${vis}`);
  // Ceiling
  if (p.ceiling === 'Unlimited') {
    lines.push('Ceiling: Unlimited — skies clear');
  } else {
    lines.push(`Ceiling: ${p.ceiling}`);
  }
  // Weather
  if (p.weather) lines.push(`Significant weather: ${decodeWx(p.weather)}`);
  // Cloud layers
  if (p.clouds) {
    const cloudMap = { SKC:'Sky clear', CLR:'Clear', FEW:'Few clouds', SCT:'Scattered clouds', BKN:'Broken ceiling', OVC:'Overcast' };
    const decoded = p.clouds.split(' ').map(c => {
      const cover = c.slice(0, 3);
      const base = c.slice(3);
      const coverDesc = cloudMap[cover] || cover;
      return base ? `${coverDesc} at ${parseInt(base).toLocaleString()} ft` : coverDesc;
    }).join(', ');
    lines.push(`Clouds: ${decoded}`);
  }
  // Flight category
  lines.push(`Conditions: ${CAT_DESC[p.flightCategory] || p.flightCategory}`);
  return lines;
}

// aviationweather.gov returns period timestamps as Unix seconds (not ms)
function toDate(val) {
  if (!val) return null;
  if (typeof val === 'number') return new Date(val * 1000);
  return new Date(val);
}

function fmtTime(val, useLocal, timezone) {
  const d = toDate(val);
  if (!d || isNaN(d)) return '—';
  if (useLocal && timezone) return fmtLocalTime(d, timezone);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }) + 'Z';
}

function fmtDate(val, useLocal, timezone) {
  const d = toDate(val);
  if (!d || isNaN(d)) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: useLocal && timezone ? timezone : 'UTC' });
}

function clipTo24h(period, now, end24) {
  const from = toDate(period.timeFrom);
  const to   = toDate(period.timeTo);
  if (isNaN(from) || isNaN(to) || to <= now || from >= end24) return null;
  return { ...period, clippedFrom: from < now ? now : from, clippedTo: to > end24 ? end24 : to };
}

function WeatherIcon({ weather }) {
  if (!weather) return null;
  if (/TS/.test(weather)) return <span title="Thunderstorm">⛈</span>;
  if (/RA|SN|DZ|SH/.test(weather)) return <span title="Precipitation">🌧</span>;
  if (/FG|BR|HZ|FU/.test(weather)) return <span title="Reduced visibility">🌫</span>;
  return null;
}

export default function TafTimeline({ tafData, loading, theme, timezone }) {
  const [expanded, setExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [useLocal, setUseLocal] = useState(!!timezone);
  const [decoded, setDecoded] = useState(false);

  const isDark = theme === 'dark';
  const panelBg = isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.95)';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const rowBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const pillBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const now   = new Date();
  const end24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const periods24 = (tafData?.forecast || [])
    .map(p => clipTo24h(p, now, end24))
    .filter(Boolean);

  const totalMs = end24 - now;

  const btnStyle = (active) => ({
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    background: active ? '#3b82f6' : pillBg,
    color: active ? '#fff' : textSecondary,
    transition: 'background 0.15s',
  });

  return (
    <div
      className="glass-panel ui-element"
      style={{ width: '320px', background: panelBg, border: `1px solid ${borderColor}`, borderRadius: '12px', overflow: 'hidden', flexShrink: 0 }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'transparent', border: 'none', color: textPrimary, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={14} color="#3b82f6" />
          <span>TAF — 24 hr Forecast</span>
          {loading && <span style={{ fontSize: '0.7rem', color: textSecondary }}>Loading…</span>}
          {!loading && !tafData && <span style={{ fontSize: '0.7rem', color: textSecondary }}>Not available</span>}
          {!loading && tafData && periods24.length > 0 && (
            <span style={{ background: CAT_COLOR[periods24[0].flightCategory]?.bg || '#64748b', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', letterSpacing: '0.05em' }}>
              {periods24[0].flightCategory}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 14px' }}>
          {loading && <p style={{ color: textSecondary, fontSize: '0.8rem', textAlign: 'center', padding: '16px 0' }}>Fetching TAF…</p>}
          {!loading && !tafData && <p style={{ color: textSecondary, fontSize: '0.8rem', textAlign: 'center', padding: '12px 0' }}>No TAF data available for this airport.</p>}

          {!loading && tafData && (
            <>
              {/* Toolbar: time toggle + decode toggle */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <button style={btnStyle(!useLocal)} onClick={() => setUseLocal(false)}>UTC</button>
                {timezone && (
                  <button style={btnStyle(useLocal)} onClick={() => setUseLocal(true)}>Local</button>
                )}
                <button style={btnStyle(decoded)} onClick={() => setDecoded(d => !d)}>
                  {decoded ? 'Decoded' : 'Decode'}
                </button>
              </div>

              {/* Issue time */}
              <p style={{ fontSize: '0.7rem', color: textSecondary, marginBottom: '10px' }}>
                Issued {fmtTime(tafData.issueTime, useLocal, timezone)} · Valid {fmtDate(tafData.validFrom, useLocal, timezone)} {fmtTime(tafData.validFrom, useLocal, timezone)} – {fmtDate(tafData.validTo, useLocal, timezone)} {fmtTime(tafData.validTo, useLocal, timezone)}
              </p>

              {/* Colour bar */}
              {periods24.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.68rem', color: textSecondary, marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Now</span><span>+24 h</span>
                  </div>
                  <div style={{ display: 'flex', height: '22px', borderRadius: '6px', overflow: 'hidden', border: `1px solid ${borderColor}` }}>
                    {periods24.map((p, i) => {
                      const widthPct = ((p.clippedTo - p.clippedFrom) / totalMs) * 100;
                      const col = CAT_COLOR[p.flightCategory] || CAT_COLOR.VFR;
                      return (
                        <div key={i} title={`${p.flightCategory} · ${fmtTime(p.clippedFrom, useLocal, timezone)}–${fmtTime(p.clippedTo, useLocal, timezone)}${p.weather ? ' · ' + p.weather : ''}`}
                          style={{ width: `${widthPct}%`, background: col.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: col.text, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {widthPct > 8 ? p.flightCategory : ''}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Period table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {periods24.map((p, i) => {
                  const col = CAT_COLOR[p.flightCategory] || CAT_COLOR.VFR;
                  const decodedLines = decoded ? decodePeriod(p) : null;
                  return (
                    <div key={i} style={{ background: rowBg, borderRadius: '8px', padding: '8px 10px', borderLeft: `3px solid ${col.bg}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.72rem', color: textSecondary }}>
                          {fmtTime(p.clippedFrom, useLocal, timezone)} – {fmtTime(p.clippedTo, useLocal, timezone)}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <WeatherIcon weather={p.weather} />
                          <span style={{ background: col.bg, color: col.text, fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px' }}>
                            {p.flightCategory}
                          </span>
                        </div>
                      </div>

                      {decoded ? (
                        <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {decodedLines.map((line, j) => (
                            <li key={j} style={{ fontSize: '0.72rem', color: textPrimary, lineHeight: 1.45 }}>{line}</li>
                          ))}
                        </ul>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                          <div>
                            <div style={{ fontSize: '0.62rem', color: textSecondary }}>Wind</div>
                            <div style={{ fontSize: '0.75rem', color: textPrimary, fontWeight: 600 }}>
                              {p.windSpeed != null
                                ? `${p.windDir != null && p.windDir !== 'VRB' ? p.windDir + '°/' : 'VRB/'}${p.windSpeed}kt${p.windGust ? ` G${p.windGust}` : ''}`
                                : 'Calm'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.62rem', color: textSecondary }}>Vis</div>
                            <div style={{ fontSize: '0.75rem', color: textPrimary, fontWeight: 600 }}>{p.visibility} SM</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.62rem', color: textSecondary }}>Ceiling</div>
                            <div style={{ fontSize: '0.75rem', color: textPrimary, fontWeight: 600 }}>{p.ceiling}</div>
                          </div>
                        </div>
                      )}

                      {!decoded && p.weather && (
                        <div style={{ marginTop: '3px', fontSize: '0.68rem', color: textSecondary }}>{p.weather}</div>
                      )}
                    </div>
                  );
                })}

                {periods24.length === 0 && (
                  <p style={{ color: textSecondary, fontSize: '0.8rem', textAlign: 'center', padding: '8px 0' }}>No forecast periods in the next 24 hours.</p>
                )}
              </div>

              {/* Raw TAF toggle */}
              {tafData.rawText && (
                <div style={{ marginTop: '10px' }}>
                  <button onClick={() => setShowRaw(r => !r)}
                    style={{ background: 'transparent', border: `1px solid ${borderColor}`, color: textSecondary, fontSize: '0.7rem', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', width: '100%' }}>
                    {showRaw ? 'Hide' : 'Show'} raw TAF
                  </button>
                  {showRaw && (
                    <pre style={{ marginTop: '8px', fontSize: '0.65rem', color: textSecondary, whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)', padding: '8px', borderRadius: '6px', lineHeight: 1.5 }}>
                      {tafData.rawText}
                    </pre>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
