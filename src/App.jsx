import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Wind, Thermometer, Droplets, Navigation, X, AlertTriangle, RefreshCw, Search, Expand, Target, Sun, Moon } from 'lucide-react';
import { fetchLiveAIData } from './services/api';
import './App.css';

const ALTITUDES = [
  { level: '18k', label: '18,000 ft' },
  { level: '12k', label: '12,000 ft' },
  { level: '9k', label: '9,000 ft' },
  { level: '6k', label: '6,000 ft' },
  { level: '3k', label: '3,000 ft' },
  { level: 'ground', label: 'Ground' },
];

function getWindColor(speed) {
  if (speed === null || speed === undefined) return '#94a3b8';
  if (speed < 5) return '#10b981';
  if (speed < 15) return '#3b82f6';
  if (speed < 25) return '#f59e0b';
  if (speed < 40) return '#ef4444';
  return '#8b5cf6';
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getBestRunway(runways, windDir) {
  if (!runways || runways.length === 0 || windDir === null) return null;
  let bestRunway = null;
  let minDiff = Infinity;

  for (const rw of runways) {
    const checkHdg = (heading, ident) => {
      let diff = Math.abs(windDir - heading);
      if (diff > 180) diff = 360 - diff;
      if (diff < minDiff) {
        minDiff = diff;
        bestRunway = ident;
      }
    };

    if (rw.le_heading !== null && rw.le_ident) {
      checkHdg(rw.le_heading, rw.le_ident);
    } else if (rw.le_ident) {
      let num = parseInt(rw.le_ident.replace(/[^0-9]/g, ''));
      if (!isNaN(num)) checkHdg(num * 10, rw.le_ident);
    }

    if (rw.he_heading !== null && rw.he_ident) {
      checkHdg(rw.he_heading, rw.he_ident);
    } else if (rw.he_ident) {
      let num = parseInt(rw.he_ident.replace(/[^0-9]/g, ''));
      if (!isNaN(num)) checkHdg(num * 10, rw.he_ident);
    }
  }
  return bestRunway;
}

function BoundsTracker({ setBounds, setZoom }) {
  const map = useMapEvents({
    moveend: () => { setBounds(map.getBounds()); setZoom(map.getZoom()); },
    zoomend: () => { setBounds(map.getBounds()); setZoom(map.getZoom()); },
  });

  useEffect(() => {
    setBounds(map.getBounds());
    setZoom(map.getZoom());
  }, [map, setBounds, setZoom]);

  return null;
}

function MapController({ targetPos }) {
  const map = useMap();
  useEffect(() => {
    if (targetPos) {
      map.flyTo(targetPos, 10, { duration: 1.5 });
    }
  }, [targetPos, map]);
  return null;
}

function App() {
  const [theme, setTheme] = useState('dark');
  const [altitude, setAltitude] = useState('ground');
  const [stations, setStations] = useState([]);
  const [aloftData, setAloftData] = useState([]);
  const [allAirports, setAllAirports] = useState([]);
  const [runwaysData, setRunwaysData] = useState({});
  const [mapBounds, setMapBounds] = useState(null);
  const [mapZoom, setMapZoom] = useState(5);
  const [selectedStation, setSelectedStation] = useState(null);
  const [alertFeed, setAlertFeed] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchTarget, setSearchTarget] = useState(null);
  const [searchedAirport, setSearchedAirport] = useState(null);

  // Custom user control for runway labels visibility
  const [runwayFontSize, setRunwayFontSize] = useState(16);

  // Map style state
  const [mapStyle, setMapStyle] = useState('dark_all');
  const [mapStyleName, setMapStyleName] = useState('Dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(t => {
      const newTheme = t === 'dark' ? 'light' : 'dark';
      setMapStyle(newTheme === 'dark' ? 'dark_all' : 'light_all');
      setMapStyleName(newTheme === 'dark' ? 'Dark' : 'Light');
      return newTheme;
    });
  };

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (isMounted && stations.length === 0) setLoading(true);

      const liveData = await fetchLiveAIData();
      if (!liveData) {
        setLoading(false);
        return;
      }

      const { ground, aloft, alerts, lastUpdated: updateTime } = liveData;

      if (allAirports.length === 0) {
        let airports = [];
        try {
          const res = await fetch('/us_airports.json');
          if (res.ok) airports = await res.json();
        } catch (e) { }

        let runways = {};
        try {
          const res = await fetch('/us_runways.json');
          if (res.ok) runways = await res.json();
        } catch (e) { }

        if (isMounted) {
          setAllAirports(airports);
          setRunwaysData(runways);
        }
      }

      if (isMounted) {
        setStations(ground || []);
        setAloftData(aloft || []);
        setAlertFeed(alerts || []);
        setLastUpdated(updateTime ? new Date(updateTime).toLocaleTimeString() : null);
        setLoading(false);
      }
    }

    // Initial load
    loadData();

    // Autonomous polling every 5 minutes (300,000 ms)
    const interval = setInterval(() => {
      console.log("Autonomous agent syncing data...");
      loadData();
    }, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const displayPoints = useMemo(() => {
    if (!mapBounds || stations.length === 0) return [];

    let targetAirports = [];

    if (allAirports.length > 0) {
      // We have the massive 16,000 regional DB
      const activeAirports = allAirports.filter(ap =>
        ap.lat >= mapBounds.getSouth() - 0.2 &&
        ap.lat <= mapBounds.getNorth() + 0.2 &&
        ap.lon >= mapBounds.getWest() - 0.2 &&
        ap.lon <= mapBounds.getEast() + 0.2
      );

      if (activeAirports.length > 1500) {
        // Zoomed out too far, just show major reporting stations in bounds
        targetAirports = stations.filter(s =>
          s.lat >= mapBounds.getSouth() - 0.2 &&
          s.lat <= mapBounds.getNorth() + 0.2 &&
          s.lon >= mapBounds.getWest() - 0.2 &&
          s.lon <= mapBounds.getEast() + 0.2
        ).map(s => ({ id: s.icaoId, name: s.name || s.icaoId, lat: s.lat, lon: s.lon }));
      } else {
        // Safe to render regional airports!
        targetAirports = activeAirports;
      }
    } else {
      // Fallback if JSON failed to load
      targetAirports = stations.map(s => ({ id: s.icaoId, name: s.name || s.icaoId, lat: s.lat, lon: s.lon }));
    }

    const points = [];

    for (const ap of targetAirports) {
      if (altitude === 'ground') {
        let nearestDist = Infinity;
        let nearestStation = null;
        for (const st of stations) {
          const d = getDistance(ap.lat, ap.lon, st.lat, st.lon);
          if (d < nearestDist) {
            nearestDist = d;
            nearestStation = st;
          }
        }

        if (!nearestStation) continue;

        points.push({
          id: ap.id,
          name: ap.name,
          lat: ap.lat,
          lon: ap.lon,
          windDir: nearestStation.wdir,
          windSpeed: nearestStation.wspd,
          gusts: nearestStation.wgst,
          temp: nearestStation.temp,
          dew: nearestStation.dewp
        });
      } else {
        let nearestAloftDist = Infinity;
        let selectedAloftLevel = null;

        for (const aloft of aloftData) {
          const stObj = stations.find(s => s.icaoId === aloft.icaoId);
          if (!stObj) continue;
          const d = getDistance(ap.lat, ap.lon, stObj.lat, stObj.lon);
          if (d < nearestAloftDist && aloft.levels[altitude]) {
            nearestAloftDist = d;
            selectedAloftLevel = aloft.levels[altitude];
          }
        }

        if (selectedAloftLevel && selectedAloftLevel.windSpeed !== null) {
          points.push({
            id: ap.id,
            name: ap.name,
            lat: ap.lat,
            lon: ap.lon,
            windDir: selectedAloftLevel.windDir,
            windSpeed: selectedAloftLevel.windSpeed,
            gusts: null,
            temp: selectedAloftLevel.temp,
            dew: null
          });
        }
      }
    }

    return points;
  }, [altitude, stations, aloftData, allAirports, mapBounds]);

  useEffect(() => {
    if (selectedStation) {
      const updated = displayPoints.find(p => p.id === selectedStation.id);
      if (updated) {
        setSelectedStation(updated);
      }
    }
  }, [altitude, displayPoints]);

  const handleSearch = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    const lowerTerm = term.toLowerCase();

    let matches = allAirports.filter(a => a.id.toLowerCase().startsWith(lowerTerm));
    if (matches.length < 5) {
      matches = matches.concat(allAirports.filter(a => a.name && a.name.toLowerCase().includes(lowerTerm) && !matches.find(m => m.id === a.id)));
    }
    setSearchResults(matches.slice(0, 10));
  };

  const selectAirport = (ap) => {
    setSearchTarget([ap.lat, ap.lon]);
    setSearchedAirport(ap);
    setSearchTerm('');
    setSearchResults([]);

    // Automatically select the nearest weather station to open the info panel
    let nearestDist = Infinity;
    let nearestStation = null;
    for (const st of stations) {
      if (st.icaoId === ap.id) { nearestStation = st; break; }
      const d = getDistance(ap.lat, ap.lon, st.lat, st.lon);
      if (d < nearestDist) {
        nearestDist = d;
        nearestStation = st;
      }
    }

    if (nearestStation) {
      // Convert to points array structure
      setSelectedStation({
        id: nearestStation.icaoId,
        name: nearestStation.name || ap.name,
        lat: nearestStation.lat,
        lon: nearestStation.lon,
        windDir: nearestStation.wdir,
        windSpeed: nearestStation.wspd,
        gusts: nearestStation.wgst,
        temp: nearestStation.temp,
        dew: nearestStation.dewp
      });
    }
  };

  const center = [39.8283, -98.5795];

  return (
    <div className="app-container">
      <MapContainer center={center} zoom={5} zoomControl={false} className="leaflet-container">
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
          url={`https://{s}.basemaps.cartocdn.com/${mapStyle}/{z}/{x}/{y}{r}.png`}
        />
        <BoundsTracker setBounds={setMapBounds} setZoom={setMapZoom} />
        <MapController targetPos={searchTarget} />
        {displayPoints.map((point) => {
          const color = getWindColor(point.windSpeed);
          const rotation = (point.windDir + 180) % 360;

          let runwaysSvg = '';
          let radialBackdrop = '';
          let radialForeground = '';
          const isSelected = selectedStation && selectedStation.id === point.id;
          const rwData = runwaysData[point.id] || [];

          if (isSelected) {
            const radRadius = 130;

            radialBackdrop = `<circle cx="16" cy="16" r="${radRadius}" stroke="${theme === 'dark' ? 'rgba(56, 189, 248, 0.4)' : 'rgba(37, 99, 235, 0.3)'}" stroke-width="1.5" fill="${theme === 'dark' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.6)'}" pointer-events="none" />`;
            radialBackdrop += `<circle cx="16" cy="16" r="${radRadius + 28}" stroke="${theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'}" stroke-width="1" fill="none" pointer-events="none" />`;

            for (let i = 0; i < 360; i += 10) {
              const isMajor = i % 90 === 0;
              const isMedium = i % 30 === 0;
              const tickLength = isMajor ? 14 : (isMedium ? 9 : 5);
              const strokeWidth = isMajor ? 2.5 : 1;
              const r_start = radRadius - tickLength;
              const r_end = radRadius;

              const rad = i * Math.PI / 180;
              const x1 = 16 + r_start * Math.sin(rad);
              const y1 = 16 - r_start * Math.cos(rad);
              const x2 = 16 + r_end * Math.sin(rad);
              const y2 = 16 - r_end * Math.cos(rad);

              radialForeground += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(15, 23, 42, 0.5)'}" stroke-width="${strokeWidth}" pointer-events="none" />`;

              if (isMajor) {
                const textR = radRadius + 18;
                const tx = 16 + textR * Math.sin(rad);
                const ty = 16 - textR * Math.cos(rad);
                const text = i === 0 ? '0' : `${i}`;
                radialForeground += `<text x="${tx}" y="${ty}" fill="${theme === 'dark' ? '#38bdf8' : '#2563eb'}" font-size="14" font-family="Arial, sans-serif" font-weight="bold" text-anchor="middle" dominant-baseline="central" style="pointer-events: none; text-shadow: ${theme === 'dark' ? '0 2px 4px rgba(0,0,0,0.8)' : '0 1px 2px rgba(255,255,255,0.8)'};">${text}</text>`;
              }
            }

            if (point.windDir !== null) {
              const arrowRot = (point.windDir + 180) % 360;
              radialForeground += `<g transform="rotate(${arrowRot} 16 16)" pointer-events="none">
                               <line x1="16" y1="16" x2="16" y2="${-(radRadius - 22)}" stroke="#38bdf8" stroke-width="5" stroke-linecap="round" />
                               <polygon points="16,${-(radRadius - 6)} 25,${-(radRadius - 20)} 7,${-(radRadius - 20)}" fill="#38bdf8" />
                             </g>`;
            }
          }

          // Only show extended runways when zoomed in beyond state-level overview to avoid map clutter
          // and only up to 6k ft altitude view.
          const showRunways = mapZoom >= 10 && ['ground', '3k', '6k'].includes(altitude);

          if (showRunways && rwData.length > 0) {
            const headingGroups = {};
            rwData.forEach(rw => {
              let heading = rw.le_heading;
              if (heading === null && rw.le_ident) {
                let num = parseInt(rw.le_ident.replace(/[^0-9]/g, ''));
                if (!isNaN(num)) heading = num * 10;
              }
              if (heading !== null) {
                const rounded = Math.round(heading / 10) * 10;
                if (!headingGroups[rounded]) headingGroups[rounded] = { le_idents: [], he_idents: [] };
                if (rw.le_ident && !headingGroups[rounded].le_idents.includes(rw.le_ident)) headingGroups[rounded].le_idents.push(rw.le_ident);
                if (rw.he_ident && !headingGroups[rounded].he_idents.includes(rw.he_ident)) headingGroups[rounded].he_idents.push(rw.he_ident);
              }
            });

            Object.entries(headingGroups).forEach(([h, group]) => {
              const heading = parseInt(h);
              const le_label = group.le_idents.join('/');
              const he_label = group.he_idents.join('/');

              const lineColor = theme === 'dark' ? '#64748b' : '#94a3b8';
              const dashedColor = theme === 'dark' ? 'white' : '#1e293b';
              const extensionColor = theme === 'dark' ? 'rgba(56, 189, 248, 0.6)' : 'rgba(37, 99, 235, 0.5)';
              const textColor = theme === 'dark' ? '#ffffff' : '#0f172a';
              const tShadow = theme === 'dark' ? '' : 'text-shadow: 0 1px 3px rgba(255,255,255,0.9);';

              runwaysSvg += `<line x1="16" y1="6" x2="16" y2="26" stroke="${lineColor}" stroke-width="6" transform="rotate(${heading} 16 16)" stroke-linecap="round" />`;
              runwaysSvg += `<line x1="16" y1="7" x2="16" y2="25" stroke="${dashedColor}" stroke-width="1.5" stroke-dasharray="3, 3" transform="rotate(${heading} 16 16)" />`;

              runwaysSvg += `<line x1="16" y1="-45" x2="16" y2="4" stroke="${extensionColor}" stroke-width="1.5" stroke-dasharray="4, 4" transform="rotate(${heading} 16 16)" />`;
              runwaysSvg += `<line x1="16" y1="28" x2="16" y2="77" stroke="${extensionColor}" stroke-width="1.5" stroke-dasharray="4, 4" transform="rotate(${heading} 16 16)" />`;

              const rad = heading * Math.PI / 180;
              const distOffset = 68 + (runwayFontSize - 11); // Push text further out when larger

              // Bottom tip corresponds to the threshold for the le_ident
              const le_x = 16 - distOffset * Math.sin(rad);
              const le_y = 16 + distOffset * Math.cos(rad);

              // Top tip corresponds to the threshold for the he_ident
              const he_x = 16 + distOffset * Math.sin(rad);
              const he_y = 16 - distOffset * Math.cos(rad);

              const fontStack = "Arial, sans-serif";
              const textStyle = `text-decoration: none !important; user-select: none; ${tShadow}`; // Eradicate phantom browser underlines 

              if (le_label) {
                runwaysSvg += `<text x="${le_x}" y="${le_y}" fill="${textColor}" font-size="${runwayFontSize}" font-family="${fontStack}" font-weight="bold" text-anchor="middle" dominant-baseline="central" style="${textStyle}">${le_label}</text>`;
              }
              if (he_label) {
                runwaysSvg += `<text x="${he_x}" y="${he_y}" fill="${textColor}" font-size="${runwayFontSize}" font-family="${fontStack}" font-weight="bold" text-anchor="middle" dominant-baseline="central" style="${textStyle}">${he_label}</text>`;
              }
            });
          }

          const svgArrow = `
            <div style="width: 32px; height: 32px;">
              <svg width="32" height="32" viewBox="0 0 32 32" style="overflow: visible; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.8)); pointer-events: none;">
                <g style="pointer-events: auto;">
                  ${radialBackdrop}
                  ${runwaysSvg}
                  ${radialForeground}
                  <path d="M16 6L23 25L16 21L9 25L16 6Z" fill="${color}" stroke="${theme === 'dark' ? 'white' : '#1e293b'}" stroke-width="1.5" stroke-linejoin="round" transform="rotate(${rotation} 16 16)" />
                </g>
              </svg>
            </div>
          `;

          const customIcon = new L.divIcon({
            html: svgArrow,
            className: 'custom-wind-marker',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });

          return (
            <Marker
              key={point.id}
              position={[point.lat, point.lon]}
              icon={customIcon}
              eventHandlers={{
                click: () => { setSelectedStation(point); setSearchedAirport(null); }
              }}
            />
          );
        })}
        {searchedAirport && (
          <Marker
            position={[searchedAirport.lat, searchedAirport.lon]}
            icon={new L.divIcon({
              html: `<div class="radar-pulse"></div>`,
              className: '',
              iconSize: [40, 40],
              iconAnchor: [20, 20]
            })}
          />
        )}
      </MapContainer>

      <div className="overlay-ui">
        <header className="app-header ui-element">
          <div className="brand glass-pill">
            <Wind className="brand-icon" size={24} />
            <h1 className="text-xl font-bold">AeroWind Tracker</h1>
          </div>
          <div className="brand glass-pill" style={{ marginLeft: '1rem', padding: '0.3rem 0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} style={{ color: loading ? '#3b82f6' : 'var(--text-secondary)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {loading ? 'Agent Syncing...' : `LIVE AUTONOMOUS FEED • LAST SYNC: ${lastUpdated || 'N/A'}`}
            </span>
          </div>
          <button 
            className="glass-pill hover-scale" 
            onClick={toggleTheme} 
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
            style={{ marginLeft: '1rem', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid var(--panel-border)', background: 'var(--panel-bg)', color: 'var(--text-primary)' }}
          >
             {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </header>

        <div className="search-container ui-element glass-panel" style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', width: '300px', padding: '10px', borderRadius: '12px', zIndex: 1000 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={18} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search airport (e.g. KSEA, Seattle)"
              value={searchTerm}
              onChange={handleSearch}
              style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', outline: 'none' }}
            />
          </div>
          {searchResults.length > 0 && (
            <div className="search-results" style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '5px', maxHeight: '250px', overflowY: 'auto' }}>
              {searchResults.map(res => (
                <div
                  key={res.id}
                  onClick={() => selectAirport(res)}
                  style={{ padding: '8px', cursor: 'pointer', borderRadius: '4px', transition: 'background 0.2s' }}
                  className="hover-glow"
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontWeight: 'bold' }}>{res.id}</div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="right-controls">
          <div className="altitude-control ui-element">
            <div className="glass-panel text-sm font-medium hover-glow" style={{ padding: '0.5rem 1rem', marginBottom: '1rem', borderRadius: '20px' }}>
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

          <div className="runway-control ui-element">
            <div className="glass-panel text-sm font-medium hover-glow" style={{ padding: '0.4rem 1rem', marginBottom: '0.5rem', borderRadius: '20px' }}>
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
        </div>

        <div className="left-controls" style={{ position: 'absolute', top: '80px', left: '20px', display: 'flex', flexDirection: 'column', gap: '20px', zIndex: 1000, pointerEvents: 'none', maxHeight: 'calc(100vh - 100px)' }}>
          {/* AI Agent Alerts Sidebar - ON TOP */}
          {alertFeed.length > 0 && (
            <div className="alerts-sidebar ui-element glass-panel" style={{ width: '320px', maxHeight: '40vh', overflowY: 'auto', padding: '15px', pointerEvents: 'auto', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px' }}>
                <AlertTriangle size={18} color="#ef4444" />
                <h3 className="text-md font-bold" style={{ color: 'var(--text-primary)' }}>AeroGuard AI Alerts</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {alertFeed.map((alert, idx) => (
                  <div key={idx} style={{
                    background: theme === 'dark' ? 'rgba(30, 41, 59, 0.6)' : 'rgba(241, 245, 249, 0.8)',
                    borderLeft: `3px solid ${alert.severity === 'HIGH' ? '#ef4444' : alert.severity === 'MEDIUM' ? '#f59e0b' : '#3b82f6'}`,
                    padding: '10px',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    lineHeight: '1.4'
                  }}>
                    <span style={{ fontWeight: 'bold', color: alert.severity === 'HIGH' ? '#ef4444' : 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                      {alert.type} @ {alert.location}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{alert.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info Panel (Wind pane) - BELOW */}
          <div className={`info-panel glass-panel ui-element ${selectedStation ? '' : 'hidden'}`} style={{ position: 'relative', top: 'auto', left: 'auto', pointerEvents: 'auto', flexShrink: 0 }}>
            <div className="info-header">
              <div>
                <h2 className="text-2xl font-bold">{selectedStation?.id}</h2>
                <p className="text-secondary text-sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                  {selectedStation?.name}
                </p>
              </div>
              <button
                className="glass-pill hover-scale"
                style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--panel-border)', color: 'white', cursor: 'pointer', background: 'transparent' }}
                onClick={() => setSelectedStation(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="stat-grid">
              <div className="stat-item" style={{ gridColumn: '1 / -1' }}>
                <div className="stat-label"><Navigation size={14} /> Active Runway (Estimated)</div>
                <div className="stat-value" style={{ color: 'var(--accent-hover)' }}>
                  {runwaysData[selectedStation?.id] && runwaysData[selectedStation?.id].length > 0
                    ? `RWY ${getBestRunway(runwaysData[selectedStation?.id], selectedStation?.windDir) || 'Unknown'}`
                    : 'No Runway Data'}
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-label"><Navigation size={14} /> Wind</div>
                <div className="stat-value">{selectedStation?.windDir}° / {selectedStation?.windSpeed}kt</div>
              </div>
              <div className="stat-item">
                <div className="stat-label"><Wind size={14} /> Gusts</div>
                <div className="stat-value">{selectedStation?.gusts ? `${selectedStation.gusts}kt` : 'N/A'}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label"><Thermometer size={14} /> Temp</div>
                <div className="stat-value">{selectedStation?.temp !== null && selectedStation?.temp !== undefined ? `${selectedStation.temp}°C / ${Math.round((selectedStation.temp * 9 / 5) + 32)}°F` : 'N/A'}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label"><Droplets size={14} /> Dew Point</div>
                <div className="stat-value">{selectedStation?.dew !== null && selectedStation?.dew !== undefined ? `${selectedStation.dew}°C / ${Math.round((selectedStation.dew * 9 / 5) + 32)}°F` : 'N/A'}</div>
              </div>
            </div>

            <div className="station-meta" style={{ marginTop: '1rem', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              <p className="text-secondary text-xs" style={{ lineHeight: '1.4' }}>
                Runway interpolation autonomously projected based on current wind vector arrays. Not for real-world navigation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
