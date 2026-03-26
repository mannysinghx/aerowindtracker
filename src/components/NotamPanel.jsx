import React, { useState } from 'react';
import { FileWarning, ChevronDown, ChevronUp, Bot } from 'lucide-react';
import { parseNotamDate } from '../utils/timezone';

const CATEGORY_ICON = {
  'Runway':         '🛬',
  'Taxiway/Apron':  '🛞',
  'Navigation':     '📡',
  'Communications': '📻',
  'Obstacle':       '⚠️',
  'Airspace':       '🚁',
  'Services':       '⛽',
  'General':        '📋',
};

const CATEGORY_ORDER = ['Runway','Airspace','Navigation','Obstacle','Taxiway/Apron','Communications','Services','General'];

function groupByCategory(notams) {
  const groups = {};
  for (const n of notams) {
    if (!groups[n.category]) groups[n.category] = [];
    groups[n.category].push(n);
  }
  return CATEGORY_ORDER.filter(cat => groups[cat]).map(cat => ({ category: cat, items: groups[cat] }));
}

// Common NOTAM abbreviations → plain English
const NOTAM_ABBREVS = {
  'U/S': 'out of service', 'OTS': 'out of service',
  'ACFT': 'aircraft', 'AP': 'airport', 'APCH': 'approach',
  'AUTH': 'authorized', 'AVBL': 'available', 'BTN': 'between',
  'CLSD': 'closed', 'CTC': 'contact', 'CMSND': 'commissioned',
  'DEP': 'departure', 'DLY': 'daily', 'EXC': 'except',
  'HGT': 'height', 'HRS': 'hours', 'LGT': 'light/lighting',
  'MNT': 'maintenance', 'MIL': 'military', 'NA': 'not available',
  'OPR': 'operator', 'PPR': 'prior permission required',
  'REQ': 'required', 'RMK': 'remark', 'SFC': 'surface',
  'TIL': 'until', 'TWY': 'taxiway', 'RWY': 'runway',
  'AGL': 'ft above ground level', 'MSL': 'ft above mean sea level',
  'OBST': 'obstacle', 'WIP': 'work in progress',
  'CONST': 'construction', 'PERM': 'permanent',
  'TEMPO': 'temporarily', 'INTER': 'intermittently',
  'ACT': 'active', 'INACT': 'inactive', 'AVGAS': 'aviation gasoline',
  'MON': 'Monday', 'TUE': 'Tuesday', 'WED': 'Wednesday',
  'THU': 'Thursday', 'FRI': 'Friday', 'SAT': 'Saturday', 'SUN': 'Sunday',
  'SR': 'sunrise', 'SS': 'sunset', 'H24': '24 hours',
  'ATIS': 'ATIS', 'ASOS': 'ASOS', 'AWOS': 'AWOS',
  'ILS': 'ILS', 'VOR': 'VOR', 'NDB': 'NDB', 'DME': 'DME',
  'LOC': 'localizer', 'GP': 'glidepath', 'OM': 'outer marker',
  'MM': 'middle marker', 'IM': 'inner marker',
  'TAR': 'terminal area radar', 'SSR': 'secondary surveillance radar',
  'RNAV': 'area navigation', 'GPS': 'GPS',
};

function decodeNotamText(text) {
  // Sort by length descending so longer abbreviations match first
  const sorted = Object.entries(NOTAM_ABBREVS).sort((a, b) => b[0].length - a[0].length);
  let s = text;
  for (const [abbr, full] of sorted) {
    s = s.replace(new RegExp(`\\b${abbr}\\b`, 'g'), full);
  }
  return s;
}

function parseNotamStructure(text, timezone) {
  // Pull out Q/A/B/C/D/E sections
  const clean = text.replace(/\r/g, '').replace(/\n/g, ' ');

  const q = clean.match(/Q\)\s*([^\n A-Z)]+(?:\s+[^\n A-Z)]+)?)/)?.[1]?.trim();
  const a = clean.match(/A\)\s*([\w\s,]+?)(?=\s+[B-Z]\)|$)/)?.[1]?.trim();
  const b = clean.match(/B\)\s*(\w+)/)?.[1];
  const c = clean.match(/C\)\s*(\w+)/)?.[1];
  const e = clean.match(/E\)\s*(.*?)(?=\s+[F-Z]\)|$)/s)?.[1]?.trim();

  const sections = [];

  if (a) sections.push({ label: 'Location', value: a });

  if (b) {
    const bDate = parseNotamDate(b, timezone);
    sections.push({ label: 'Effective', value: bDate || b });
  }
  if (c) {
    const cDate = parseNotamDate(c, timezone);
    sections.push({ label: 'Expires', value: cDate || c });
  }

  if (e) {
    sections.push({ label: 'Details', value: decodeNotamText(e) });
  }

  return sections;
}

function NotamItem({ notam, textPrimary, textSecondary, borderColor, isDark, decoded, timezone }) {
  const [open, setOpen] = useState(false);
  const preview = notam.text.length > 120 ? notam.text.slice(0, 120) + '…' : notam.text;

  const pillBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  return (
    <div style={{ borderBottom: `1px solid ${borderColor}`, padding: '8px 0' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, color: textPrimary }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
          <p style={{ margin: 0, fontSize: '0.72rem', lineHeight: 1.45, color: open ? textPrimary : textSecondary, flex: 1 }}>
            {open ? (decoded ? null : notam.text) : preview}
          </p>
          <span style={{ flexShrink: 0, marginTop: '1px', color: textSecondary }}>
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </span>
        </div>
      </button>

      {open && decoded && (() => {
        const sections = parseNotamStructure(notam.text, timezone);
        return (
          <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {sections.map(({ label, value }) => (
              <div key={label} style={{ background: pillBg, borderRadius: '6px', padding: '5px 8px' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: '0.72rem', color: textPrimary, lineHeight: 1.45 }}>{value}</div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

export default function NotamPanel({ notamData, loading, theme, timezone }) {
  const [expanded, setExpanded] = useState(false);
  const [useLocal, setUseLocal] = useState(!!timezone);
  const [decoded, setDecoded] = useState(false);

  const isDark = theme === 'dark';
  const panelBg = isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.95)';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const digestBg = isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)';
  const pillBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const groups = groupByCategory(notamData?.notams || []);
  const count = notamData?.count ?? 0;

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
          <FileWarning size={14} color="#f59e0b" />
          <span>NOTAMs</span>
          {loading && <span style={{ fontSize: '0.7rem', color: textSecondary }}>Loading…</span>}
          {!loading && notamData && (
            <span style={{ background: count > 0 ? '#f59e0b' : '#64748b', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px', borderRadius: '10px' }}>
              {count}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 14px' }}>
          {loading && <p style={{ color: textSecondary, fontSize: '0.8rem', textAlign: 'center', padding: '16px 0' }}>Fetching NOTAMs…</p>}
          {!loading && !notamData && <p style={{ color: textSecondary, fontSize: '0.8rem', textAlign: 'center', padding: '12px 0' }}>NOTAM data unavailable.</p>}

          {!loading && notamData && (
            <>
              {/* Toolbar */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <button style={btnStyle(!useLocal)} onClick={() => setUseLocal(false)}>UTC</button>
                {timezone && (
                  <button style={btnStyle(useLocal)} onClick={() => setUseLocal(true)}>Local</button>
                )}
                <button style={btnStyle(decoded)} onClick={() => setDecoded(d => !d)}>
                  {decoded ? 'Decoded' : 'Decode'}
                </button>
              </div>

              {/* AI Digest */}
              {notamData.digest && (
                <div style={{ background: digestBg, border: '1px solid rgba(59,130,246,0.25)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <Bot size={12} color="#3b82f6" />
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Digest</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: textPrimary, lineHeight: 1.5 }}>{notamData.digest}</p>
                </div>
              )}

              {count === 0 && (
                <p style={{ color: textSecondary, fontSize: '0.8rem', textAlign: 'center', padding: '8px 0' }}>No active NOTAMs for this airport.</p>
              )}

              {/* Grouped NOTAMs */}
              {groups.map(({ category, items }) => (
                <div key={category} style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>{CATEGORY_ICON[category] || '📋'}</span>
                    <span>{category}</span>
                    <span style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', borderRadius: '8px', padding: '0 5px', fontSize: '0.6rem' }}>
                      {items.length}
                    </span>
                  </div>
                  {items.map(n => (
                    <NotamItem
                      key={n.id}
                      notam={n}
                      textPrimary={textPrimary}
                      textSecondary={textSecondary}
                      borderColor={borderColor}
                      isDark={isDark}
                      decoded={decoded}
                      timezone={useLocal && timezone ? timezone : 'UTC'}
                    />
                  ))}
                </div>
              ))}

              <p style={{ margin: '10px 0 0', fontSize: '0.65rem', color: textSecondary, lineHeight: 1.4 }}>
                Source: FAA NOTAM Search · Not for real-world navigation. Verify via 1800wxbrief.com or ForeFlight.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
