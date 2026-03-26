import React from 'react';
import { MAP_STYLES, ALTITUDES } from '../constants';

export default function SidebarRight({ 
  altitude, 
  setAltitude, 
  runwayFontSize, 
  setRunwayFontSize, 
  mapStyleKey, 
  setMapStyleKey, 
  setTheme 
}) {
  return (
    <div className="right-controls">
      <div className="altitude-control ui-element">
        <div className="glass-panel text-sm font-medium hover-glow" style={{ padding: '0.5rem 1rem', marginBottom: '1rem', borderRadius: '20px', textAlign: 'center' }}>
          Altitude
        </div>
        <div className="altitude-steps">
          {ALTITUDES.map((alt) => (
            <div
              key={alt.level}
              className={`altitude-step ${altitude === alt.level ? 'active' : ''}`}
              onClick={() => setAltitude(alt.level)}
              title={alt.label}
            >
              {alt.level === 'ground' ? 'GND' : alt.level.replace('k', 'K')}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
        <div className="runway-control ui-element" style={{ padding: '0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="glass-panel text-sm font-medium hover-glow" style={{ padding: '0.4rem 1rem', marginBottom: '0.5rem', borderRadius: '20px', textAlign: 'center' }}>
            Runway Labels
          </div>
          <div className="altitude-steps" style={{ display: 'flex', justifyContent: 'space-between', gap: '5px' }}>
            <div
              className="altitude-step"
              onClick={() => setRunwayFontSize(f => Math.max(8, f - 2))}
              style={{ fontWeight: 'bold' }}
            >A-</div>
            <div className="altitude-step" style={{ background: 'var(--panel-bg)', cursor: 'default' }}>{runwayFontSize}px</div>
            <div
              className="altitude-step"
              onClick={() => setRunwayFontSize(f => Math.min(36, f + 2))}
              style={{ fontWeight: 'bold' }}
            >A+</div>
          </div>
        </div>

        <div className="map-style-control ui-element" style={{ padding: '0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="glass-panel text-sm font-medium hover-glow" style={{ padding: '0.4rem 1rem', marginBottom: '0.5rem', borderRadius: '20px', textAlign: 'center' }}>
            Base Map
          </div>
          <div className="altitude-steps map-style-steps" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            {Object.keys(MAP_STYLES).map(key => (
              <div
                key={key}
                className={`altitude-step ${mapStyleKey === key ? 'active' : ''}`}
                onClick={() => { setMapStyleKey(key); setTheme(key === 'light' ? 'light' : 'dark'); }}
                style={{ fontSize: '0.7rem', padding: '0.3rem' }}
              >
                {MAP_STYLES[key].name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
