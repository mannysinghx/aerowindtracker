/**
 * WeatherOverlay — modular weather layer system for AeroWind Tracker
 *
 * Exports:
 *   WeatherOverlayLayer  — renders inside <MapContainer>
 *   WeatherOverlayPanel  — renders in the UI overlay
 *
 * Sources:
 *   Radar         — RainViewer (free, no key, live tiles)
 *   Satellite IR  — NASA GIBS GOES East WMS (free, no key)
 *   Icing         — AWC PIREP API filtered by /IC + altitude band
 *   Turbulence    — AWC PIREP API filtered by /TB + altitude band
 *   SIGMETs       — AWC GeoJSON API (polygon geometry)
 *
 * App.jsx integration (4 lines):
 *   import { WeatherOverlayLayer, WeatherOverlayPanel } from './components/WeatherOverlay'
 *   const [wxOverlay, setWxOverlay] = useState({ type: null, altitude: 'FL090', opacity: 0.65 })
 *   <WeatherOverlayLayer config={wxOverlay} />          ← inside <MapContainer>
 *   <WeatherOverlayPanel config={wxOverlay} onChange={setWxOverlay} />  ← in overlay UI
 */

import { useState, useEffect } from 'react';
import { TileLayer, WMSTileLayer, CircleMarker, Popup, GeoJSON } from 'react-leaflet';
import { CloudRain, Cloud, Snowflake, Waves, TriangleAlert, X, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function flToInt(flStr) {
  // "FL090" → 90  (same unit as PIREP fltLvl field)
  if (!flStr) return null;
  return parseInt(flStr.replace('FL', ''), 10);
}

// Colour severity labels from AWC PIREP structured fields
const SEV_COLOR_MAP = {
  // Icing: icgInt1 values
  TRACE: '#10b981',
  'TRACE-LGT': '#84cc16',
  LGT: '#a3e635',
  'LGT-MOD': '#eab308',
  MOD: '#f59e0b',
  'MOD-SEV': '#f97316',
  SEV: '#ef4444',
  HVY: '#8b5cf6',
  // Turbulence: tbInt1 values
  'SMTH-LGT': '#10b981',
  'LGT-CHP': '#a3e635',
  'MOD-CHG': '#f59e0b',
  'SEV-EXTRM': '#dc2626',
  EXTRM: '#7c3aed',
};

function sevColor(sev) {
  return SEV_COLOR_MAP[sev] ?? '#94a3b8';
}

// ─── Layer catalogue ──────────────────────────────────────────────────────────

const LAYER_DEFS = [
  {
    id: 'radar',
    label: 'Radar',
    desc: 'Precipitation',
    Icon: CloudRain,
    color: '#3b82f6',
    hasAltitude: false,
  },
  {
    id: 'satellite',
    label: 'Satellite',
    desc: 'IR clouds',
    Icon: Cloud,
    color: '#8b5cf6',
    hasAltitude: false,
  },
  {
    id: 'icing',
    label: 'Icing',
    desc: 'Icing PIREPs',
    Icon: Snowflake,
    color: '#06b6d4',
    hasAltitude: true,
    altitudes: ['FL030', 'FL060', 'FL090', 'FL120', 'FL180', 'FL240'],
    defaultAlt: 'FL090',
    pirepCode: 'IC',
  },
  {
    id: 'turbulence',
    label: 'Turbulence',
    desc: 'Turbulence PIREPs',
    Icon: Waves,
    color: '#f59e0b',
    hasAltitude: true,
    altitudes: ['FL030', 'FL060', 'FL090', 'FL120', 'FL180', 'FL240', 'FL300', 'FL340'],
    defaultAlt: 'FL180',
    pirepCode: 'TB',
  },
  {
    id: 'sigmet',
    label: 'SIGMETs',
    desc: 'Active SIGMETs',
    Icon: TriangleAlert,
    color: '#ef4444',
    hasAltitude: false,
  },
];

const LAYER_MAP = Object.fromEntries(LAYER_DEFS.map(l => [l.id, l]));

// ─── Data hooks ───────────────────────────────────────────────────────────────

function useRainViewerPath(enabled) {
  const [path, setPath] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const frames = data?.radar?.past ?? [];
        if (frames.length) setPath(frames[frames.length - 1].path);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enabled]);
  return path;
}

function usePirepLayer(enabled, pirepCode, altitude) {
  const [rawPoints, setRawPoints] = useState([]);
  // Derive cleared state without an effect — avoids cascading render from setState-in-effect
  const points = enabled ? rawPoints : [];
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const targetFl = flToInt(altitude); // e.g. 90 for FL090

    fetch('/wx/api/data/pirep?format=json&bbox=20,-130,50,-60')
      .then(r => r.json())
      .then(data => {
        if (cancelled || !Array.isArray(data)) return;

        const parsed = data
          .filter(p => {
            if (!p.lat || !p.lon) return false;
            // Altitude band filter (±50 FL = ±5000 ft) when altitude is selected
            if (targetFl !== null && p.fltLvl != null) {
              if (Math.abs(p.fltLvl - targetFl) > 50) return false;
            }
            if (pirepCode === 'IC') {
              return p.icgInt1 && p.icgInt1 !== 'NEG' && p.icgInt1 !== '';
            } else {
              // Turbulence: exclude smooth/negative
              return p.tbInt1 && !['NEG', 'SMTH', 'SMTH-LGT', ''].includes(p.tbInt1);
            }
          })
          .map(p => ({
            lat: p.lat,
            lon: p.lon,
            severity: pirepCode === 'IC' ? (p.icgInt1 ?? 'UNKNOWN') : (p.tbInt1 ?? 'UNKNOWN'),
            altFl: p.fltLvl,
            raw: (p.rawOb || '').substring(0, 150),
          }));
        setRawPoints(parsed);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enabled, pirepCode, altitude]);
  return points;
}

function useSigmetGeoJSON(enabled) {
  const [rawGeojson, setRawGeojson] = useState(null);
  // Derive cleared state without an effect
  const geojson = enabled ? rawGeojson : null;
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch('/wx/api/data/sigmet?format=geojson')
      .then(r => r.json())
      .then(data => { if (!cancelled) setRawGeojson(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enabled]);
  return geojson;
}

// ─── Map Layer Renderer ───────────────────────────────────────────────────────

export function WeatherOverlayLayer({ config }) {
  const { type, altitude, opacity } = config;
  const def = type ? LAYER_MAP[type] : null;

  // All hooks called unconditionally — enabled flags gate their work
  const radarPath  = useRainViewerPath(type === 'radar');
  const icingPts   = usePirepLayer(type === 'icing',       'IC', altitude);
  const turbPts    = usePirepLayer(type === 'turbulence',  'TB', altitude);
  const sigmetGeo  = useSigmetGeoJSON(type === 'sigmet');

  if (!def) return null;

  // ── Radar: RainViewer live precipitation tiles ──
  if (type === 'radar') {
    if (!radarPath) return null;
    return (
      <TileLayer
        key={radarPath}
        url={`https://tilecache.rainviewer.com${radarPath}/256/{z}/{x}/{y}/2/1_1.png`}
        opacity={opacity}
        tileSize={256}
        maxNativeZoom={12}
        maxZoom={20}
        bounds={[[20, -126], [50, -63]]}
        zIndex={6}
        attribution='<a href="https://rainviewer.com" target="_blank">RainViewer</a>'
      />
    );
  }

  // ── Satellite: NASA GIBS GOES East Band 13 (10.3µm IR window) ──
  if (type === 'satellite') {
    return (
      <WMSTileLayer
        key="gibs-goes-ir"
        url="https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi"
        layers="GOES_East_CONUS_Band13_Clean_Longwave_Window_BT"
        styles=""
        format="image/png"
        transparent={true}
        version="1.3.0"
        opacity={opacity}
        maxNativeZoom={9}
        maxZoom={20}
        zIndex={6}
        attribution='<a href="https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs" target="_blank">NASA GIBS</a>'
      />
    );
  }

  // ── Icing PIREPs: circles colored by severity ──
  if (type === 'icing') {
    if (icingPts.length === 0) return null;
    return icingPts.map((p, i) => (
      <CircleMarker
        key={`ic-${i}-${p.lat}-${p.lon}`}
        center={[p.lat, p.lon]}
        radius={7}
        pathOptions={{
          color: sevColor(p.severity),
          fillColor: sevColor(p.severity),
          fillOpacity: opacity,
          weight: 2,
        }}
      >
        <Popup>
          <div style={{ fontFamily: 'sans-serif', fontSize: '13px' }}>
            <strong>Icing PIREP</strong><br />
            <span style={{ color: sevColor(p.severity) }}>● {p.severity}</span><br />
            Alt: {p.altFl != null ? `FL${p.altFl}` : 'Unknown'}<br />
            <code style={{ fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{p.raw}</code>
          </div>
        </Popup>
      </CircleMarker>
    ));
  }

  // ── Turbulence PIREPs: circles colored by severity ──
  if (type === 'turbulence') {
    if (turbPts.length === 0) return null;
    return turbPts.map((p, i) => (
      <CircleMarker
        key={`tb-${i}-${p.lat}-${p.lon}`}
        center={[p.lat, p.lon]}
        radius={7}
        pathOptions={{
          color: sevColor(p.severity),
          fillColor: sevColor(p.severity),
          fillOpacity: opacity,
          weight: 2,
        }}
      >
        <Popup>
          <div style={{ fontFamily: 'sans-serif', fontSize: '13px' }}>
            <strong>Turbulence PIREP</strong><br />
            <span style={{ color: sevColor(p.severity) }}>● {p.severity}</span><br />
            Alt: {p.altFl != null ? `FL${p.altFl}` : 'Unknown'}<br />
            <code style={{ fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{p.raw}</code>
          </div>
        </Popup>
      </CircleMarker>
    ));
  }

  // ── SIGMETs: polygon overlays from AWC GeoJSON API ──
  if (type === 'sigmet') {
    if (!sigmetGeo?.features?.length) return null;
    return (
      <GeoJSON
        key={`sigmet-${sigmetGeo.features.length}`}
        data={sigmetGeo}
        style={() => ({
          color: '#ef4444',
          weight: 2,
          dashArray: '6 4',
          fillColor: '#ef4444',
          fillOpacity: Math.min(opacity * 0.4, 0.5),
        })}
        onEachFeature={(feature, layer) => {
          const p = feature.properties ?? {};
          const lo = p.altitudeLow1 != null ? `${p.altitudeLow1} ft` : 'SFC';
          const hi = p.altitudeHi1  != null ? `${p.altitudeHi1} ft` : 'UNL';
          layer.bindPopup(`
            <div style="font-family:sans-serif;font-size:13px">
              <strong>SIGMET ${p.alphaChar ?? ''}</strong><br/>
              Hazard: <strong>${p.hazard ?? 'N/A'}</strong><br/>
              Altitude: ${lo} – ${hi}<br/>
              <code style="font-size:11px;white-space:pre-wrap;word-break:break-all">${(p.rawAirSigmet ?? '').substring(0, 200)}</code>
            </div>
          `);
        }}
      />
    );
  }

  return null;
}

// ─── Control Panel ────────────────────────────────────────────────────────────

export function WeatherOverlayPanel({ config, onChange }) {
  const { type, altitude, opacity } = config;
  const [collapsed, setCollapsed] = useState(true);
  const def = type ? LAYER_MAP[type] : null;

  function selectLayer(id) {
    const next = LAYER_MAP[id];
    onChange({
      ...config,
      type: type === id ? null : id,
      altitude: type === id ? config.altitude : (next.defaultAlt ?? null),
    });
  }

  return (
    <div
      className="glass-panel ui-element"
      style={{ width: '230px', padding: '12px', pointerEvents: 'auto' }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: collapsed ? 0 : '10px',
          paddingBottom: collapsed ? 0 : '8px',
          borderBottom: collapsed ? 'none' : '1px solid var(--panel-border)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CloudRain size={14} color="var(--accent-color)" />
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase' }}>
            Weather Overlay
          </span>
          {type && (
            <span style={{
              background: def?.color ?? 'var(--accent-color)',
              color: '#fff',
              borderRadius: '999px',
              padding: '1px 6px',
              fontSize: '0.58rem',
              fontWeight: 700,
            }}>
              {def?.label}
            </span>
          )}
        </div>
        {collapsed
          ? <ChevronDown size={13} color="var(--text-secondary)" />
          : <ChevronUp size={13} color="var(--text-secondary)" />}
      </div>

      {!collapsed && (
        <>
          {/* Layer buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
            {LAYER_DEFS.map(layer => {
              const active = type === layer.id;
              const Icon = layer.Icon;
              return (
                <button
                  key={layer.id}
                  onClick={() => selectLayer(layer.id)}
                  title={layer.desc}
                  style={{
                    background: active ? layer.color : 'var(--bg-color)',
                    border: `1px solid ${active ? layer.color : 'var(--panel-border)'}`,
                    borderRadius: '8px',
                    padding: '7px 4px 5px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '3px',
                    color: active ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                    boxShadow: active ? `0 0 10px ${layer.color}55` : 'none',
                  }}
                >
                  <Icon size={15} />
                  <span style={{ fontSize: '0.62rem', fontWeight: 700 }}>{layer.label}</span>
                  <span style={{ fontSize: '0.55rem', opacity: 0.75 }}>{layer.desc}</span>
                </button>
              );
            })}
          </div>

          {/* Altitude picker — only when layer uses it */}
          {def?.hasAltitude && def.altitudes && (
            <div style={{ marginBottom: '10px' }}>
              <span style={{ display: 'block', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '5px' }}>
                Altitude band ± 5,000 ft
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {def.altitudes.map(alt => {
                  const active = altitude === alt;
                  return (
                    <button
                      key={alt}
                      onClick={() => onChange({ ...config, altitude: alt })}
                      style={{
                        background: active ? def.color : 'transparent',
                        border: `1px solid ${active ? def.color : 'var(--panel-border)'}`,
                        borderRadius: '4px',
                        padding: '2px 7px',
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        color: active ? '#fff' : 'var(--text-secondary)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {alt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Opacity slider */}
          {type && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase' }}>Opacity</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.1} max={1} step={0.05}
                value={opacity}
                onChange={e => onChange({ ...config, opacity: Number(e.target.value) })}
                style={{ width: '100%', accentColor: def?.color ?? 'var(--accent-color)' }}
              />
            </div>
          )}

          {/* Clear */}
          {type && (
            <button
              onClick={() => onChange({ ...config, type: null })}
              style={{
                width: '100%',
                background: 'transparent',
                border: '1px solid var(--panel-border)',
                borderRadius: '6px',
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                color: 'var(--text-secondary)',
                fontSize: '0.65rem',
                fontWeight: 600,
              }}
            >
              <X size={11} /> Clear overlay
            </button>
          )}
        </>
      )}
    </div>
  );
}
