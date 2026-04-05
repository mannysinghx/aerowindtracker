import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp, Radio, Ruler, MapPin, TrendingUp, Wind } from 'lucide-react';

// OurAirports surface codes → friendly labels (covers common variants)
const SURFACE_MAP = {
  ASP:     'Asphalt',
  ASPH:    'Asphalt',
  'ASPH-G':'Asphalt',
  'ASPH-F':'Asphalt',
  'ASPH-CONC': 'Asphalt/Concrete',
  CON:     'Concrete',
  CONC:    'Concrete',
  'CONC-G':'Concrete',
  'CONC-E':'Concrete',
  'CONC-ASPH': 'Concrete/Asphalt',
  TURF:    'Turf',
  GRVL:    'Gravel',
  GRAVEL:  'Gravel',
  GRE:     'Gravel',
  DIRT:    'Dirt',
  WATER:   'Water',
  MATS:    'Pierced Steel',
  ROOFTOP: 'Rooftop',
  SNOW:    'Snow/Ice',
  SAND:    'Sand',
  SHALE:   'Shale',
  CORAL:   'Coral',
  CLAY:    'Clay',
  LATERITE:'Laterite',
  GRASS:   'Grass',
  OILED:   'Oil Treated',
  PEM:     'Asphalt',  // some FAA codes
  PCC:     'Concrete',
  UNKNOWN: 'Unknown',
};

function surfaceLabel(raw) {
  if (!raw) return 'Unknown';
  const upper = raw.toUpperCase().trim();
  // Try exact match first, then strip trailing -E/-F modifiers
  return SURFACE_MAP[upper]
    ?? SURFACE_MAP[upper.replace(/-[EFG]$/, '')]
    ?? raw;
}

// OurAirports frequency type codes → friendly display labels
// Mirrors the mapping in api/airport.js
const FREQ_TYPE_LABEL = {
  ATIS:         'ATIS',
  'D-ATIS':     'D-ATIS',
  ASOS:         'ASOS',
  AWOS:         'AWOS',
  'AWOS-3':     'AWOS',
  AWOS3:        'AWOS',
  AWIS:         'AWIS',
  CTAF:         'CTAF',
  'CTAF/UNICOM':'CTAF',
  UNICOM:       'UNICOM',
  UNIC:         'UNICOM',
  UNI:          'UNICOM',
  GND:          'Ground',
  GROUND:       'Ground',
  GRN:          'Ground',
  GRD:          'Ground',
  TWR:          'Tower',
  TOWER:        'Tower',
  APP:          'Approach',
  APCH:         'Approach',
  APPR:         'Approach',
  'APP/DEP':    'App/Dep',
  'A/D':        'App/Dep',
  'APP/TWR':    'App/Twr',
  'TWR/APP':    'App/Twr',
  DEP:          'Departure',
  CLNC:         'Clnc Del',
  CLD:          'Clnc Del',
  CD:           'Clnc Del',
  DEL:          'Clnc Del',
  DELIVERY:     'Clnc Del',
  CNTR:         'Center',
  CTR:          'Center',
  CENTER:       'Center',
  ACC:          'Area Ctrl',
  OPS:          'Operations',
  OPER:         'Operations',
  FSS:          'FSS',
  RCO:          'FSS',
  RDO:          'Radio',
  RADIO:        'Radio',
  'A/G':        'Air/Ground',
  INFO:         'Information',
  AFIS:         'Flight Info',
  ATF:          'Traffic Freq',
  EMR:          'Emergency',
  EMERG:        'Emergency',
  MULTICOM:     'Multicom',
};

function freqTypeLabel(raw) {
  if (!raw) return raw;
  return FREQ_TYPE_LABEL[raw.toUpperCase()] ?? FREQ_TYPE_LABEL[raw] ?? raw;
}

// Frequency badge color themes
const FREQ_COLORS = {
  ATIS:         { bg: 'rgba(99,102,241,0.2)',  border: '#6366f1', text: '#a5b4fc' },
  'D-ATIS':     { bg: 'rgba(99,102,241,0.2)',  border: '#6366f1', text: '#a5b4fc' },
  ASOS:         { bg: 'rgba(99,102,241,0.2)',  border: '#6366f1', text: '#a5b4fc' },
  AWOS:         { bg: 'rgba(99,102,241,0.2)',  border: '#6366f1', text: '#a5b4fc' },
  Tower:        { bg: 'rgba(34,197,94,0.15)',  border: '#22c55e', text: '#86efac' },
  'App/Twr':    { bg: 'rgba(34,197,94,0.15)',  border: '#22c55e', text: '#86efac' },
  Ground:       { bg: 'rgba(59,130,246,0.15)', border: '#3b82f6', text: '#93c5fd' },
  Approach:     { bg: 'rgba(249,115,22,0.15)', border: '#f97316', text: '#fdba74' },
  Departure:    { bg: 'rgba(249,115,22,0.15)', border: '#f97316', text: '#fdba74' },
  'App/Dep':    { bg: 'rgba(249,115,22,0.15)', border: '#f97316', text: '#fdba74' },
  CTAF:         { bg: 'rgba(234,179,8,0.15)',  border: '#eab308', text: '#fde047' },
  UNICOM:       { bg: 'rgba(234,179,8,0.15)',  border: '#eab308', text: '#fde047' },
  'Clnc Del':   { bg: 'rgba(168,85,247,0.15)', border: '#a855f7', text: '#d8b4fe' },
  Center:       { bg: 'rgba(20,184,166,0.15)', border: '#14b8a6', text: '#5eead4' },
  'Area Ctrl':  { bg: 'rgba(20,184,166,0.15)', border: '#14b8a6', text: '#5eead4' },
  Operations:   { bg: 'rgba(156,163,175,0.15)',border: '#6b7280', text: '#d1d5db' },
  'Air/Ground': { bg: 'rgba(156,163,175,0.15)',border: '#6b7280', text: '#d1d5db' },
  FSS:          { bg: 'rgba(244,63,94,0.15)',  border: '#f43f5e', text: '#fda4af' },
  Emergency:    { bg: 'rgba(239,68,68,0.2)',   border: '#ef4444', text: '#fca5a5' },
};

function freqBadgeStyle(label) {
  return FREQ_COLORS[label] ?? { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.15)', text: '#94a3b8' };
}

// For Tower/Approach/Departure/App+Dep: extract a useful subtitle from the description.
// Priority: runway designator (16L/34R) → compass direction (North/South) → nothing.
const SUBTITLE_TYPES = new Set(['Tower', 'Approach', 'Departure', 'App/Dep', 'App/Twr']);
function extractSubtitle(label, desc) {
  if (!desc || !SUBTITLE_TYPES.has(label)) return null;
  // 1. Runway pattern: "16L/34R", "14R-32L", "(Rwy 16)", "ORRY 16L/34R"
  const rwy = desc.match(/\b(\d{1,2}[LRC]?(?:[/\-]\d{1,2}[LRC]?)?)\b/);
  if (rwy) return `RWY ${rwy[1]}`;
  // 2. Compass sector: NORTH / SOUTH / EAST / WEST / NE / NW / SE / SW
  const dir = desc.toUpperCase().match(/\b(NORTH|SOUTH|EAST|WEST|NE|NW|SE|SW)\b/);
  if (dir) {
    const d = dir[1];
    return d.length <= 2 ? d : d[0] + d.slice(1).toLowerCase(); // "North", "NW"
  }
  return null;
}

// Standard FAA Traffic Pattern Altitudes (AGL) by aircraft category.
const TPA_STANDARDS = [
  { category: 'Piston / Single',  agl: 1000, color: '#60a5fa' },
  { category: 'Large / Multi',    agl: 1500, color: '#a78bfa' },
  { category: 'Turbine / Jet',    agl: 1500, color: '#f472b6' },
  { category: 'Helicopter',       agl: 500,  color: '#34d399' },
];

function Skeleton({ width = '60%', height = '14px' }) {
  return (
    <div style={{
      width, height,
      background: 'rgba(255,255,255,0.08)',
      borderRadius: '4px',
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  );
}

export default function AirportInfoPanel({ airportData, loading, theme }) {
  const [collapsed, setCollapsed] = useState(false);

  const panelBg    = theme === 'dark' ? 'rgba(15,23,42,0.82)' : 'rgba(255,255,255,0.85)';
  const borderCol  = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const textPrimary   = theme === 'dark' ? '#e2e8f0' : '#1e293b';
  const textSecondary = theme === 'dark' ? '#94a3b8' : '#64748b';

  const hasData    = !loading && airportData;
  const hasFreqs   = hasData && airportData.frequencies?.length > 0;
  const hasRunways = hasData && airportData.runways?.length > 0;
  const elevation  = hasData ? airportData.elevation_ft : null;

  return (
    <div
      className="glass-panel ui-element"
      style={{
        background: panelBg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${borderCol}`,
        borderRadius: '12px',
        padding: '0',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px',
          borderBottom: collapsed ? 'none' : `1px solid ${borderCol}`,
          cursor: 'pointer', userSelect: 'none',
        }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={14} color="#60a5fa" />
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: textPrimary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Airport Info
          </span>
          {hasData && airportData.type && (
            <span style={{
              fontSize: '0.65rem', padding: '1px 7px', borderRadius: '10px',
              background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.35)',
              color: '#93c5fd',
            }}>
              {airportData.type}
            </span>
          )}
        </div>
        {collapsed
          ? <ChevronDown size={14} color={textSecondary} />
          : <ChevronUp size={14} color={textSecondary} />}
      </div>

      {!collapsed && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* ── Location / Elevation / IATA ──────────────────────── */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <InfoTile
              icon={<MapPin size={12} />}
              label="Location"
              loading={loading}
              value={hasData && (airportData.city || airportData.state)
                ? [airportData.city, airportData.state].filter(Boolean).join(', ')
                : null}
              textSecondary={textSecondary} textPrimary={textPrimary} borderCol={borderCol}
            />
            <InfoTile
              icon={<TrendingUp size={12} />}
              label="Elevation"
              loading={loading}
              value={elevation != null ? `${elevation.toLocaleString()} ft MSL` : null}
              textSecondary={textSecondary} textPrimary={textPrimary} borderCol={borderCol}
            />
            {hasData && airportData.iataCode && (
              <InfoTile
                icon={<span style={{ fontSize: '10px', fontWeight: 700 }}>IATA</span>}
                label="IATA Code"
                loading={false}
                value={airportData.iataCode}
                textSecondary={textSecondary} textPrimary={textPrimary} borderCol={borderCol}
              />
            )}
          </div>

          {/* ── Traffic Pattern Altitude ──────────────────────────── */}
          {(loading || elevation != null) && (
            <div>
              <SectionLabel icon={<Wind size={12} />} label="Traffic Pattern Altitude" textSecondary={textSecondary} />
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '6px' }}>
                  {[1,2,3,4].map(i => <Skeleton key={i} width="100%" height="22px" />)}
                </div>
              ) : (
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {TPA_STANDARDS.map(({ category, agl, color }) => {
                    const msl = elevation + agl;
                    return (
                      <div key={category} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '5px 10px', borderRadius: '7px',
                        background: 'rgba(255,255,255,0.04)', border: `1px solid ${borderCol}`,
                        fontSize: '0.72rem',
                      }}>
                        <span style={{ color: textSecondary }}>{category}</span>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ color: textSecondary, fontSize: '0.67rem' }}>
                            +{agl.toLocaleString()} AGL
                          </span>
                          <span style={{ fontWeight: 700, color, minWidth: '72px', textAlign: 'right' }}>
                            {msl.toLocaleString()} ft MSL
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {/* VFR vs IFR note */}
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '6px',
                    padding: '5px 10px', borderRadius: '7px',
                    background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.2)',
                    fontSize: '0.67rem', color: textSecondary, marginTop: '2px',
                  }}>
                    <span style={{ color: '#fb923c', fontWeight: 700, whiteSpace: 'nowrap' }}>IFR</span>
                    <span>Follow published approach minimums and ATC clearance. TPA does not apply.</span>
                  </div>
                  <p style={{ fontSize: '0.62rem', color: textSecondary, margin: '2px 0 0', lineHeight: 1.4 }}>
                    Standard FAA defaults. Check Chart Supplement for published non-standard TPAs.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Runways ──────────────────────────────────────────── */}
          {(loading || hasRunways) && (
            <div>
              <SectionLabel icon={<Ruler size={12} />} label="Runways" textSecondary={textSecondary} />
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  <Skeleton width="100%" height="26px" />
                  <Skeleton width="100%" height="26px" />
                </div>
              ) : (
                <div style={{ overflowX: 'auto', marginTop: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', color: textPrimary }}>
                    <thead>
                      <tr style={{ color: textSecondary, textAlign: 'left' }}>
                        <Th>ID</Th>
                        <Th>Length</Th>
                        <Th>Width</Th>
                        <Th>Surface</Th>
                        <Th>Lit</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {airportData.runways.map((rwy, i) => (
                        <tr key={i} style={{ borderTop: `1px solid ${borderCol}` }}>
                          <Td>
                            <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                              {rwy.le_ident ?? '—'}/{rwy.he_ident ?? '—'}
                            </span>
                          </Td>
                          <Td>{rwy.length ? `${rwy.length.toLocaleString()} ft` : '—'}</Td>
                          <Td>{rwy.width ? `${rwy.width} ft` : '—'}</Td>
                          <Td>{surfaceLabel(rwy.surface)}</Td>
                          <Td>
                            <span style={{ color: rwy.lighted ? '#86efac' : textSecondary }}>
                              {rwy.lighted ? 'Yes' : 'No'}
                            </span>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Communications ───────────────────────────────────── */}
          {(loading || hasFreqs) && (
            <div>
              <SectionLabel icon={<Radio size={12} />} label="Communications" textSecondary={textSecondary} />
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                  {[1,2,3,4,5].map(i => <Skeleton key={i} width="100%" height="30px" />)}
                </div>
              ) : (
                <CommList frequencies={airportData.frequencies} textSecondary={textSecondary} borderCol={borderCol} />
              )}
            </div>
          )}

          {/* Empty / unavailable states */}
          {!loading && !hasFreqs && !hasRunways && airportData && (
            <p style={{ fontSize: '0.72rem', color: textSecondary, margin: 0, textAlign: 'center', padding: '4px 0' }}>
              No additional details available for this airport.
            </p>
          )}
          {!loading && !airportData && (
            <p style={{ fontSize: '0.72rem', color: textSecondary, margin: 0, textAlign: 'center', padding: '4px 0' }}>
              Airport details unavailable.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Strip redundant airport-name + type-code prefix from a frequency description,
// returning the "extra info" part (sector, runway, complex, etc.) or null if nothing new.
function descHint(raw) {
  if (!raw) return null;
  // Remove leading ALL-CAPS words (airport name) up through the first type keyword
  const stripped = raw
    .replace(/^[A-Z0-9\s\-/'\.]+?\s(?=ATIS|TWR|GND|APP|DEP|CLNC|DEL|CTR|UNIC|CTAF|ASOS|AWOS|FSS)/i, '')
    .replace(/^(ATIS|TWR|GND|APP|DEP|CLNC|DEL|CTR|UNIC|CTAF|ASOS|AWOS|FSS)\s*/i, '')
    .trim();
  return stripped.length > 1 ? stripped : null;
}

// Type-groups for Communications: frequencies grouped by their friendly label.
// Displayed as: colored TYPE pill | MHz (mono) | description hint
function CommList({ frequencies, textSecondary, borderCol }) {
  // Group consecutive same-type frequencies; preserve overall FREQ_ORDER sort.
  const groups = [];
  for (const f of frequencies) {
    const label = freqTypeLabel(f.rawType ?? f.type);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.entries.push(f);
    } else {
      groups.push({ label, entries: [f] });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '6px' }}>
      {groups.map((group, gi) => {
        const st = freqBadgeStyle(group.label);
        return (
          <div
            key={gi}
            style={{
              borderRadius: '9px',
              border: `1px solid ${st.border}`,
              overflow: 'hidden',
              background: group.entries.length === 1 ? st.bg : 'rgba(255,255,255,0.02)',
            }}
          >
            {/* Group header — only shown when multiple frequencies share a type */}
            {group.entries.length > 1 && (
              <div style={{
                padding: '3px 10px',
                background: st.bg,
                borderBottom: `1px solid ${st.border}`,
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span style={{
                  fontSize: '0.58rem', fontWeight: 800, color: st.text,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  {group.label}
                </span>
                <span style={{ fontSize: '0.58rem', color: st.text, opacity: 0.55 }}>
                  {group.entries.length} frequencies
                </span>
              </div>
            )}

            {/* Frequency rows */}
            {group.entries.map((f, fi) => {
              const hint = descHint(f.description);
              return (
                <div
                  key={fi}
                  title={f.description || group.label}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 10px',
                    borderTop: fi > 0 ? `1px solid ${st.border}` : 'none',
                  }}
                >
                  {/* Type pill — only shown for single-entry groups */}
                  {group.entries.length === 1 && (
                    <span style={{
                      flex: '0 0 auto', minWidth: '60px', textAlign: 'center',
                      padding: '2px 6px', borderRadius: '5px',
                      background: st.bg, border: `1px solid ${st.border}`,
                      fontSize: '0.58rem', fontWeight: 700, color: st.text,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {group.label}
                    </span>
                  )}

                  {/* MHz */}
                  <span style={{
                    fontFamily: '"SF Mono", "Fira Code", monospace',
                    fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc',
                    flex: '0 0 auto',
                    // indent sub-rows of a group to align under the header
                    marginLeft: group.entries.length > 1 ? '4px' : 0,
                  }}>
                    {f.mhz.toFixed(3)}
                  </span>

                  {/* Description hint */}
                  {hint ? (
                    <span style={{
                      fontSize: '0.65rem', color: st.text, opacity: 0.75,
                      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {hint}
                    </span>
                  ) : (
                    <span style={{
                      fontSize: '0.65rem', color: textSecondary, opacity: 0.5,
                      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {f.description || ''}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function SectionLabel({ icon, label, textSecondary }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: textSecondary, marginBottom: '2px' }}>
      {icon}
      <span style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
    </div>
  );
}

function InfoTile({ icon, label, value, loading, textSecondary, textPrimary, borderCol }) {
  return (
    <div style={{
      flex: '1 1 120px', padding: '8px 10px', borderRadius: '8px',
      background: 'rgba(255,255,255,0.04)', border: `1px solid ${borderCol}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: textSecondary, marginBottom: '4px' }}>
        {icon}
        <span style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      {loading ? (
        <Skeleton width="80%" height="14px" />
      ) : (
        <div style={{ fontSize: '0.76rem', fontWeight: 600, color: textPrimary }}>
          {value ?? <span style={{ color: textSecondary, fontWeight: 400 }}>N/A</span>}
        </div>
      )}
    </div>
  );
}

function Th({ children }) {
  return (
    <th style={{ padding: '4px 8px 4px 0', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {children}
    </th>
  );
}

function Td({ children }) {
  return <td style={{ padding: '5px 8px 5px 0' }}>{children}</td>;
}
