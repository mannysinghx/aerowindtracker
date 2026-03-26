import React from 'react';
import { Wind, Search, AlertTriangle, Target } from 'lucide-react';

export default function SidebarLeft({
  theme,
  alertFeed,
  searchQuery,
  handleSearch,
  searchResults,
  selectAirport
}) {
  return (
    <div className="left-controls" style={{ position: 'absolute', top: '20px', left: '20px', display: 'flex', flexDirection: 'column', gap: '15px', zIndex: 1000, pointerEvents: 'none', maxHeight: 'calc(100vh - 40px)' }}>
      {/* Main App Title */}
      <div className="glass-panel ui-element" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', pointerEvents: 'auto', alignSelf: 'flex-start', border: '1px solid var(--panel-border)', borderRadius: '12px', background: theme === 'dark' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
        <Wind className="brand-icon" size={16} color="var(--accent-color)" />
        <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)', marginLeft: '8px', letterSpacing: '0.5px' }}>AeroWind Tracker</h1>
        <span style={{ background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '8px', fontSize: '0.55rem', fontWeight: 'bold', marginLeft: '8px', boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            BETA - Experimental
        </span>
      </div>

      {/* AI Agent Alerts Sidebar */}
      <div className="glass-panel ui-element" style={{ width: '280px', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 1, borderTop: '3px solid var(--accent-color)', borderRadius: '12px' }}>
        <div style={{ padding: '10px 15px', background: 'var(--panel-bg)', borderBottom: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
          <AlertTriangle size={16} color="var(--accent-color)" />
          <span>AeroGuard AI Alerts</span>
          <span style={{ marginLeft: 'auto', background: 'var(--accent-color)', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem' }}>LIVE</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '30vh' }}>
          {alertFeed.length === 0 ? (
            <div className="text-secondary text-sm" style={{ textAlign: 'center', padding: '10px' }}>Analyzing airspace...</div>
          ) : (
            alertFeed.map((alert, idx) => (
              <div key={idx} className="alert-card hover-glow" onClick={() => selectAirport({ id: alert.id, name: alert.id, lat: alert.lat, lon: alert.lon })} style={{ cursor: 'pointer', padding: '10px', background: 'var(--panel-bg)', borderLeft: `3px solid ${alert.severity === 'HIGH' ? '#ef4444' : '#f59e0b'}`, borderRadius: '6px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{alert.id}</span>
                  <span style={{ color: alert.severity === 'HIGH' ? '#ef4444' : '#f59e0b', fontSize: '0.75rem', fontWeight: 'bold' }}>{alert.severity}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: '1.3' }}>{alert.message}</div>
                <div style={{ marginTop: '5px', fontSize: '0.7rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Target size={10} /> View on Map
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Search Bar Map Overlay */}
      <div className="glass-panel ui-element" style={{ width: '280px', pointerEvents: 'auto', borderRadius: '12px', padding: '12px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search US Airports..."
            value={searchQuery}
            onChange={handleSearch}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', outline: 'none', paddingLeft: '30px', fontSize: '0.9rem' }}
          />
        </div>
        {searchResults.length > 0 && (
          <div className="search-results" style={{ marginTop: '10px', borderTop: '1px solid var(--panel-border)', paddingTop: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {searchResults.map(res => (
              <div
                key={res.id}
                onClick={() => selectAirport(res)}
                className="hover-glow"
                style={{ padding: '8px', cursor: 'pointer', borderRadius: '4px', transition: 'background 0.2s' }}
              >
                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.9rem' }}>{res.id}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
