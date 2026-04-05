import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp, Radio, Ruler, MapPin, TrendingUp } from 'lucide-react';

// OurAirports surface codes → friendly labels
const SURFACE_MAP = {
  ASPH:    'Asphalt',
  'ASPH-G':'Asphalt (grooved)',
  'ASPH-F':'Asphalt',
  CONC:    'Concrete',
  'CONC-G':'Concrete (grooved)',
  'CONC-E':'Concrete',
  TURF:    'Turf',
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
  UNKNOWN: 'Unknown',
};

function surfaceLabel(raw) {
  if (!raw) return 'Unknown';
  const upper = raw.toUpperCase().replace(/-E$/, '').replace(/-F$/, '');
  return SURFACE_MAP[upper] ?? SURFACE_MAP[raw.toUpperCase()] ?? raw;
}

// Frequency type colors for badges
const FREQ_COLORS = {
  ATIS:       { bg: 'rgba(99,102,241,0.2)',  border: '#6366f1', text: '#a5b4fc' },
  ASOS:       { bg: 'rgba(99,102,241,0.2)',  border: '#6366f1', text: '#a5b4fc' },
  AWOS:       { bg: 'rgba(99,102,241,0.2)',  border: '#6366f1', text: '#a5b4fc' },
  Tower:      { bg: 'rgba(34,197,94,0.15)',  border: '#22c55e', text: '#86efac' },
  Ground:     { bg: 'rgba(59,130,246,0.15)', border: '#3b82f6', text: '#93c5fd' },
  Approach:   { bg: 'rgba(249,115,22,0.15)', border: '#f97316', text: '#fdba74' },
  Departure:  { bg: 'rgba(249,115,22,0.15)', border: '#f97316', text: '#fdba74' },
  CTAF:       { bg: 'rgba(234,179,8,0.15)',  border: '#eab308', text: '#fde047' },
  UNICOM:     { bg: 'rgba(234,179,8,0.15)',  border: '#eab308', text: '#fde047' },
  Clearance:  { bg: 'rgba(168,85,247,0.15)', border: '#a855f7', text: '#d8b4fe' },
};

function freqBadgeStyle(type) {
  return FREQ_COLORS[type] ?? { bg: 'rgba(255,255,255,0.08)', border: 'var(--panel-border)', text: 'var(--text-secondary)' };
}

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

  const panelBg = theme === 'dark' ? 'rgba(15,23,42,0.82)' : 'rgba(255,255,255,0.85)';
  const borderCol = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const textPrimary = theme === 'dark' ? '#e2e8f0' : '#1e293b';
  const textSecondary = theme === 'dark' ? '#94a3b8' : '#64748b';

  const hasData = !loading && airportData;
  const hasFreqs = hasData && airportData.frequencies?.length > 0;
  const hasRunways = hasData && airportData.runways?.length > 0;

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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderBottom: collapsed ? 'none' : `1px solid ${borderCol}`,
          cursor: 'pointer',
          userSelect: 'none',
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

          {/* ── Location row ─────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <InfoTile
              icon={<MapPin size={12} />}
              label="Location"
              loading={loading}
              value={hasData && (airportData.city || airportData.state)
                ? [airportData.city, airportData.state].filter(Boolean).join(', ')
                : null}
              textSecondary={textSecondary}
              textPrimary={textPrimary}
              borderCol={borderCol}
            />
            <InfoTile
              icon={<TrendingUp size={12} />}
              label="Elevation"
              loading={loading}
              value={hasData && airportData.elevation_ft != null
                ? `${airportData.elevation_ft.toLocaleString()} ft MSL`
                : null}
              textSecondary={textSecondary}
              textPrimary={textPrimary}
              borderCol={borderCol}
            />
            {hasData && airportData.iataCode && (
              <InfoTile
                icon={<span style={{ fontSize: '10px', fontWeight: 700 }}>IATA</span>}
                label="IATA Code"
                loading={false}
                value={airportData.iataCode}
                textSecondary={textSecondary}
                textPrimary={textPrimary}
                borderCol={borderCol}
              />
            )}
          </div>

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
                  <table style={{
                    width: '100%', borderCollapse: 'collapse',
                    fontSize: '0.72rem', color: textPrimary,
                  }}>
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {[80, 110, 90, 95, 105].map(w => <Skeleton key={w} width={`${w}px`} height="26px" />)}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {airportData.frequencies.map((f, i) => {
                    const st = freqBadgeStyle(f.type);
                    return (
                      <div
                        key={i}
                        title={f.description || f.type}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          padding: '5px 10px', borderRadius: '8px', minWidth: '72px',
                          background: st.bg, border: `1px solid ${st.border}`,
                        }}
                      >
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: st.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {f.type}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f8fafc', marginTop: '1px' }}>
                          {f.mhz.toFixed(3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
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
