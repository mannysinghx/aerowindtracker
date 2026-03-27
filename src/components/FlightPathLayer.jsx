/**
 * FlightPathLayer — react-leaflet component that renders the flight route on the map.
 *
 * Draws:
 *  - A glowing dashed polyline between the FROM and TO airports
 *  - Small directional arrow markers at midpoints between each segment
 *  - Waypoint markers showing the nearest surface wind (color-coded by speed)
 *  - Airport label pins at the departure and destination
 */

import React from 'react';
import { Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';

function getWindColor(speed) {
  if (speed == null) return '#94a3b8';
  if (speed < 5)  return '#10b981';
  if (speed < 15) return '#3b82f6';
  if (speed < 25) return '#f59e0b';
  if (speed < 40) return '#ef4444';
  return '#8b5cf6';
}

function calcBearing(lat1, lon1, lat2, lon2) {
  const toRad = x => x * Math.PI / 180;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return Math.round(((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360);
}

function arrowIcon(bearingDeg) {
  return L.divIcon({
    html: `<svg width="20" height="20" viewBox="0 0 20 20" style="overflow:visible; filter:drop-shadow(0 1px 3px rgba(0,0,0,0.7))">
      <path d="M10 2L14.5 16L10 13L5.5 16Z" fill="#38bdf8" transform="rotate(${bearingDeg} 10 10)" />
    </svg>`,
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function airportPinIcon(icao, theme) {
  const bg = theme === 'dark' ? 'rgba(10,17,34,0.95)' : 'rgba(255,255,255,0.96)';
  return L.divIcon({
    html: `<div style="
      background: ${bg};
      border: 2px solid #38bdf8;
      border-radius: 6px;
      padding: 3px 7px;
      font-size: 11px;
      font-weight: 700;
      color: #38bdf8;
      white-space: nowrap;
      box-shadow: 0 2px 10px rgba(56,189,248,0.35), 0 0 0 1px rgba(56,189,248,0.15);
      font-family: 'Courier New', monospace;
      letter-spacing: 0.5px;
    ">${icao}</div>`,
    className: '',
    iconSize: [60, 26],
    iconAnchor: [30, 13],
  });
}

function waypointMarkerIcon(wp, theme) {
  const surf = wp.surface;
  const speed = surf?.windSpeed ?? null;
  const dir = surf?.windDir ?? null;
  const color = getWindColor(speed);
  const rotation = dir != null ? (dir + 180) % 360 : 0;

  const precip = surf?.precip;
  const precipHtml = precip
    ? `<div style="position:absolute;top:-8px;right:-8px;font-size:10px;line-height:1">${precip.icon}</div>`
    : '';

  return L.divIcon({
    html: `<div style="position:relative;width:26px;height:26px">
      <div style="
        width: 26px; height: 26px;
        display: flex; align-items: center; justify-content: center;
        background: ${theme === 'dark' ? 'rgba(10,17,34,0.9)' : 'rgba(255,255,255,0.9)'};
        border: 1.5px solid ${color};
        border-radius: 50%;
        box-shadow: 0 0 8px ${color}44;
      ">
        ${dir != null
          ? `<svg width="14" height="14" viewBox="0 0 14 14">
               <path d="M7 1L10.5 12L7 9.5L3.5 12Z" fill="${color}" transform="rotate(${rotation} 7 7)" />
             </svg>`
          : `<div style="width:5px;height:5px;border-radius:50%;background:${color}"></div>`
        }
      </div>
      ${precipHtml}
    </div>`,
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export default function FlightPathLayer({ routeData, theme }) {
  if (!routeData) return null;

  const { waypoints, from, to } = routeData;
  if (!waypoints || waypoints.length < 2) return null;

  const positions = waypoints.map(wp => [wp.lat, wp.lon]);

  // Direction arrow markers: one between each consecutive pair of waypoints
  const arrowMarkers = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    arrowMarkers.push({
      lat: (a.lat + b.lat) / 2,
      lon: (a.lon + b.lon) / 2,
      bearing: calcBearing(a.lat, a.lon, b.lat, b.lon),
      key: `fp-arrow-${i}`,
    });
  }

  // Intermediate waypoints only (not endpoints, which get airport pins)
  const midWaypoints = waypoints.filter(wp => !wp.label.startsWith('K') || (wp.index > 0 && wp.index < waypoints.length - 1));
  // Actually filter by index to avoid showing the endpoint label as a waypoint circle
  const intermediateWaypoints = waypoints.filter(wp => wp.index > 0 && wp.index < waypoints.length - 1);

  return (
    <>
      {/* Glow halo behind the route */}
      <Polyline
        positions={positions}
        pathOptions={{ color: '#38bdf8', weight: 10, opacity: 0.08, dashArray: null }}
      />

      {/* Main dashed route line */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: '#38bdf8',
          weight: 2.5,
          opacity: 0.9,
          dashArray: '9 6',
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />

      {/* Directional arrow markers */}
      {arrowMarkers.map(a => (
        <Marker
          key={a.key}
          position={[a.lat, a.lon]}
          icon={arrowIcon(a.bearing)}
          interactive={false}
        />
      ))}

      {/* Intermediate waypoint wind markers */}
      {intermediateWaypoints.map(wp => (
        <Marker
          key={`fp-wp-${wp.index}`}
          position={[wp.lat, wp.lon]}
          icon={waypointMarkerIcon(wp, theme)}
          interactive={false}
        />
      ))}

      {/* Departure airport pin */}
      <Marker
        key="fp-from"
        position={[from.lat, from.lon]}
        icon={airportPinIcon(from.icao, theme)}
        interactive={false}
      />

      {/* Destination airport pin */}
      <Marker
        key="fp-to"
        position={[to.lat, to.lon]}
        icon={airportPinIcon(to.icao, theme)}
        interactive={false}
      />
    </>
  );
}
