import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, Clock, Navigation, Wind, AlertTriangle, CheckCircle, Circle } from 'lucide-react';

// 30-minute increments in 24-hour local time
const TIME_OPTIONS = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

const ALTITUDES = ['surface', '3k', '6k', '9k', '12k', '18k'];

function getWindColor(speed) {
  if (speed == null) return '#94a3b8';
  if (speed < 5)  return '#10b981';
  if (speed < 15) return '#3b82f6';
  if (speed < 25) return '#f59e0b';
  if (speed < 40) return '#ef4444';
  return '#8b5cf6';
}

function getCatColor(cat) {
  if (cat === 'VFR')  return '#10b981';
  if (cat === 'MVFR') return '#3b82f6';
  if (cat === 'IFR')  return '#ef4444';
  if (cat === 'LIFR') return '#a855f7';
  return '#94a3b8';
}

function WindCell({ dir, speed }) {
  if (dir == null && speed == null) return <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</span>;
  const color = getWindColor(speed);
  const rotation = dir != null ? (dir + 180) % 360 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {dir != null && (
        <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
          <path d="M7 1L10.5 12L7 10L3.5 12Z" fill={color} transform={`rotate(${rotation} 7 7)`} />
        </svg>
      )}
      <span style={{ fontSize: '0.8rem', fontWeight: 700, color }}>
        {speed != null ? `${speed}kt` : '—'}
      </span>
      {dir != null && (
        <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{dir}°</span>
      )}
    </div>
  );
}

function AirportSearch({ label, value, onChange, onSelect, results, theme, isSet }) {
  const inp = {
    background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    border: `1px solid ${isSet ? '#10b981' : theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
    borderRadius: '8px',
    color: 'var(--text-primary)',
    padding: '8px 10px',
    width: '100%',
    outline: 'none',
    fontSize: '0.85rem',
    boxSizing: 'border-box',
  };
  const drop = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 200,
    background: theme === 'dark' ? 'rgba(10,17,34,0.99)' : 'rgba(255,255,255,0.99)',
    border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: '8px',
    marginTop: '4px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  };

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#38bdf8', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ position: 'relative' }}>
        <input
          placeholder={label === 'From' ? 'e.g. KSEA' : 'e.g. KLAX'}
          value={value}
          onChange={onChange}
          style={inp}
        />
        {results.length > 0 && (
          <div style={drop}>
            {results.map(r => (
              <div
                key={r.id}
                onClick={() => onSelect(r)}
                style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}
                onMouseEnter={e => e.currentTarget.style.background = theme === 'dark' ? 'rgba(56,189,248,0.1)' : 'rgba(56,189,248,0.07)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#38bdf8' }}>{r.id}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                  {(r.name || '').substring(0, 28)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WaypointCard({ wp, selectedAlt, theme, isFirst, isLast }) {
  const isEndpoint = isFirst || isLast;
  const aloftData = selectedAlt !== 'surface' ? (wp.aloft?.[selectedAlt] ?? null) : null;
  const surf = wp.surface;

  return (
    <div style={{
      padding: '8px 10px',
      borderRadius: '8px',
      background: theme === 'dark' ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.025)',
      border: `1px solid ${isEndpoint ? 'rgba(56,189,248,0.3)' : theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
    }}>
      {/* Waypoint header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: isEndpoint ? '#38bdf8' : 'var(--text-primary)', fontFamily: 'monospace' }}>
            {wp.label}
          </span>
          {wp.nearestStation && wp.nearestStation !== wp.label && !isEndpoint && (
            <span style={{ fontSize: '0.62rem', color: '#64748b' }}>
              ≈{wp.nearestStation} ({wp.nearestStationDistNm}nm)
            </span>
          )}
        </div>
        <span style={{ fontSize: '0.68rem', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
          {wp.distFromDep} nm
        </span>
      </div>

      {/* Wind data for selected altitude */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '7px' }}>
        {selectedAlt === 'surface' && surf ? (
          <>
            <WindCell dir={surf.windDir} speed={surf.windSpeed} />
            {surf.windGust && <span style={{ fontSize: '0.68rem', color: '#f59e0b' }}>G{surf.windGust}kt</span>}
            {surf.temp != null && <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{surf.temp}°C</span>}
            {surf.flightCategory && (
              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: getCatColor(surf.flightCategory), padding: '1px 5px', borderRadius: '3px', border: `1px solid ${getCatColor(surf.flightCategory)}` }}>
                {surf.flightCategory}
              </span>
            )}
            {surf.precip && (
              <span style={{ fontSize: '0.72rem', color: surf.precip.severity === 'high' ? '#ef4444' : '#f59e0b' }}
                title={surf.precip.type}>
                {surf.precip.icon} {surf.precip.type}
              </span>
            )}
            {surf.ceiling != null && (
              <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{surf.ceiling.toLocaleString()}ft</span>
            )}
          </>
        ) : aloftData ? (
          <>
            <WindCell dir={aloftData.windDir} speed={aloftData.windSpeed} />
            {aloftData.temp != null && (
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{aloftData.temp}°C</span>
            )}
            {/* Show surface precip warning even at altitude view */}
            {surf?.precip && (
              <span style={{ fontSize: '0.68rem', color: '#f59e0b' }} title={surf.precip.type}>
                {surf.precip.icon}
              </span>
            )}
          </>
        ) : (
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>No data at this altitude</span>
        )}
      </div>

      {/* Multi-altitude wind speed color strip */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '2px' }}>
        {['3k', '6k', '9k', '12k', '18k'].map(alt => {
          const d = wp.aloft?.[alt];
          const spd = d?.windSpeed ?? null;
          return (
            <div
              key={alt}
              title={`${alt.toUpperCase()}: ${spd != null ? spd + ' kt' : 'N/A'}`}
              style={{
                flex: 1,
                height: '5px',
                borderRadius: '3px',
                background: spd != null ? getWindColor(spd) : (theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'),
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: '2px' }}>
        {['3k', '6k', '9k', '12k', '18k'].map(alt => (
          <div key={alt} style={{ flex: 1, fontSize: '0.46rem', color: '#475569', textAlign: 'center', letterSpacing: 0, fontFamily: 'monospace' }}>
            {alt}
          </div>
        ))}
      </div>
    </div>
  );
}

const IMSAFE = [
  { key: 'illness',    letter: 'I', label: 'Illness',    statement: 'I have no illness, injury, or physical symptoms that could affect my ability to fly safely.' },
  { key: 'medication', letter: 'M', label: 'Medication', statement: 'I am not taking any medications or substances that could impair my judgment, vision, or reaction time. (FAR 91.17)' },
  { key: 'stress',     letter: 'S', label: 'Stress',     statement: 'I am free from significant psychological stress, anxiety, or personal problems that could distract me during flight.' },
  { key: 'alcohol',    letter: 'A', label: 'Alcohol',    statement: 'I have not consumed alcohol within the last 8 hours and my blood alcohol content is below 0.04%. (FAR 91.17 — "8 hours bottle to throttle")' },
  { key: 'fatigue',    letter: 'F', label: 'Fatigue',    statement: 'I am adequately rested, alert, and free from fatigue. I have had sufficient sleep in the past 24 hours.' },
  { key: 'emotion',    letter: 'E', label: 'Emotion',    statement: 'I am emotionally stable, have eaten recently, and am in a positive mental state suitable for pilot-in-command responsibilities.' },
];

const PREFLIGHT = [
  { key: 'wx',       label: 'Weather Briefing',     detail: 'Obtained official weather briefing via 1800wxbrief.com, ForeFlight, or Leidos. Reviewed METARs, TAFs, PIREPs, AIRMETs/SIGMETs.' },
  { key: 'notam',    label: 'NOTAMs Reviewed',       detail: 'Checked NOTAMs for departure, destination, alternates, and all airspace along route.' },
  { key: 'fuel',     label: 'Fuel Requirements',     detail: 'Verified sufficient fuel for route + VFR reserve (45 min day / 30 min night per FAR 91.151). Fuel aboard confirmed.' },
  { key: 'alt',      label: 'Alternate Identified',  detail: 'Identified a suitable VFR alternate airport within reasonable range in case destination becomes unflyable.' },
  { key: 'tfr',      label: 'TFRs Checked',          detail: 'Verified no Temporary Flight Restrictions (TFRs) along or near the planned route via FAA TFR tool.' },
  { key: 'aircraft', label: 'Aircraft Airworthy',    detail: 'Confirmed aircraft is airworthy, maintenance is current, and all required documents are aboard (ARROW: Airworthiness, Registration, Radio, POH, Operating limitations).' },
];

function PreflightModal({ routeData, theme, onClose }) {
  const dark = theme === 'dark';
  const [imsafe, setImsafe]     = useState({});
  const [preflight, setPreflight] = useState({});

  const rec = routeData?.altitudeRecommendation;
  const warnings = rec?.warnings || [];
  const allImsafe    = IMSAFE.every(i => imsafe[i.key]);
  const allPreflight = PREFLIGHT.every(p => preflight[p.key]);
  const allClear = allImsafe && allPreflight;

  const toggle = (setter, key) => setter(prev => ({ ...prev, [key]: !prev[key] }));

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: dark ? 'rgba(10,17,34,0.99)' : 'rgba(255,255,255,0.99)',
        border: `1px solid rgba(245,158,11,0.4)`,
        borderTop: '3px solid #f59e0b',
        borderRadius: '14px',
        width: '100%',
        maxWidth: '480px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(245,158,11,0.1)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', letterSpacing: '0.2px' }}>
              Pre-Flight Briefing Required
            </div>
            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px', lineHeight: '1.4' }}>
              Complete all items before flight. This checklist does not replace official FAA briefings.
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '14px 18px' }}>
          {/* Route-specific warnings */}
          {warnings.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#f59e0b', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
                ⚠ Route Hazards
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {warnings.map((w, i) => {
                  const c = w.severity === 'critical' ? '#ef4444' : w.severity === 'high' ? '#f97316' : w.severity === 'moderate' ? '#f59e0b' : '#3b82f6';
                  return (
                    <div key={i} style={{ padding: '6px 9px', borderRadius: '6px', background: `${c}12`, border: `1px solid ${c}33`, fontSize: '0.7rem', color: c, display: 'flex', gap: '6px', lineHeight: '1.35' }}>
                      <span style={{ flexShrink: 0 }}>{w.icon || '⚠️'}</span>
                      <span>{w.message}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommended altitude callout */}
          {rec?.recommendedAltLabel && (
            <div style={{ marginBottom: '16px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1rem' }}>✈️</span>
              <div>
                <div style={{ fontSize: '0.6rem', color: '#38bdf8', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>Planned Cruise Altitude</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>{rec.recommendedAltLabel}</div>
              </div>
            </div>
          )}

          {/* IMSAFE */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
              IMSAFE Pilot Self-Assessment
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {IMSAFE.map(item => {
                const checked = !!imsafe[item.key];
                return (
                  <div
                    key={item.key}
                    onClick={() => toggle(setImsafe, item.key)}
                    style={{
                      display: 'flex', gap: '10px', alignItems: 'flex-start',
                      padding: '8px 10px', borderRadius: '7px', cursor: 'pointer',
                      background: checked
                        ? (dark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)')
                        : (dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'),
                      border: `1px solid ${checked ? 'rgba(16,185,129,0.3)' : (dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)')}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      background: checked ? '#10b981' : 'transparent',
                      border: `2px solid ${checked ? '#10b981' : '#475569'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, transition: 'all 0.15s',
                    }}>
                      <span style={{ fontSize: '0.6rem', fontWeight: 900, color: checked ? '#fff' : '#64748b', fontFamily: 'monospace' }}>{item.letter}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: checked ? '#10b981' : 'var(--text-primary)', marginBottom: '2px' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', lineHeight: '1.4' }}>{item.statement}</div>
                    </div>
                    <div style={{ flexShrink: 0, marginTop: '1px' }}>
                      {checked
                        ? <CheckCircle size={14} color="#10b981" />
                        : <Circle size={14} color="#475569" />
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preflight items */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
              Preflight Checklist
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {PREFLIGHT.map(item => {
                const checked = !!preflight[item.key];
                return (
                  <div
                    key={item.key}
                    onClick={() => toggle(setPreflight, item.key)}
                    style={{
                      display: 'flex', gap: '10px', alignItems: 'flex-start',
                      padding: '8px 10px', borderRadius: '7px', cursor: 'pointer',
                      background: checked
                        ? (dark ? 'rgba(56,189,248,0.07)' : 'rgba(56,189,248,0.05)')
                        : (dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'),
                      border: `1px solid ${checked ? 'rgba(56,189,248,0.25)' : (dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)')}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: '16px', height: '16px', borderRadius: '3px', marginTop: '1px',
                      background: checked ? '#38bdf8' : 'transparent',
                      border: `2px solid ${checked ? '#38bdf8' : '#475569'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, transition: 'all 0.15s',
                    }}>
                      {checked && <span style={{ fontSize: '0.5rem', color: '#0f172a', fontWeight: 900 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: checked ? '#38bdf8' : 'var(--text-primary)', marginBottom: '2px' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', lineHeight: '1.4' }}>{item.detail}</div>
                    </div>
                    <div style={{ flexShrink: 0, marginTop: '1px' }}>
                      {checked
                        ? <CheckCircle size={14} color="#38bdf8" />
                        : <Circle size={14} color="#475569" />
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress */}
          <div style={{ marginBottom: '14px' }}>
            {(() => {
              const iTotal = IMSAFE.length, iDone = IMSAFE.filter(i => imsafe[i.key]).length;
              const pTotal = PREFLIGHT.length, pDone = PREFLIGHT.filter(p => preflight[p.key]).length;
              const total = iTotal + pTotal, done = iDone + pDone;
              const pct = Math.round((done / total) * 100);
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '0.62rem', color: '#64748b' }}>Briefing completion</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: allClear ? '#10b981' : '#f59e0b' }}>{done}/{total} items</span>
                  </div>
                  <div style={{ height: '4px', borderRadius: '2px', background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: '2px', background: allClear ? '#10b981' : '#f59e0b', transition: 'width 0.3s' }} />
                  </div>
                </>
              );
            })()}
          </div>

          {/* Acknowledge / dismiss */}
          <button
            onClick={onClose}
            disabled={!allClear}
            style={{
              width: '100%', padding: '11px', borderRadius: '8px',
              background: allClear ? '#10b981' : (dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'),
              color: allClear ? '#fff' : '#64748b',
              border: 'none', fontWeight: 700, fontSize: '0.85rem',
              cursor: allClear ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s', letterSpacing: '0.3px',
            }}
          >
            {allClear ? '✓ Briefing Complete — Ready to Fly' : 'Complete all items above to proceed'}
          </button>

          <div style={{ marginTop: '8px', fontSize: '0.58rem', color: '#475569', textAlign: 'center', lineHeight: '1.5' }}>
            This checklist does not replace an official FAA weather briefing or pilot operating handbook procedures.
            VFR only. Not for real-world navigation.
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function AltitudeRecommendation({ rec, theme }) {
  const [expanded, setExpanded] = useState(false);
  const dark = theme === 'dark';

  const altFt = rec.recommendedAltLabel || `${rec.recommendedAlt?.toLocaleString()} ft MSL`;

  const severityColor = (sev) => {
    if (sev === 'critical') return '#ef4444';
    if (sev === 'high')     return '#f97316';
    if (sev === 'moderate') return '#f59e0b';
    return '#3b82f6';
  };

  const windComp = rec.windComponents?.[rec.altKey];
  const hasWind = windComp != null;
  const tailwind = hasWind ? windComp > 0 : null;
  const windAbs  = hasWind ? Math.abs(Math.round(windComp)) : 0;

  return (
    <div style={{
      marginBottom: '12px',
      borderRadius: '10px',
      border: `1px solid rgba(56,189,248,0.25)`,
      overflow: 'hidden',
      background: dark ? 'rgba(56,189,248,0.04)' : 'rgba(56,189,248,0.04)',
    }}>
      {/* Recommended altitude header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          padding: '10px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: dark ? 'rgba(56,189,248,0.08)' : 'rgba(56,189,248,0.07)',
        }}
      >
        <span style={{ fontSize: '1rem' }}>✈️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#38bdf8', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '2px' }}>
            Recommended Cruise Altitude
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
              {altFt}
            </span>
            {hasWind && (
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: tailwind ? '#10b981' : '#f59e0b' }}>
                {tailwind ? `▲ ${windAbs}kt tailwind` : `▼ ${windAbs}kt headwind`}
              </span>
            )}
          </div>
        </div>
        <span style={{ fontSize: '0.7rem', color: '#64748b', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Warnings (always visible) */}
      {rec.warnings?.length > 0 && (
        <div style={{ padding: '6px 12px 0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {rec.warnings.map((w, i) => (
            <div key={i} style={{
              padding: '5px 8px',
              borderRadius: '6px',
              background: `${severityColor(w.severity)}18`,
              border: `1px solid ${severityColor(w.severity)}44`,
              fontSize: '0.7rem',
              color: severityColor(w.severity),
              display: 'flex', gap: '6px', alignItems: 'flex-start',
              lineHeight: '1.35',
            }}>
              <span style={{ flexShrink: 0, fontSize: '0.8rem' }}>{w.icon || '⚠️'}</span>
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expandable detail */}
      {expanded && (
        <div style={{ padding: '10px 12px' }}>
          {/* Reasons */}
          {rec.reasons?.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
                Why This Altitude
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {rec.reasons.map((r, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: '6px', alignItems: 'flex-start',
                    fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: '1.4',
                  }}>
                    <span style={{ flexShrink: 0 }}>{r.icon || '•'}</span>
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.title}: </span>
                      {r.detail}
                      {r.rule && (
                        <span style={{ marginLeft: '4px', fontSize: '0.6rem', color: '#38bdf8', fontFamily: 'monospace' }}>
                          [{r.rule}]
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alternative altitudes */}
          {rec.alternatives?.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
                Alternatives
              </div>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {rec.alternatives.map((a, i) => {
                  const ac = rec.windComponents?.[a.altKey];
                  const tw = ac != null ? ac > 0 : null;
                  return (
                    <div key={i} style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                      fontSize: '0.7rem',
                    }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{a.label}</span>
                      {ac != null && (
                        <span style={{ marginLeft: '4px', color: tw ? '#10b981' : '#f59e0b', fontSize: '0.65rem' }}>
                          {tw ? `+${Math.abs(Math.round(ac))}kt` : `-${Math.abs(Math.round(ac))}kt`}
                        </span>
                      )}
                      {a.note && <span style={{ marginLeft: '4px', color: '#64748b', fontSize: '0.62rem' }}>{a.note}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Compliance notes */}
          {rec.complianceNotes?.length > 0 && (
            <div style={{
              padding: '6px 8px',
              borderRadius: '6px',
              background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
            }}>
              {rec.complianceNotes.map((n, i) => (
                <div key={i} style={{ fontSize: '0.62rem', color: '#475569', lineHeight: '1.5', fontFamily: 'monospace' }}>
                  {n}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FlightPathPanel({ theme, allAirports, onClose, onRouteCalculated }) {
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery,   setToQuery]   = useState('');
  const [fromResults, setFromResults] = useState([]);
  const [toResults,   setToResults]   = useState([]);
  const [fromAirport, setFromAirport] = useState(null);
  const [toAirport,   setToAirport]   = useState(null);
  const [departureTime, setDepartureTime] = useState(() => {
    // Default to nearest 30-min increment of current local time
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes() < 30 ? '00' : '30';
    return `${String(h).padStart(2, '0')}:${m}`;
  });
  const [loading,   setLoading]   = useState(false);
  const [routeData, setRouteData] = useState(null);
  const [error,     setError]     = useState(null);
  const [selectedAlt, setSelectedAlt] = useState('6k');
  const [showBriefing, setShowBriefing] = useState(false);

  const searchAirports = (query) => {
    if (!query || query.length < 2) return [];
    const q = query.toUpperCase();
    return (allAirports || [])
      .filter(a => (a.id || '').toUpperCase().includes(q) || (a.name || '').toUpperCase().includes(q))
      .slice(0, 6);
  };

  const handleFromChange = e => {
    const v = e.target.value;
    setFromQuery(v);
    setFromAirport(null);
    setFromResults(searchAirports(v));
  };

  const handleToChange = e => {
    const v = e.target.value;
    setToQuery(v);
    setToAirport(null);
    setToResults(searchAirports(v));
  };

  const selectFrom = airport => {
    setFromAirport(airport);
    setFromQuery(airport.id);
    setFromResults([]);
  };

  const selectTo = airport => {
    setToAirport(airport);
    setToQuery(airport.id);
    setToResults([]);
  };

  const calculate = async () => {
    if (!fromAirport || !toAirport || loading) return;
    setLoading(true);
    setError(null);
    setRouteData(null);

    try {
      const url = `/api/flightpath?from=${encodeURIComponent(fromAirport.id)}&to=${encodeURIComponent(toAirport.id)}&time=${encodeURIComponent(departureTime)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Route calculation failed');
      setRouteData(data);
      // Auto-select the altitude tab matching the recommendation
      if (data.altitudeRecommendation?.altKey) {
        setSelectedAlt(data.altitudeRecommendation.altKey);
      }
      if (onRouteCalculated) onRouteCalculated(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const clearRoute = () => {
    setRouteData(null);
    setShowBriefing(false);
    if (onRouteCalculated) onRouteCalculated(null);
  };

  const panel = {
    background: theme === 'dark' ? 'rgba(10,17,34,0.97)' : 'rgba(255,255,255,0.98)',
    border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    borderTop: '3px solid #38bdf8',
    borderRadius: '12px',
    padding: '14px',
    width: '360px',
    maxHeight: 'calc(100vh - 120px)',
    overflowY: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
  };

  const inputRow = {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
    marginBottom: '10px',
  };

  const canCalculate = fromAirport && toAirport && !loading;

  return (
    <div style={panel}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '10px' }}>
        <Wind size={15} color="#38bdf8" />
        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', letterSpacing: '0.3px' }}>
          Flight Path Winds
        </span>
        <span style={{ fontSize: '0.58rem', color: '#64748b', marginLeft: '2px' }}>BETA</span>
        <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '3px', padding: '1px 5px', marginLeft: '2px', letterSpacing: '0.4px' }}>VFR ONLY</span>
        <button
          onClick={() => { clearRoute(); onClose(); }}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', lineHeight: 1 }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Airport inputs */}
      <div style={inputRow}>
        <AirportSearch
          label="From"
          value={fromQuery}
          onChange={handleFromChange}
          onSelect={selectFrom}
          results={fromResults}
          theme={theme}
          isSet={!!fromAirport}
        />
        <div style={{ paddingTop: '22px', flexShrink: 0 }}>
          <ChevronRight size={14} color="#475569" />
        </div>
        <AirportSearch
          label="To"
          value={toQuery}
          onChange={handleToChange}
          onSelect={selectTo}
          results={toResults}
          theme={theme}
          isSet={!!toAirport}
        />
      </div>

      {/* Departure time */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#38bdf8', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
          Departure Time (Local 24hr)
        </div>
        <div style={{ position: 'relative' }}>
          <Clock size={13} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <select
            value={departureTime}
            onChange={e => setDepartureTime(e.target.value)}
            style={{
              background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
              borderRadius: '8px',
              color: 'var(--text-primary)',
              padding: '8px 10px 8px 30px',
              width: '100%',
              outline: 'none',
              fontSize: '0.85rem',
              cursor: 'pointer',
              appearance: 'none',
              WebkitAppearance: 'none',
            }}
          >
            {TIME_OPTIONS.map(t => (
              <option key={t} value={t} style={{ background: theme === 'dark' ? '#0f172a' : '#fff' }}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Calculate button */}
      <button
        onClick={calculate}
        disabled={!canCalculate}
        style={{
          width: '100%',
          padding: '10px',
          borderRadius: '8px',
          background: canCalculate ? '#38bdf8' : (theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'),
          color: canCalculate ? '#0f172a' : '#64748b',
          border: 'none',
          fontWeight: 700,
          fontSize: '0.85rem',
          cursor: canCalculate ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s',
          letterSpacing: '0.3px',
        }}
      >
        {loading ? 'Calculating Route...' : 'Calculate Route Winds'}
      </button>

      {/* Error */}
      {error && (
        <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', fontSize: '0.78rem', color: '#ef4444', lineHeight: '1.4' }}>
          {error}
        </div>
      )}

      {/* Results */}
      {routeData && (
        <div style={{ marginTop: '14px', borderTop: '1px solid var(--panel-border)', paddingTop: '12px' }}>
          {/* Route summary */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px',
            padding: '8px 10px',
            background: theme === 'dark' ? 'rgba(56,189,248,0.07)' : 'rgba(56,189,248,0.05)',
            borderRadius: '8px', border: '1px solid rgba(56,189,248,0.15)',
          }}>
            <Navigation size={13} color="#38bdf8" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.78rem', lineHeight: '1.5' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{routeData.from.icao}</span>
              <span style={{ color: '#38bdf8', margin: '0 5px' }}>→</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{routeData.to.icao}</span>
              <span style={{ color: '#64748b', marginLeft: '8px' }}>{routeData.route?.distanceNm} nm</span>
              <span style={{ color: '#64748b', marginLeft: '5px' }}>· {routeData.route?.bearing}° mag</span>
              <span style={{ color: '#64748b', marginLeft: '5px' }}>· ETD {routeData.departureTime}</span>
            </div>
          </div>

          {/* Preflight briefing warning button */}
          <button
            onClick={() => setShowBriefing(true)}
            style={{
              width: '100%', marginBottom: '10px',
              padding: '9px 12px', borderRadius: '8px',
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.45)',
              color: '#f59e0b', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px',
              fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.2px',
            }}
          >
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '20px', height: '20px', borderRadius: '50%',
              background: '#f59e0b',
              animation: 'briefing-ping 1.6s cubic-bezier(0,0,0.2,1) infinite',
              flexShrink: 0,
            }}>
              <AlertTriangle size={11} color="#0f172a" />
            </span>
            <span>Pre-Flight Briefing &amp; IMSAFE Checklist</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#d97706', fontWeight: 400 }}>Required</span>
          </button>
          <style>{`@keyframes briefing-ping { 0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0.7)} 50%{box-shadow:0 0 0 7px rgba(245,158,11,0)} }`}</style>

          {/* Altitude Recommendation */}
          {routeData.altitudeRecommendation && (
            <AltitudeRecommendation rec={routeData.altitudeRecommendation} theme={theme} />
          )}

          {/* Altitude selector */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
              View Altitude
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {ALTITUDES.map(alt => (
                <button
                  key={alt}
                  onClick={() => setSelectedAlt(alt)}
                  style={{
                    padding: '3px 9px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 700,
                    cursor: 'pointer', border: 'none',
                    background: selectedAlt === alt ? '#38bdf8' : (theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                    color: selectedAlt === alt ? '#0f172a' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}
                >
                  {alt === 'surface' ? 'SFC' : alt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Waypoint cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {(routeData.waypoints || []).map((wp, idx) => (
              <WaypointCard
                key={wp.index}
                wp={wp}
                selectedAlt={selectedAlt}
                theme={theme}
                isFirst={idx === 0}
                isLast={idx === (routeData.waypoints.length - 1)}
              />
            ))}
          </div>

          {/* Wind speed legend */}
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[['< 5', '#10b981'], ['5–15', '#3b82f6'], ['15–25', '#f59e0b'], ['25–40', '#ef4444'], ['> 40', '#8b5cf6']].map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.6rem', color: '#64748b' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                {label} kt
              </div>
            ))}
          </div>

          <div style={{ marginTop: '8px', padding: '6px 8px', borderRadius: '6px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', fontSize: '0.6rem', color: '#64748b', lineHeight: '1.5' }}>
            <span style={{ fontWeight: 700, color: '#10b981' }}>VFR flights only.</span> This tool supports Visual Flight Rules (VFR) planning only — IFR operations not covered. Data from nearest observation stations. Altitude strip shows wind speed 3k–18k. <span style={{ fontWeight: 600 }}>Not for real-world navigation.</span>
          </div>
        </div>
      )}

      {/* Preflight briefing modal */}
      {showBriefing && routeData && (
        <PreflightModal
          routeData={routeData}
          theme={theme}
          onClose={() => setShowBriefing(false)}
        />
      )}
    </div>
  );
}
