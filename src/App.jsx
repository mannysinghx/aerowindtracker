import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Wind, Thermometer, Droplets, Navigation, X, AlertTriangle, RefreshCw, Search, Target, Sun, Moon, MessageSquare, Send, Bot, User, Menu, CloudRain, Layers, Activity, Info, Settings, ChevronUp, ChevronDown, Plane } from 'lucide-react';
import MobileToggleBtn from './components/MobileToggleBtn';
import { fetchLiveAIData, fetchTaf, fetchNotams } from './services/api';
import { getTimezoneFromLatLon } from './utils/timezone';
import CrosswindControls from './components/CrosswindControls';
import TafTimeline from './components/TafTimeline';
import NotamPanel from './components/NotamPanel';
import { WeatherOverlayLayer, WeatherOverlayPanel } from './components/WeatherOverlay';
import AboutModal from './components/AboutModal';
import AgentDashboard from './components/AgentDashboard';
import AgentMapOverlay from './components/AgentMapOverlay';
import FlightPathPanel from './components/FlightPathPanel';
import FlightPathLayer from './components/FlightPathLayer';
import AirspaceDotsLayer from './components/AirspaceDotsLayer';
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

// ── Wind marker style shapes ─────────────────────────────────────────────────
function windMarkerShape(style, rotation, color, speed, dark) {
  const r = rotation;
  const stroke = dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)';

  switch (style) {

    case 'line': // Minimal needle — thin line + arrowhead tip + tail dot
      return `<g transform="rotate(${r} 16 16)">
        <line x1="16" y1="25" x2="16" y2="9" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
        <path d="M12 14L16 7L20 14" fill="${color}" stroke="none"/>
        <circle cx="16" cy="25" r="2.5" fill="${color}"/>
      </g>`;

    case 'chevron': // Compact V-shape — least cluttered, clear direction
      return `<g transform="rotate(${r} 16 16)">
        <path d="M10 23L16 9L22 23" stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M11 17L16 9L21 17" stroke="${color}" stroke-width="2" fill="${color}" fill-opacity="0.35" stroke-linecap="round" stroke-linejoin="round"/>
      </g>`;

    case 'dot': // Speed-coded dot only — maximum density reduction
      return `<circle cx="16" cy="16" r="7" fill="${color}" opacity="0.88"/>
        <circle cx="16" cy="16" r="7" fill="none" stroke="${stroke}" stroke-width="1"/>`;

    case 'barb': {
      // Meteorological wind barb: spine + feathers (5kt=half, 10kt=full, 50kt=pennant)
      const knots = Math.round((speed || 0) / 5) * 5;
      let rem = knots;
      let feathers = '';
      let y = 9;
      while (rem >= 50) {
        feathers += `<path d="M16 ${y} L23 ${y+3} L16 ${y+6}" fill="${color}"/>`;
        y += 8; rem -= 50;
      }
      while (rem >= 10) {
        feathers += `<line x1="16" y1="${y}" x2="23" y2="${y-3}" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>`;
        y += 5; rem -= 10;
      }
      if (rem >= 5) {
        feathers += `<line x1="16" y1="${y}" x2="20" y2="${y-1.5}" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>`;
      }
      return `<g transform="rotate(${r} 16 16)">
        <line x1="16" y1="26" x2="16" y2="7" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
        ${feathers}
        <circle cx="16" cy="26" r="2" fill="${color}"/>
      </g>`;
    }

    case 'minimal': // Ghost outline arrow — very subtle
      return `<g transform="rotate(${r} 16 16)">
        <path d="M16 7L22 24L16 20L10 24Z" stroke="${color}" stroke-width="1.5" fill="${color}" fill-opacity="0.2" stroke-linejoin="round"/>
      </g>`;

    case 'animated': // Pulsing filled arrow with glow animation
      return `<style>.wm-anim{animation:wm-pulse 1.8s ease-in-out infinite}@keyframes wm-pulse{0%,100%{opacity:.55}50%{opacity:1}}</style>
        <g class="wm-anim" transform="rotate(${r} 16 16)" style="transform-origin:16px 16px">
          <path d="M16 6L23 25L16 21L9 25L16 6Z" fill="${color}" stroke="none" filter="url(#glow)"/>
          <path d="M16 6L23 25L16 21L9 25L16 6Z" fill="${color}" opacity="0.4" transform="scale(1.25) translate(-4 -4)"/>
        </g>`;

    default: // 'arrow' — original filled arrowhead (default)
      return `<path d="M16 6L23 25L16 21L9 25L16 6Z" fill="${color}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" transform="rotate(${r} 16 16)" />`;
  }
}

// Style metadata for the picker UI
const WIND_STYLES = [
  { id: 'arrow',    label: 'Arrow',    desc: 'Filled arrowhead' },
  { id: 'chevron',  label: 'Chevron',  desc: 'V-shape, minimal' },
  { id: 'line',     label: 'Needle',   desc: 'Slim line + tip' },
  { id: 'minimal',  label: 'Ghost',    desc: 'Outline only' },
  { id: 'dot',      label: 'Dot',      desc: 'Speed color only' },
  { id: 'barb',     label: 'Met Barb', desc: 'Aviation standard' },
  { id: 'animated', label: 'Animated', desc: 'Pulsing glow' },
];

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

function FlightPathController({ routeData }) {
  const map = useMap();
  useEffect(() => {
    if (!routeData) return;
    const { from, to } = routeData;
    const bounds = [
      [Math.min(from.lat, to.lat) - 0.5, Math.min(from.lon, to.lon) - 0.5],
      [Math.max(from.lat, to.lat) + 0.5, Math.max(from.lon, to.lon) + 0.5],
    ];
    map.flyToBounds(bounds, { padding: [60, 60], duration: 1.8, maxZoom: 9 });
  }, [routeData, map]);
  return null;
}

function PingMarker({ position }) {
  const icon = L.divIcon({
    className: '',
    html: `<div class="ping-marker">
      <div class="ping-ring"></div>
      <div class="ping-ring ping-ring-2"></div>
      <div class="ping-ring ping-ring-3"></div>
      <div class="ping-dot"></div>
    </div>`,
    iconSize: [70, 70],
    iconAnchor: [35, 35],
  });
  return <Marker position={position} icon={icon} interactive={false} />;
}

function App() {
  const [theme, setTheme] = useState('dark');
  const [showAbout, setShowAbout] = useState(false);
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

  // Wind barb size & style
  const [barbSize, setBarbSize] = useState(32);
  const [barbStyle, setBarbStyle] = useState('arrow');

  // Weather overlay
  const [wxOverlay, setWxOverlay] = useState({ type: null, altitude: 'FL090', opacity: 0.65 });
  const [showWeatherPanel, setShowWeatherPanel] = useState(false);
  const [showAlertsPanel, setShowAlertsPanel] = useState(window.innerWidth > 768);
  const [mobilePanelExpanded, setMobilePanelExpanded] = useState(false);

  // Flight Path Winds
  const [showFlightPathPanel, setShowFlightPathPanel] = useState(false);
  const [flightRouteData, setFlightRouteData] = useState(null);

  // Agent Intelligence Dashboard
  const [showAgentsPanel, setShowAgentsPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [pingTarget, setPingTarget] = useState(null);
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
     const rwys = runwaysData[selectedStation.id] || runwaysData['K' + selectedStation.id];
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
        <FlightPathController routeData={flightRouteData} />
        {pingTarget && <PingMarker position={pingTarget} />}
        {displayPoints.map((point) => {
          const color = getWindColor(point.windSpeed);
          const rotation = (point.windDir + 180) % 360;

          let runwaysSvg = '';
          let radialBackdrop = '';
          let radialForeground = '';
          const isSelected = selectedStation && selectedStation.id === point.id;
          const rwData = runwaysData[point.id] || runwaysData['K' + point.id] || [];

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
                `<polyline points="11,${cy+6} 16,${cy} 21,${cy+6}"
                           fill="none" stroke="${col}" stroke-width="1.5"
                           stroke-linecap="round" stroke-linejoin="round"/>`
              ).join('');

              radialForeground += `<g transform="rotate(${arrowRot} 16 16)" pointer-events="none">
                <!-- Full diameter dotted line -->
                <line x1="16" y1="${tipY}" x2="16" y2="${tailY}"
                      stroke="${col}" stroke-width="1" stroke-dasharray="6,5" stroke-linecap="round"/>
                <!-- TO arrowhead at tip -->
                <polygon points="16,${tipY} 21,${tipY+11} 11,${tipY+11}" fill="${col}"/>
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
              const extensionColor = theme === 'dark' ? 'rgba(251, 191, 36, 0.85)' : 'rgba(217, 119, 6, 0.8)';
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

          const shapeSvg = windMarkerShape(barbStyle, rotation, color, point.windSpeed, theme === 'dark');
          const svgArrow = `
            <div style="width: ${barbSize}px; height: ${barbSize}px;">
              <svg width="${barbSize}" height="${barbSize}" viewBox="0 0 32 32" style="overflow: visible; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.8)); pointer-events: none;">
                <g style="pointer-events: auto;">
                  ${radialBackdrop}
                  ${runwaysSvg}
                  ${radialForeground}
                  ${shapeSvg}
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
                click: () => { setSelectedStation(point); setSearchedAirport(null); setMobilePanelExpanded(false); }
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
        <AirspaceDotsLayer allAirports={allAirports} />
        {flightRouteData && <FlightPathLayer routeData={flightRouteData} theme={theme} />}
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
            <span style={{ color: '#f59e0b', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.3px', fontStyle: 'italic' }}>Highly Experimental</span>
          </div>

          {/* Center: Search */}
          <div className={`glass-panel ${isMobile && !isMobileMenuOpen ? 'mobile-hidden' : ''}`} style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            width: isMobile ? 'calc(100% - 100px)' : '300px',
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
            <button className="glass-pill hover-scale" onClick={() => setShowAbout(true)}
              title="About AeroWindy"
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid var(--panel-border)', background: 'var(--panel-bg)', color: 'var(--text-primary)' }}>
              <Info size={15} />
            </button>
          </div>
        </header>

        {/* ── Right Toolbar ── */}
        {(() => {
          const toolbarBtn = (active, onClick, icon, label, badge, accentRgb) => {
            const bg = active
              ? accentRgb ? `rgba(${accentRgb},0.9)` : 'var(--accent-color)'
              : 'var(--panel-bg)';
            const border = active
              ? accentRgb ? `rgba(${accentRgb},1)` : 'var(--accent-color)'
              : 'var(--panel-border)';
            return (
              <button
                key={label}
                onClick={onClick}
                title={label}
                style={{
                  width: '44px', height: '44px', borderRadius: '10px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px',
                  background: bg, border: `1px solid ${border}`,
                  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer', position: 'relative',
                  boxShadow: active ? `0 0 12px rgba(${accentRgb || '14,165,233'},0.35)` : '0 2px 8px rgba(0,0,0,0.25)',
                  transition: 'all 0.18s ease',
                }}
              >
                {icon}
                <span style={{ fontSize: '0.48rem', fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', lineHeight: 1 }}>{label}</span>
                {badge != null && badge > 0 && (
                  <span style={{
                    position: 'absolute', top: '4px', right: '4px',
                    background: '#ef4444', color: '#fff',
                    borderRadius: '999px', fontSize: '0.5rem', fontWeight: 800,
                    minWidth: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 3px', lineHeight: 1,
                  }}>{badge}</span>
                )}
              </button>
            );
          };
          return (
            <div className={`right-toolbar${isMobile && !isMobileMenuOpen ? ' mobile-hidden' : ''}`} style={{
              position: 'absolute', right: '16px', top: '70px',
              display: 'flex', flexDirection: 'column', gap: '6px',
              zIndex: 1100, pointerEvents: 'auto',
            }}>
              {(() => {
                const openPanel = (key) => {
                  const isOpen = { weather: showWeatherPanel, alerts: showAlertsPanel, agents: showAgentsPanel, settings: showSettingsPanel, flightpath: showFlightPathPanel }[key];
                  setShowWeatherPanel(key === 'weather' && !isOpen);
                  setShowAlertsPanel(key === 'alerts' && !isOpen);
                  setShowAgentsPanel(key === 'agents' && !isOpen);
                  setShowSettingsPanel(key === 'settings' && !isOpen);
                  setShowFlightPathPanel(key === 'flightpath' && !isOpen);
                  if (key !== 'agents') { setActiveFinding(null); }
                  if (key !== 'flightpath' && isOpen) { /* keep route on map when switching panels */ }
                  // On mobile, close the toolbar so the panel is fully visible
                  if (isMobile && !isOpen) setIsMobileMenuOpen(false);
                };
                return (<>
                  {toolbarBtn(showWeatherPanel, () => openPanel('weather'), <CloudRain size={16} />, 'Weather', wxOverlay.type ? 1 : 0, '14,165,233')}
                  {toolbarBtn(showAlertsPanel, () => openPanel('alerts'), <AlertTriangle size={16} />, 'Alerts', alertFeed.length, '239,68,68')}
                  {toolbarBtn(showAgentsPanel, () => openPanel('agents'), <Bot size={16} />, 'Agents', agentAlertCount || null, '99,102,241')}
                  {toolbarBtn(showFlightPathPanel, () => openPanel('flightpath'), <Plane size={16} />, 'FltPath', flightRouteData ? 1 : null, '56,189,248')}
                  {toolbarBtn(showSettingsPanel, () => openPanel('settings'), <Settings size={16} />, 'Settings', null, '100,116,139')}
                </>);
              })()}
            </div>
          );
        })()}

        {/* ── Weather Panel (right side / mobile bottom sheet) ── */}
        {showWeatherPanel && (
          <div className={isMobile ? 'mobile-bottom-sheet' : ''} style={isMobile ? { pointerEvents: 'auto' } : { position: 'absolute', top: '70px', right: '70px', zIndex: 1050, pointerEvents: 'auto' }}>
            <WeatherOverlayPanel config={wxOverlay} onChange={setWxOverlay} />
          </div>
        )}

        {/* ── Flight Path Panel (right side / mobile bottom sheet) ── */}
        {showFlightPathPanel && (
          <div className={isMobile ? 'mobile-bottom-sheet' : ''} style={isMobile ? { pointerEvents: 'auto' } : { position: 'absolute', top: '70px', right: '70px', zIndex: 1050, pointerEvents: 'auto' }}>
            <FlightPathPanel
              theme={theme}
              allAirports={allAirports}
              onClose={() => setShowFlightPathPanel(false)}
              onRouteCalculated={setFlightRouteData}
            />
          </div>
        )}

        {/* ── Agent Intelligence Dashboard (right side / mobile bottom sheet) ── */}
        {showAgentsPanel && (
          <div className={isMobile ? 'mobile-bottom-sheet' : ''} style={isMobile ? { pointerEvents: 'auto' } : { position: 'absolute', top: '70px', right: '70px', zIndex: 1050, pointerEvents: 'auto' }}>
            <AgentDashboard
              onClose={() => { setShowAgentsPanel(false); setActiveFinding(null); }}
              onFindingSelect={setActiveFinding}
              activeFindingId={activeFinding?.id}
            />
          </div>
        )}

        {/* ── Alerts Panel (right side / mobile bottom sheet) ── */}
        {showAlertsPanel && alertFeed.length > 0 && (
          <div className={`glass-panel ui-element${isMobile ? ' mobile-bottom-sheet' : ''}`} style={isMobile ? {
            padding: '15px', pointerEvents: 'auto',
          } : {
            position: 'absolute', top: '70px', right: '70px',
            width: '320px', maxHeight: '45vh', overflowY: 'auto',
            padding: '15px', zIndex: 1050, pointerEvents: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px' }}>
              <AlertTriangle size={16} color="#ef4444" />
              <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>AeroGuard AI Alerts</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {alertFeed.map((alert, idx) => {
                // Use lat/lon from alert directly (server-side), or fall back to station lookup
                const loc = alert.lat != null && alert.lon != null
                  ? { lat: alert.lat, lon: alert.lon }
                  : alert.location !== 'GLOBAL'
                    ? (() => {
                        const s = stations.find(st => st.icaoId === alert.location);
                        return s ? { lat: s.lat, lon: s.lon } : null;
                      })()
                    : null;
                const clickable = !!loc;
                return (
                  <div key={idx}
                    onClick={() => {
                      if (!loc) return;
                      setSearchTarget([loc.lat, loc.lon]);
                      setAltitude('3k');
                      setPingTarget([loc.lat, loc.lon]);
                      setTimeout(() => setPingTarget(null), 4000);
                    }}
                    style={{
                      background: theme === 'dark' ? 'rgba(30,41,59,0.6)' : 'rgba(241,245,249,0.8)',
                      borderLeft: `3px solid ${alert.severity === 'HIGH' ? '#ef4444' : alert.severity === 'MEDIUM' ? '#f59e0b' : '#3b82f6'}`,
                      padding: '10px', borderRadius: '4px', fontSize: '0.85rem', lineHeight: '1.4',
                      cursor: clickable ? 'pointer' : 'default',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (clickable) e.currentTarget.style.background = theme === 'dark' ? 'rgba(56,189,248,0.08)' : 'rgba(14,165,233,0.07)'; }}
                    onMouseLeave={e => { if (clickable) e.currentTarget.style.background = theme === 'dark' ? 'rgba(30,41,59,0.6)' : 'rgba(241,245,249,0.8)'; }}
                  >
                    <span style={{ fontWeight: 'bold', color: alert.severity === 'HIGH' ? '#ef4444' : 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                      {alert.type} @ {alert.location}
                      {clickable && <span style={{ fontSize: '0.65rem', color: 'var(--accent-color)', marginLeft: '6px', fontWeight: 500 }}>→ zoom</span>}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{alert.message}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Settings Panel (right side / mobile bottom sheet) ── */}
        {showSettingsPanel && (
          <div className={`glass-panel ui-element${isMobile ? ' mobile-bottom-sheet' : ''}`} style={isMobile ? {
            padding: '16px', pointerEvents: 'auto',
          } : {
            position: 'absolute', top: '70px', right: '70px',
            padding: '16px', zIndex: 1050, pointerEvents: 'auto', minWidth: '200px',
          }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: '14px' }}>Settings</div>

            {/* Altitude */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Altitude</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {ALTITUDES.map(a => (
                  <span key={a.level} onClick={() => setAltitude(a.level)}
                    style={{
                      padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700,
                      background: altitude === a.level ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)',
                      color: altitude === a.level ? '#fff' : 'var(--text-secondary)',
                      border: `1px solid ${altitude === a.level ? 'var(--accent-color)' : 'var(--panel-border)'}`,
                      transition: 'all 0.15s',
                    }}>
                    {a.level === 'ground' ? 'GND' : a.level.toUpperCase()}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: '0.62rem', color: '#38bdf8', fontWeight: 700, marginTop: '6px' }}>
                {ALTITUDES.find(a => a.level === altitude)?.label}
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--panel-border)', margin: '0 0 16px' }} />

            {/* Map Style */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Map Style</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                {Object.keys(MAP_STYLES).map(key => (
                  <div key={key} className={`altitude-step ${mapStyleKey === key ? 'active' : ''}`}
                    onClick={() => { setMapStyleKey(key); setTheme(key === 'light' ? 'light' : 'dark'); }}
                    style={{ fontSize: '0.62rem', height: '30px', borderRadius: '7px' }}>
                    {MAP_STYLES[key].name}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--panel-border)', margin: '0 0 16px' }} />

            {/* Runway Label */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Runway Labels</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button className="altitude-step" onClick={() => setRunwayFontSize(f => Math.max(8, f - 2))} style={{ fontWeight: 700, width: '28px', height: '28px' }}>A−</button>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, minWidth: '36px', textAlign: 'center' }}>{runwayFontSize}px</span>
                <button className="altitude-step" onClick={() => setRunwayFontSize(f => Math.min(36, f + 2))} style={{ fontWeight: 700, width: '28px', height: '28px' }}>A+</button>
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--panel-border)', margin: '0 0 16px' }} />

            {/* Wind Marker Style */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Wind Marker Style</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {WIND_STYLES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setBarbStyle(s.id)}
                    title={s.desc}
                    style={{
                      padding: '6px 4px',
                      borderRadius: '7px',
                      border: `1px solid ${barbStyle === s.id ? 'var(--accent-color)' : 'var(--panel-border)'}`,
                      background: barbStyle === s.id ? 'rgba(56,189,248,0.12)' : 'transparent',
                      color: barbStyle === s.id ? 'var(--accent-color)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.6rem',
                      fontWeight: barbStyle === s.id ? 700 : 500,
                      lineHeight: '1.3',
                      transition: 'all 0.15s',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', marginTop: '5px', opacity: 0.7 }}>
                {WIND_STYLES.find(s => s.id === barbStyle)?.desc}
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--panel-border)', margin: '0 0 16px' }} />

            {/* Wind Barb Size */}
            <div>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Wind Marker Size</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="range" min={16} max={64} step={4} value={barbSize}
                  onChange={e => setBarbSize(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--accent-color)', cursor: 'pointer' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, minWidth: '32px' }}>{barbSize}px</span>
              </div>
            </div>
          </div>
        )}

        <div
          className={`left-controls ${isMobile && !isMobileMenuOpen && !selectedStation ? 'mobile-hidden' : ''}`}
          style={isMobile && selectedStation
            ? { position: 'absolute', bottom: 0, left: 0, width: '100%', display: 'flex', flexDirection: 'column', zIndex: 4000, pointerEvents: 'none' }
            : { position: 'absolute', top: '66px', left: '16px', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 1000, pointerEvents: 'none', maxHeight: 'calc(100vh - 86px)', overflowY: 'auto' }
          }
        >

          {/* Info Panel (Wind pane) */}
          <div className={`info-panel glass-panel ui-element ${selectedStation ? '' : 'hidden'} ${isMobile && !mobilePanelExpanded ? 'mobile-compact' : ''}`} style={{ position: 'relative', top: 'auto', left: 'auto', pointerEvents: 'auto', flexShrink: 0 }}>
            <div className="info-header">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 className="text-2xl font-bold">{selectedStation?.id}</h2>
                  {isMobile && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', letterSpacing: '0.01em' }}>
                      {selectedStation?.windDir}°/{selectedStation?.windSpeed}kt
                      {selectedStation?.temp != null ? ` · ${selectedStation.temp}°C` : ''}
                    </span>
                  )}
                </div>
                <p className="text-secondary text-sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                  {selectedStation?.name}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {isMobile && (
                  <button
                    className="glass-pill hover-scale"
                    style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--panel-border)', color: 'white', cursor: 'pointer', background: 'transparent' }}
                    onClick={() => setMobilePanelExpanded(e => !e)}
                  >
                    {mobilePanelExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  </button>
                )}
                <button
                  className="glass-pill hover-scale"
                  style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--panel-border)', color: 'white', cursor: 'pointer', background: 'transparent' }}
                  onClick={() => setSelectedStation(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="stat-grid">
              <div className="stat-item" style={{ gridColumn: '1 / -1' }}>
                <div className="stat-label"><Navigation size={14} /> Active Runway (Estimated)</div>
                <div className="stat-value" style={{ color: 'var(--accent-hover)' }}>
                  {(() => { const rwys = runwaysData[selectedStation?.id] || runwaysData['K' + selectedStation?.id]; return rwys && rwys.length > 0 ? `RWY ${getBestRunway(rwys, selectedStation?.windDir) || 'Unknown'}` : 'No Runway Data'; })()}
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
          
          {selectedStation && (!isMobile || mobilePanelExpanded) && (
             <CrosswindControls
                windDir={selectedStation.windDir}
                windSpeed={selectedStation.windSpeed}
                runwayHeading={activeHeading}
                theme={theme}
             />
          )}

          {selectedStation && (!isMobile || mobilePanelExpanded) && (
            <TafTimeline
              key={`taf-${selectedStation.id}`}
              tafData={tafData}
              loading={tafLoading}
              theme={theme}
              timezone={getTimezoneFromLatLon(selectedStation.lat, selectedStation.lon)}
            />
          )}

          {selectedStation && (!isMobile || mobilePanelExpanded) && (
            <NotamPanel
              key={`notam-${selectedStation.id}`}
              notamData={notamData}
              loading={notamLoading}
              theme={theme}
              timezone={getTimezoneFromLatLon(selectedStation.lat, selectedStation.lon)}
            />
          )}

        </div>

        {/* Chat Copilot Widget — hidden on mobile */}
        <div className={`chat-copilot-widget ${chatOpen ? 'open' : ''}`} style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 3000, display: isMobile ? 'none' : 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'auto' }}>
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

        {/* ── About Modal ── */}
        {showAbout && (
          <AboutModal theme={theme} onClose={() => setShowAbout(false)} />
        )}
      </div>
    </div>
  );
}

export default App;
