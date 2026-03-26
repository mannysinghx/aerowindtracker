import React, { useState } from 'react';
import { FileWarning, ChevronDown, ChevronUp, Bot } from 'lucide-react';

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

const CATEGORY_ORDER = [
  'Runway', 'Airspace', 'Navigation', 'Obstacle',
  'Taxiway/Apron', 'Communications', 'Services', 'General',
];

function groupByCategory(notams) {
  const groups = {};
  for (const n of notams) {
    if (!groups[n.category]) groups[n.category] = [];
    groups[n.category].push(n);
  }
  // Return sorted by operational priority
  return CATEGORY_ORDER
    .filter(cat => groups[cat])
    .map(cat => ({ category: cat, items: groups[cat] }));
}

function NotamItem({ notam, textPrimary, textSecondary, borderColor, isDark }) {
  const [open, setOpen] = useState(false);
  const preview = notam.text.length > 120 ? notam.text.slice(0, 120) + '…' : notam.text;

  return (
    <div
      style={{
        borderBottom: `1px solid ${borderColor}`,
        padding: '8px 0',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          padding: 0,
          color: textPrimary,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
          <p style={{ margin: 0, fontSize: '0.72rem', lineHeight: 1.45, color: open ? textPrimary : textSecondary, flex: 1 }}>
            {open ? notam.text : preview}
          </p>
          <span style={{ flexShrink: 0, marginTop: '1px', color: textSecondary }}>
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </span>
        </div>
      </button>
    </div>
  );
}

export default function NotamPanel({ notamData, loading, theme }) {
  const [expanded, setExpanded] = useState(false);

  const isDark = theme === 'dark';
  const panelBg = isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.95)';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const digestBg = isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)';

  const groups = groupByCategory(notamData?.notams || []);
  const count = notamData?.count ?? 0;

  return (
    <div
      className="glass-panel ui-element"
      style={{
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
          <FileWarning size={14} color="#f59e0b" />
          <span>NOTAMs</span>
          {loading && (
            <span style={{ fontSize: '0.7rem', color: textSecondary }}>Loading…</span>
          )}
          {!loading && notamData && (
            <span
              style={{
                background: count > 0 ? '#f59e0b' : '#64748b',
                color: '#fff',
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '1px 7px',
                borderRadius: '10px',
              }}
            >
              {count}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 14px' }}>
          {loading && (
            <p style={{ color: textSecondary, fontSize: '0.8rem', textAlign: 'center', padding: '16px 0' }}>
              Fetching NOTAMs…
            </p>
          )}

          {!loading && !notamData && (
            <p style={{ color: textSecondary, fontSize: '0.8rem', textAlign: 'center', padding: '12px 0' }}>
              NOTAM data unavailable.
            </p>
          )}

          {!loading && notamData && (
            <>
              {/* AI Digest */}
              {notamData.digest && (
                <div
                  style={{
                    background: digestBg,
                    border: `1px solid rgba(59,130,246,0.25)`,
                    borderRadius: '8px',
                    padding: '10px 12px',
                    marginBottom: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <Bot size={12} color="#3b82f6" />
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      AI Digest
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: textPrimary, lineHeight: 1.5 }}>
                    {notamData.digest}
                  </p>
                </div>
              )}

              {count === 0 && (
                <p style={{ color: textSecondary, fontSize: '0.8rem', textAlign: 'center', padding: '8px 0' }}>
                  No active NOTAMs for this airport.
                </p>
              )}

              {/* Grouped NOTAMs */}
              {groups.map(({ category, items }) => (
                <div key={category} style={{ marginBottom: '10px' }}>
                  <div
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <span>{CATEGORY_ICON[category] || '📋'}</span>
                    <span>{category}</span>
                    <span
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                        borderRadius: '8px',
                        padding: '0 5px',
                        fontSize: '0.6rem',
                      }}
                    >
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
