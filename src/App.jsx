import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Wind, Thermometer, Droplets, Navigation, X, AlertTriangle, RefreshCw, Search, Target, Sun, Moon, MessageSquare, Send, Bot, User, Menu, CloudRain, Layers, Activity } from 'lucide-react';
import MobileToggleBtn from './components/MobileToggleBtn';
import { fetchLiveAIData, fetchTaf, fetchNotams } from './services/api';
import { getTimezoneFromLatLon } from './utils/timezone';
import CrosswindControls from './components/CrosswindControls';
import TafTimeline from './components/TafTimeline';
import NotamPanel from './components/NotamPanel';
import { WeatherOverlayLayer, WeatherOverlayPanel } from './components/WeatherOverlay';
import AgentDashboard from './components/AgentDashboard';
import AgentMapOverlay from './components/AgentMapOverlay';
import './App.css';

const ALTITUDES = [
  { level: '18k', label: '18,000 ft' },
  { level: '12k', label: '12,000 ft' },
  { level: '9k', label: '9,000 ft' },
  { level: '6k', label: '6,000 ft' },
  { level: '3k', label: '3,000 ft' },
  { level: 'ground', label: 'Ground' },
];

const MAP_STYLES = {
  dark: { name: 'Dark', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '&copy; CartoDB' },
  light: { name: 'Light', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr: '&copy; CartoDB' },
  hybrid: { name: 'Hybrid', url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', attr: '&copy; Google Maps' },
  terrain: { name: 'Terrain', url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', attr: '&copy; Google Maps' }
};

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

function BoundsTracker({ setBounds, setZoom, onMapClick }) {
  const map = useMapEvents({
    moveend: () => { setBounds(map.getBounds()); setZoom(map.getZoom()); },
    zoomend: () => { setBounds(map.getBounds()); setZoom(map.getZoom()); },
    click: () => { if (onMapClick) onMapClick(); }
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
  const [pireps, setPireps] = useState([]);
  const [showPireps, setShowPireps] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);

  // Responsive UI state
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchTarget, setSearchTarget] = useState(null);
  const [searchedAirport, setSearchedAirport] = useState(null);

  // Custom user control for runway labels visibility
  const [runwayFontSize, setRunwayFontSize] = useState(16);

  // Wind barb size
  const [barbSize, setBarbSize] = useState(32);

  // Weather overlay
  const [wxOverlay, setWxOverlay] = useState({ type: null, altitude: 'FL090', opacity: 0.65 });
  const [showWeatherPanel, setShowWeatherPanel] = useState(false);
  const [showAlertsPanel, setShowAlertsPanel] = useState(true);

  // Agent Intelligence Dashboard
  const [showAgentsPanel, setShowAgentsPanel] = useState(false);
  const [agentAlertCount, setAgentAlertCount] = useState(0);
  const [activeFinding, setActiveFinding] = useState(null);

  // Poll agent status for the toggle badge (lightweight — just checks count)
  useEffect(() => {
    async function checkAgents() {
      try {
        const res = await fetch('/api/agents');
        if (!res.ok) return;
        const data = await res.json();
        const high = Object.values(data.agents || {}).reduce(
          (n, a) => n + (a.findings?.filter(f => f.severity === 'HIGH').length ?? 0), 0
        );
        setAgentAlertCount(high);
      } catch { /* server offline — badge stays at 0 */ }
    }
    checkAgents();
    const id = setInterval(checkAgents, 30_000);
    return () => clearInterval(id);
  }, []);

  // Map style state
  const [mapStyleKey, setMapStyleKey] = useState('dark');
  
  // Chat Copilot state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'model', text: "Hello! I'm AeroGuard AI, your aviation copilot. Select an airport and ask me about the weather conditions or safety limits." }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  // Disclaimer state
  const [disclaimerVisible, setDisclaimerVisible] = useState(true);
  const [trackingLoading, setTrackingLoading] = useState(false);

  // TAF and NOTAM state (fetched per selected airport)
  const [tafData, setTafData] = useState(null);
  const [tafLoading, setTafLoading] = useState(false);
  const [notamData, setNotamData] = useState(null);
  const [notamLoading, setNotamLoading] = useState(false);

  // Fetch TAF and NOTAMs whenever the selected airport changes
  useEffect(() => {
    if (!selectedStation?.id) {
      setTafData(null);
      setNotamData(null);
      return;
    }
    const icao = selectedStation.id;

    setTafLoading(true);
    fetchTaf(icao).then(data => {
      setTafData(data);
      setTafLoading(false);
    });

    setNotamLoading(true);
    fetchNotams(icao).then(data => {
      setNotamData(data);
      setNotamLoading(false);
    });
  }, [selectedStation?.id]);

  const handleDisclaimerAccept = () => {
    setTrackingLoading(true);
    let userId = localStorage.getItem('aerowind_user_id');
    if (!userId) {
      userId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
      localStorage.setItem('aerowind_user_id', userId);
    }

    const sendTrackingData = async (lat, lon) => {
      try {
        await fetch('/api/tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, lat, lon })
        });
      } catch (e) {
        console.error("Tracking error:", e);
      } finally {
        setTrackingLoading(false);
        setDisclaimerVisible(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => sendTrackingData(position.coords.latitude, position.coords.longitude),
        () => sendTrackingData(null, null),
        { timeout: 8000 }
      );
    } else {
      sendTrackingData(null, null);
    }
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || chatLoading) return;
    
    const userMsg = chatInput.trim();
    const newMessages = [...chatMessages, { role: 'user', text: userMsg }];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      // Clean history for Gemini API req: { role: 'user'|'model', parts: [{ text: '...' }] }
      const historyPayload = chatMessages.filter(m => m.role === 'user' || m.role === 'model').map(m => ({
         role: m.role,
         parts: [{ text: m.text }]
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          context: selectedStation,
          history: historyPayload
        })
      });
      
      const data = await res.json();
      setChatMessages([...newMessages, { role: 'model', text: data.reply || data.error || 'Connection failed.' }]);
    } catch (err) {
      setChatMessages([...newMessages, { role: 'model', text: 'Error connecting to AeroGuard AI.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Handle responsive auto-toggle
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleTheme = () => {
    setTheme(t => {
      const newTheme = t === 'dark' ? 'light' : 'dark';
      // Automatically switch map style if it was explicitly dark/light to match theme
      if (mapStyleKey === 'dark' && newTheme === 'light') setMapStyleKey('light');
      if (mapStyleKey === 'light' && newTheme === 'dark') setMapStyleKey('dark');
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

      const { ground, aloft, alerts, pireps: fetchedPireps, lastUpdated: updateTime } = liveData;

      if (allAirports.length === 0) {
        let airports = [];
        try {
          const res = await fetch('/us_airports.json');
          if (res.ok) airports = await res.json();
        } catch { /* static asset unavailable */ }

        let runways = {};
        try {
          const res = await fetch('/us_runways.json');
          if (res.ok) runways = await res.json();
        } catch { /* static asset unavailable */ }

        if (isMounted) {
          setAllAirports(airports);
          setRunwaysData(runways);
        }
      }

      if (isMounted) {
        setStations(ground || []);
        setAloftData(aloft || []);
        setAlertFeed(alerts || []);
        setPireps(fetchedPireps || []);
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

  // Pre-calculate the current active runway's numerical heading
  let activeHeading = null;
  if (selectedStation) {
     const rwys = runwaysData[selectedStation.id];
     if (rwys && rwys.length > 0) {
        const bestStr = getBestRunway(rwys, selectedStation.windDir);
        if (bestStr) {
           activeHeading = parseInt(bestStr.replace(/[^0-9]/g, '')) * 10;
        }
     }
  }

  const center = [39.8283, -98.5795];

  return (
    <div className="app-container">
      <MapContainer center={center} zoom={5} zoomControl={false} className="leaflet-container">
        <TileLayer
          attribution={MAP_STYLES[mapStyleKey].attr}
          url={MAP_STYLES[mapStyleKey].url}
        />
        <WeatherOverlayLayer config={wxOverlay} />
        <AgentMapOverlay finding={activeFinding} />
        <BoundsTracker setBounds={setMapBounds} setZoom={setMapZoom} onMapClick={() => { setShowPireps(false); setSelectedStation(null); }} />
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
              const col     = theme === 'dark' ? '#38bdf8' : '#2563eb';
              const fromCol = '#ffffff'; // bright white for FROM indicator
              // Coordinate system (before rotation):
              //   tipY  = "TO" end  (wind travels toward, arrowhead here)
              //   tailY = "FROM" end (line endpoint inside circle)
              //   edgeY = circle edge on the FROM side (outside = beyond this)
              const reach = radRadius - 8;
              const tipY  = 16 - reach;       // -106  TO end
              const tailY = 16 + reach;       // 138   FROM end (line end)
              const edgeY = 16 + radRadius;   // 146   circle edge

              // 6 chevrons evenly from FROM end to TO end, all pointing toward tip (^)
              const chevYs = [103, 68, 33, -2, -37, -72];
              const chevrons = chevYs.map(cy =>
                `<polyline points="9,${cy+9} 16,${cy} 23,${cy+9}"
                           fill="none" stroke="${col}" stroke-width="2.5"
                           stroke-linecap="round" stroke-linejoin="round"/>`
              ).join('');

              radialForeground += `<g transform="rotate(${arrowRot} 16 16)" pointer-events="none">
                <!-- Full diameter dotted line -->
                <line x1="16" y1="${tipY}" x2="16" y2="${tailY}"
                      stroke="${col}" stroke-width="2" stroke-dasharray="7,5" stroke-linecap="round"/>
                <!-- TO arrowhead at tip -->
                <polygon points="16,${tipY} 24,${tipY+16} 8,${tipY+16}" fill="${col}"/>
                <!-- Chevrons along full line FROM → TO -->
                ${chevrons}
                <!-- Bright FROM indicator outside radial circle -->
                <circle cx="16" cy="${edgeY+20}" r="14"
                        fill="${fromCol}" fill-opacity="0.12"
                        stroke="${fromCol}" stroke-width="1.5" stroke-opacity="0.6"/>
                <polygon points="16,${edgeY+8} 25,${edgeY+28} 7,${edgeY+28}"
                         fill="${fromCol}"/>
              </g>`;
            }

            // Small plane on the active (into-wind) runway
            if (activeHeading !== null) {
              const planeCol = theme === 'dark' ? '#fbbf24' : '#f59e0b';
              const planeShadow = 'rgba(0,0,0,0.7)';
              // Plane center is 45px toward the active heading from the SVG center (16,16)
              // The path is a top-down silhouette centered at (0,0) pointing up (nose = negative y)
              // The le_label for the active runway is in the direction (activeHeading+180°) from
              // radial centre — i.e. local +y in the rotated group. Translate(0, T) places the
              // plane at distance T in that direction so it sits just inside the runway numbers.
              radialForeground += `<g transform="rotate(${activeHeading} 16 16)" pointer-events="none">
                <g transform="translate(0,55)">
                  <path d="M0,-9 L3,-3 L10,2 L10,4 L3,1 L3,7 L6,8 L6,9 L0,7 L-6,9 L-6,8 L-3,7 L-3,1 L-10,4 L-10,2 L-3,-3 Z"
                        fill="${planeCol}" stroke="${planeShadow}" stroke-width="0.8" stroke-linejoin="round"/>
                </g>
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
              const textStyle = `text-decoration: none; -webkit-user-select: none; user-select: none; ${tShadow}`;

              if (le_label) {
                runwaysSvg += `<text x="${le_x}" y="${le_y}" fill="${textColor}" font-size="${runwayFontSize}" font-family="${fontStack}" font-weight="bold" text-anchor="middle" dominant-baseline="central" style="${textStyle}">${le_label}</text>`;
              }
              if (he_label) {
                runwaysSvg += `<text x="${he_x}" y="${he_y}" fill="${textColor}" font-size="${runwayFontSize}" font-family="${fontStack}" font-weight="bold" text-anchor="middle" dominant-baseline="central" style="${textStyle}">${he_label}</text>`;
              }
            });
          }

          const svgArrow = `
            <div style="width: ${barbSize}px; height: ${barbSize}px;">
              <svg width="${barbSize}" height="${barbSize}" viewBox="0 0 32 32" style="overflow: visible; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.8)); pointer-events: none;">
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
            iconSize: [barbSize, barbSize],
            iconAnchor: [barbSize / 2, barbSize / 2]
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
        {showPireps && pireps.filter(p => !selectedStation || getDistance(selectedStation.lat, selectedStation.lon, p.lat, p.lon) < 300).map((p, i) => (
          <Marker
            key={p.id || i}
            position={[p.lat, p.lon]}
            icon={new L.divIcon({
              html: `<div style="width:24px; height:24px; background: #f97316; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px #f97316;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></div>`,
              className: '',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })}
            eventHandlers={{
              click: () => {
                 alert(`LLM PARSED PIREP\nType: ${p.type}\nSeverity: ${p.severity}\nAltitude: ${p.altitude}\n\nTranslation: ${p.description}`);
              }
            }}
          />
        ))}
      </MapContainer>

      <div className="overlay-ui">
        {isMobile && (
          <MobileToggleBtn 
            isMobileMenuOpen={isMobileMenuOpen} 
            setIsMobileMenuOpen={setIsMobileMenuOpen} 
          />
        )}
        {/* ── Top Navigation Bar ── */}
        <header className="app-topbar ui-element" style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '56px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', zIndex: 2000, pointerEvents: 'none',
          background: theme === 'dark'
            ? 'linear-gradient(to bottom, rgba(10,17,34,0.92) 0%, rgba(10,17,34,0.6) 70%, transparent 100%)'
            : 'linear-gradient(to bottom, rgba(241,245,249,0.97) 0%, rgba(241,245,249,0.7) 70%, transparent 100%)',
          borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
        }}>
          {/* Left: Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto', flexShrink: 0 }}>
            <Wind size={18} color="var(--accent-color)" style={{ animation: 'float 3s ease-in-out infinite' }} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '0.2px' }}>AeroWind Tracker</span>
            <span style={{ background: '#ef4444', color: 'white', padding: '2px 5px', borderRadius: '4px', fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase' }}>BETA</span>
          </div>

          {/* Center: Search */}
          <div className={`glass-panel ${isMobile && !isMobileMenuOpen ? 'mobile-hidden' : ''}`} style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            width: isMobile ? 'calc(100% - 260px)' : '300px',
            padding: '7px 12px', borderRadius: '10px', pointerEvents: 'auto', zIndex: 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={14} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search airport (e.g. KSEA)"
                value={searchTerm}
                onChange={handleSearch}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', outline: 'none', fontSize: '0.85rem' }}
              />
            </div>
            {searchResults.length > 0 && (
              <div style={{ marginTop: '8px', borderTop: '1px solid var(--panel-border)', paddingTop: '4px', maxHeight: '240px', overflowY: 'auto' }}>
                {searchResults.map(res => (
                  <div key={res.id} onClick={() => selectAirport(res)} className="hover-glow"
                    style={{ padding: '7px 8px', cursor: 'pointer', borderRadius: '6px', transition: 'background 0.15s' }}
                    onMouseOver={e => e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{res.id}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{res.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Sync status + Theme toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto', flexShrink: 0, paddingRight: isMobile ? '52px' : '0' }}>
            <div className="glass-pill" style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={11} className={loading ? 'spin' : ''} style={{ color: loading ? 'var(--accent-color)' : 'var(--text-secondary)' }} />
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                {loading ? 'Syncing...' : `Sync: ${lastUpdated || 'N/A'}`}
              </span>
            </div>
            <button className="glass-pill hover-scale" onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid var(--panel-border)', background: 'var(--panel-bg)', color: 'var(--text-primary)' }}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </header>

        {/* ── Panel Toggle Bar (centered, below header) ── */}
        <div style={{
          position: 'absolute', top: '62px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: '8px', zIndex: 1100, pointerEvents: 'auto',
        }}>
          {/* Weather toggle */}
          <button
            onClick={() => setShowWeatherPanel(p => !p)}
            title="Toggle Weather Overlay panel"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 10px 4px 8px', borderRadius: '999px',
              background: showWeatherPanel ? 'var(--accent-color)' : 'var(--panel-bg)',
              border: `1px solid ${showWeatherPanel ? 'var(--accent-color)' : 'var(--panel-border)'}`,
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              color: showWeatherPanel ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.3px',
              boxShadow: showWeatherPanel ? '0 0 10px var(--accent-glow)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <CloudRain size={12} />
            <span>Weather</span>
            {wxOverlay.type && (
              <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '999px', padding: '1px 5px', fontSize: '0.58rem' }}>
                {wxOverlay.type}
              </span>
            )}
            <span style={{ marginLeft: '2px', width: '22px', height: '12px', borderRadius: '6px', background: showWeatherPanel ? 'rgba(255,255,255,0.3)' : 'var(--panel-border)', position: 'relative', flexShrink: 0, display: 'inline-block', transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: '2px', left: showWeatherPanel ? '12px' : '2px', width: '8px', height: '8px', borderRadius: '50%', background: showWeatherPanel ? '#fff' : 'var(--text-secondary)', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
            </span>
          </button>

          {/* Alerts toggle */}
          <button
            onClick={() => setShowAlertsPanel(p => !p)}
            title="Toggle AI Alerts panel"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 10px 4px 8px', borderRadius: '999px',
              background: showAlertsPanel ? 'rgba(239,68,68,0.85)' : 'var(--panel-bg)',
              border: `1px solid ${showAlertsPanel ? '#ef4444' : 'var(--panel-border)'}`,
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              color: showAlertsPanel ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.3px',
              boxShadow: showAlertsPanel && alertFeed.length > 0 ? '0 0 10px rgba(239,68,68,0.4)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <AlertTriangle size={12} />
            <span>Alerts</span>
            {alertFeed.length > 0 && (
              <span style={{ background: showAlertsPanel ? 'rgba(255,255,255,0.3)' : '#ef4444', color: '#fff', borderRadius: '999px', padding: '1px 5px', fontSize: '0.58rem', fontWeight: 800 }}>
                {alertFeed.length}
              </span>
            )}
            <span style={{ marginLeft: '2px', width: '22px', height: '12px', borderRadius: '6px', background: showAlertsPanel ? 'rgba(255,255,255,0.3)' : 'var(--panel-border)', position: 'relative', flexShrink: 0, display: 'inline-block', transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: '2px', left: showAlertsPanel ? '12px' : '2px', width: '8px', height: '8px', borderRadius: '50%', background: showAlertsPanel ? '#fff' : 'var(--text-secondary)', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
            </span>
          </button>

          {/* Agents Intelligence toggle */}
          <button
            onClick={() => setShowAgentsPanel(p => !p)}
            title="Toggle Agent Intelligence panel"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 10px 4px 8px', borderRadius: '999px',
              background: showAgentsPanel ? 'rgba(99,102,241,0.85)' : 'var(--panel-bg)',
              border: `1px solid ${showAgentsPanel ? '#6366f1' : 'var(--panel-border)'}`,
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              color: showAgentsPanel ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.3px',
              boxShadow: showAgentsPanel ? '0 0 10px rgba(99,102,241,0.4)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <Activity size={12} />
            <span>Agents</span>
            {agentAlertCount > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', borderRadius: '999px', padding: '1px 5px', fontSize: '0.58rem', fontWeight: 800 }}>
                {agentAlertCount}
              </span>
            )}
            <span style={{ marginLeft: '2px', width: '22px', height: '12px', borderRadius: '6px', background: showAgentsPanel ? 'rgba(255,255,255,0.3)' : 'var(--panel-border)', position: 'relative', flexShrink: 0, display: 'inline-block', transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: '2px', left: showAgentsPanel ? '12px' : '2px', width: '8px', height: '8px', borderRadius: '50%', background: showAgentsPanel ? '#fff' : 'var(--text-secondary)', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
            </span>
          </button>

          {/* Station Info toggle (only shown when a station is selected) */}
          {selectedStation && (
            <button
              onClick={() => setSelectedStation(null)}
              title="Close station info"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '4px 10px 4px 8px', borderRadius: '999px',
                background: 'rgba(99,102,241,0.85)',
                border: '1px solid #6366f1',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                color: '#fff',
                fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.3px',
                transition: 'all 0.2s ease',
              }}
            >
              <Layers size={12} />
              <span>{selectedStation.id}</span>
              <X size={10} />
            </button>
          )}
        </div>

        {/* ── Weather Overlay Panel (centered, top) ── */}
        {showWeatherPanel && (
          <div style={{
            position: 'absolute', top: '102px', left: '50%', transform: 'translateX(-50%)',
            zIndex: 1050, pointerEvents: 'auto',
          }}>
            <WeatherOverlayPanel config={wxOverlay} onChange={setWxOverlay} />
          </div>
        )}

        {/* ── Agent Intelligence Dashboard (left side) ── */}
        {showAgentsPanel && (
          <div style={{
            position: 'absolute', top: '102px', left: '16px',
            zIndex: 1050, pointerEvents: 'auto',
          }}>
            <AgentDashboard
              onClose={() => { setShowAgentsPanel(false); setActiveFinding(null); }}
              onFindingSelect={setActiveFinding}
              activeFindingId={activeFinding?.id}
            />
          </div>
        )}

        {/* ── Right Controls Panel ── */}
        <div className={`right-controls ${isMobile && !isMobileMenuOpen ? 'mobile-hidden' : ''}`}>
          <div className="glass-panel ui-element" style={{ padding: '14px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>

            {/* Altitude Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '1.2px', textTransform: 'uppercase' }}>ALT</span>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: '5px' }}>
                <input
                  type="range"
                  min={0}
                  max={ALTITUDES.length - 1}
                  step={1}
                  value={ALTITUDES.length - 1 - ALTITUDES.findIndex(a => a.level === altitude)}
                  onChange={e => setAltitude(ALTITUDES[ALTITUDES.length - 1 - Number(e.target.value)].level)}
                  className="altitude-slider"
                />
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '130px', padding: '2px 0' }}>
                  {ALTITUDES.map(a => (
                    <span
                      key={a.level}
                      onClick={() => setAltitude(a.level)}
                      style={{
                        fontSize: '0.52rem', lineHeight: 1, cursor: 'pointer',
                        fontWeight: altitude === a.level ? 800 : 500,
                        color: altitude === a.level ? '#38bdf8' : 'var(--text-secondary)',
                      }}
                    >
                      {a.level === 'ground' ? 'GND' : a.level.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
              <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.2px' }}>
                {ALTITUDES.find(a => a.level === altitude)?.label}
              </span>
            </div>

            <div style={{ width: '100%', height: '1px', background: 'var(--panel-border)' }} />

            {/* Base Map */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '1.2px', textTransform: 'uppercase' }}>MAP</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                {Object.keys(MAP_STYLES).map(key => (
                  <div key={key} className={`altitude-step ${mapStyleKey === key ? 'active' : ''}`}
                    onClick={() => { setMapStyleKey(key); setTheme(key === 'light' ? 'light' : 'dark'); }}
                    style={{ fontSize: '0.62rem', width: '36px', height: '30px', borderRadius: '7px' }}>
                    {MAP_STYLES[key].name}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ width: '100%', height: '1px', background: 'var(--panel-border)' }} />

            {/* Runway Label Size */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '100%' }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '1.2px', textTransform: 'uppercase' }}>RWY</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div className="altitude-step" onClick={() => setRunwayFontSize(f => Math.min(36, f + 2))} title="Increase label size" style={{ fontWeight: 700, fontSize: '0.8rem' }}>A+</div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 500, minWidth: '30px', textAlign: 'center' }}>{runwayFontSize}px</span>
                <div className="altitude-step" onClick={() => setRunwayFontSize(f => Math.max(8, f - 2))} title="Decrease label size" style={{ fontWeight: 700, fontSize: '0.8rem' }}>A-</div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ width: '100%', height: '1px', background: 'var(--panel-border)' }} />

            {/* Wind Barb Size */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '100%' }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '1.2px', textTransform: 'uppercase' }}>WND</span>
              <input
                type="range"
                min={16}
                max={64}
                step={4}
                value={barbSize}
                onChange={e => setBarbSize(Number(e.target.value))}
                title="Wind barb size"
                style={{
                  writingMode: 'vertical-lr',
                  direction: 'rtl',
                  width: '6px',
                  height: '80px',
                  cursor: 'pointer',
                  accentColor: 'var(--accent-color)',
                  background: 'transparent'
                }}
              />
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{barbSize}px</span>
            </div>

          </div>
        </div>

        <div className={`left-controls ${isMobile && !isMobileMenuOpen ? 'mobile-hidden' : ''}`} style={{ position: 'absolute', top: '66px', left: '16px', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 1000, pointerEvents: 'none', maxHeight: 'calc(100vh - 86px)', overflowY: 'auto' }}>

          {/* AI Agent Alerts Sidebar - ON TOP */}
          {showAlertsPanel && alertFeed.length > 0 && (
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
              <div className="stat-item" style={{ gridColumn: '1 / -1', marginTop: '5px' }}>
                <button
                   onClick={(e) => { e.stopPropagation(); setShowPireps(!showPireps); }}
                   className="glass-pill hover-scale"
                   style={{ width: '100%', padding: '8px', border: '1px solid #f97316', color: '#f97316', background: showPireps ? 'rgba(249, 115, 22, 0.2)' : 'transparent', cursor: 'pointer', fontWeight: 'bold' }}
                >
                   {showPireps ? 'Hide Local PIREPs' : 'Show Local PIREPs'}
                </button>
                {showPireps && pireps.filter(p => !selectedStation || getDistance(selectedStation.lat, selectedStation.lon, p.lat, p.lon) < 300).length === 0 && (
                  <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                    No severe PIREPs within 300 nm of this station.
                  </p>
                )}
              </div>
            </div>

            <div className="station-meta" style={{ marginTop: '1rem', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              <p className="text-secondary text-xs" style={{ lineHeight: '1.4' }}>
                Runway interpolation autonomously projected based on current wind vector arrays. Not for real-world navigation.
              </p>
            </div>
          </div>
          
          {selectedStation && (
             <CrosswindControls
                windDir={selectedStation.windDir}
                windSpeed={selectedStation.windSpeed}
                runwayHeading={activeHeading}
                theme={theme}
             />
          )}

          {selectedStation && (
            <TafTimeline
              key={`taf-${selectedStation.id}`}
              tafData={tafData}
              loading={tafLoading}
              theme={theme}
              timezone={getTimezoneFromLatLon(selectedStation.lat, selectedStation.lon)}
            />
          )}

          {selectedStation && (
            <NotamPanel
              key={`notam-${selectedStation.id}`}
              notamData={notamData}
              loading={notamLoading}
              theme={theme}
              timezone={getTimezoneFromLatLon(selectedStation.lat, selectedStation.lon)}
            />
          )}

        </div>

        {/* Chat Copilot Widget */}
        <div className={`chat-copilot-widget ${chatOpen ? 'open' : ''}`} style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 3000, display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'auto' }}>
          {!chatOpen && (
            <button 
              className="glass-panel hover-scale" 
              onClick={() => setChatOpen(true)}
              style={{ width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid var(--accent-color)', background: theme === 'dark' ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
            >
              <MessageSquare size={28} color="var(--accent-color)" />
            </button>
          )}

          {chatOpen && (
            <div className="glass-panel ui-element" style={{ width: '350px', height: '500px', display: 'flex', flexDirection: 'column', borderRadius: '16px', border: '1px solid var(--panel-border)', background: theme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
              <div style={{ padding: '15px', background: 'var(--accent-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Bot size={20} />
                    <span style={{ fontWeight: 'bold' }}>AeroGuard Copilot</span>
                 </div>
                 <button onClick={() => setChatOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
              </div>

              <div style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {chatMessages.map((msg, i) => (
                   <div key={i} style={{ display: 'flex', gap: '10px', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                      {msg.role === 'model' && <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bot size={16} color="white" /></div>}
                      <div style={{ background: msg.role === 'user' ? 'var(--accent-color)' : (theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'), color: msg.role === 'user' ? 'white' : 'var(--text-primary)', padding: '10px 14px', borderRadius: '12px', fontSize: '0.9rem', lineHeight: '1.4' }}>
                         {msg.text}
                      </div>
                      {msg.role === 'user' && <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: theme === 'dark' ? '#334155' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><User size={16} color="var(--text-primary)" /></div>}
                   </div>
                ))}
                {chatLoading && (
                   <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bot size={16} color="white" /></div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Thinking...</span>
                   </div>
                )}
              </div>

              <div style={{ padding: '15px', borderTop: '1px solid var(--panel-border)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleChatSubmit(); }}
                  placeholder={selectedStation ? `Ask about ${selectedStation.id}...` : 'Type a question...'}
                  style={{ flex: 1, background: theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)', border: '1px solid var(--panel-border)', borderRadius: '20px', padding: '10px 15px', color: 'var(--text-primary)', outline: 'none' }}
                />
                <button 
                  onClick={handleChatSubmit}
                  disabled={chatLoading || !chatInput.trim()}
                  style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-color)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: chatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer', opacity: chatLoading || !chatInput.trim() ? 0.5 : 1, flexShrink: 0 }}
                >
                   <Send size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Permanent Aviation Disclaimer Overlay */}

        {disclaimerVisible && (
          <div className="disclaimer-overlay" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="disclaimer-banner glass-panel ui-element" style={{ width: '90%', maxWidth: '650px', padding: '30px 40px', display: 'flex', flexDirection: 'column', gap: '20px', borderTop: '4px solid #ef4444', background: theme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)', boxShadow: '0 25px 60px rgba(0,0,0,0.8)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: '#ef4444', justifyContent: 'center', marginBottom: '5px' }}>
                <AlertTriangle size={36} />
                <span className="font-bold text-xl" style={{ letterSpacing: '0.5px' }}>CRITICAL AVIATION DISCLAIMER</span>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.7', textAlign: 'center', fontSize: '0.95rem' }}>
                <strong>NOT FOR REAL-WORLD FLIGHT OR NAVIGATION.</strong> AeroWind Tracker is a highly experimental, AI-agent driven demonstration interface. All meteorological insights, METAR interpolations, runway heading projections, aerodynamic taxi vectors, and system alerts are dynamically generated by artificial intelligence. <strong>This autonomous system is prone to hallucinations, fatal data delays, and complete miscalculations.</strong> Pilots, dispatchers, and aviation personnel MUST NEVER substitute this application for official flight briefings. You are legally required to verify all conditions against official FAA-approved primary sources (such as AviationWeather.gov, Flight Service, or active ATIS/AWOS recordings) before releasing brakes or initiating flight. The developers disclaim all liability.
              </p>
              <button 
                onClick={handleDisclaimerAccept} 
                disabled={trackingLoading}
                className="glass-pill hover-scale" 
                style={{ marginTop: '20px', padding: '14px 24px', fontSize: '1rem', fontWeight: 'bold', border: '2px solid #ef4444', color: trackingLoading ? '#94a3b8' : '#ef4444', background: trackingLoading ? 'rgba(0,0,0,0.1)' : 'transparent', cursor: trackingLoading ? 'not-allowed' : 'pointer', alignSelf: 'center', width: '100%', transition: 'all 0.3s ease' }}
              >
                {trackingLoading ? 'INITIALIZING AND LOCATING...' : 'I ACCEPT & AGREE'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
