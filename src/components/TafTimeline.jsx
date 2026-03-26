import React, { useState } from 'react';
import { Clock, ChevronDown, ChevronUp, Wind } from 'lucide-react';

const CAT_COLOR = {
  VFR:  { bg: '#10b981', text: '#fff', label: 'VFR' },
  MVFR: { bg: '#3b82f6', text: '#fff', label: 'MVFR' },
  IFR:  { bg: '#ef4444', text: '#fff', label: 'IFR' },
  LIFR: { bg: '#a855f7', text: '#fff', label: 'LIFR' },
};

// aviationweather.gov returns period timestamps as Unix seconds (not ms)
function toDate(val) {
  if (!val) return null;
  if (typeof val === 'number') return new Date(val * 1000);
  return new Date(val); // ISO string (issueTime)
}

function fmtTime(val) {
  const d = toDate(val);
  if (!d || isNaN(d)) return '—';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }) + 'Z';
}

function fmtDate(val) {
  const d = toDate(val);
  if (!d || isNaN(d)) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// Clip period to the 24-hour window starting now
function clipTo24h(period, now, end24) {
  const from = toDate(period.timeFrom);
  const to   = toDate(period.timeTo);
  if (isNaN(from) || isNaN(to) || to <= now || from >= end24) return null;
  return {
    ...period,
    clippedFrom: from < now ? now : from,
    clippedTo:   to > end24 ? end24 : to,
  };
}

function WeatherIcon({ weather }) {
  if (!weather) return null;
  if (/TS/.test(weather)) return <span title="Thunderstorm">⛈</span>;
  if (/RA|SN|DZ|SH/.test(weather)) return <span title="Precipitation">🌧</span>;
  if (/FG|BR|HZ|FU/.test(weather)) return <span title="Reduced visibility">🌫</span>;
  return null;
}

export default function TafTimeline({ tafData, loading, theme }) {
  const [expanded, setExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const isDark = theme === 'dark';
  const panelBg = isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.95)';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const rowBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  const now   = new Date();
  const end24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const periods24 = (tafData?.forecast || [])
    .map(p => clipTo24h(p, now, end24))
    .filter(Boolean);

  const totalMs = end24 - now;

  return (
    <div
      className="glass-panel ui-element"
      style={{
        width: '320px',
        background: panelBg,
        border: `1px solid ${borderColor}`,
        borderRadius: '12px',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          color: textPrimary,
          cursor: 'pointer',
          fontSize: '0.85rem',
          fontWeight: 600,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={14} color="#3b82f6" />
          <span>TAF — 24 hr Forecast</span>
          {loading && (
            <span style={{ fontSize: '0.7rem', color: textSecondary }}>Loading…</span>
          )}
          {!loading && !tafData && (
            <span style={{ fontSize: '0.7rem', color: textSecondary }}>Not available</span>
          )}
          {!loading && tafData && periods24.length > 0 && (
            <span
              style={{
                background: CAT_COLOR[periods24[0].flightCategory]?.bg || '#64748b',
                color: '#fff',
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '4px',
                letterSpacing: '0.05em',
              }}
            >
              {periods24[0].flightCategory}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 14px' }}>
          {loading && (
            <p style={{ color: textSecondary, fontSize: '0.8rem', textAlign: 'center', padding: '16px 0' }}>
              Fetching TAF…
            </p>
          )}

          {!loading && !tafData && (
            <p style={{ color: textSecondary, fontSize: '0.8rem', textAlign: 'center', padding: '12px 0' }}>
              No TAF data available for this airport.
            </p>
          )}

          {!loading && tafData && (
            <>
              {/* Issue time */}
              <p style={{ fontSize: '0.7rem', color: textSecondary, marginBottom: '10px' }}>
                Issued {fmtTime(tafData.issueTime)} · Valid {fmtDate(tafData.validFrom)} {fmtTime(tafData.validFrom)} – {fmtDate(tafData.validTo)} {fmtTime(tafData.validTo)}
              </p>

              {/* Colour bar */}
              {periods24.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.68rem', color: textSecondary, marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Now</span>
                    <span>+24 h</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      height: '22px',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      border: `1px solid ${borderColor}`,
                    }}
                  >
                    {periods24.map((p, i) => {
                      const widthPct = ((p.clippedTo - p.clippedFrom) / totalMs) * 100;
                      const col = CAT_COLOR[p.flightCategory] || CAT_COLOR.VFR;
                      return (
                        <div
                          key={i}
                          title={`${p.flightCategory} · ${fmtTime(p.clippedFrom)}–${fmtTime(p.clippedTo)}${p.weather ? ' · ' + p.weather : ''}`}
                          style={{
                            width: `${widthPct}%`,
                            background: col.bg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            color: col.text,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                          }}
                        >
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
                  return (
                    <div
                      key={i}
                      style={{
                        background: rowBg,
                        borderRadius: '8px',
                        padding: '8px 10px',
                        borderLeft: `3px solid ${col.bg}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.72rem', color: textSecondary }}>
                          {fmtTime(p.clippedFrom)} – {fmtTime(p.clippedTo)}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <WeatherIcon weather={p.weather} />
                          <span
                            style={{
                              background: col.bg,
                              color: col.text,
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '3px',
                            }}
                          >
                            {p.flightCategory}
                          </span>
                        </div>
                      </div>
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
                          <div style={{ fontSize: '0.75rem', color: textPrimary, fontWeight: 600 }}>
                            {p.visibility} SM
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.62rem', color: textSecondary }}>Ceiling</div>
                          <div style={{ fontSize: '0.75rem', color: textPrimary, fontWeight: 600 }}>
                            {p.ceiling}
                          </div>
                        </div>
                      </div>
                      {p.weather && (
                        <div style={{ marginTop: '3px', fontSize: '0.68rem', color: textSecondary }}>
                          {p.weather}
                        </div>
                      )}
                    </div>
                  );
                })}

                {periods24.length === 0 && (
                  <p style={{ color: textSecondary, fontSize: '0.8rem', textAlign: 'center', padding: '8px 0' }}>
                    No forecast periods in the next 24 hours.
                  </p>
                )}
              </div>

              {/* Raw TAF toggle */}
              {tafData.rawText && (
                <div style={{ marginTop: '10px' }}>
                  <button
                    onClick={() => setShowRaw(r => !r)}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${borderColor}`,
                      color: textSecondary,
                      fontSize: '0.7rem',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    {showRaw ? 'Hide' : 'Show'} raw TAF
                  </button>
                  {showRaw && (
                    <pre
                      style={{
                        marginTop: '8px',
                        fontSize: '0.65rem',
                        color: textSecondary,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
                        padding: '8px',
                        borderRadius: '6px',
                        lineHeight: 1.5,
                      }}
                    >
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
