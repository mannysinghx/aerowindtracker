/**
 * AgentMapOverlay — renders Leaflet shapes for an active agent finding.
 * Must be rendered inside a <MapContainer>.
 */

import { useEffect } from 'react';
import { useMap, Polyline, Circle, Polygon } from 'react-leaflet';

// Build a rectangular corridor polygon between two lat/lon points
function buildCorridor(lat1, lon1, lat2, lon2, widthDeg = 0.22) {
    const dlat = lat2 - lat1;
    const dlon = lon2 - lon1;
    const len = Math.sqrt(dlat * dlat + dlon * dlon);
    if (len === 0) return null;
    const px = (-dlat / len) * widthDeg;
    const py = (dlon / len) * widthDeg;
    return [
        [lat1 + px, lon1 + py],
        [lat2 + px, lon2 + py],
        [lat2 - px, lon2 - py],
        [lat1 - px, lon1 - py],
    ];
}

// Fly map to the finding's location
function MapFlyTo({ finding }) {
    const map = useMap();
    useEffect(() => {
        if (!finding) return;
        const lat = finding.lat ?? ((finding.fromLat + finding.toLat) / 2);
        const lon = finding.lon ?? ((finding.fromLon + finding.toLon) / 2);
        if (lat != null && lon != null) {
            map.flyTo([lat, lon], Math.max(map.getZoom(), 6), { duration: 1.2 });
        }
    }, [finding, map]);
    return null;
}

export default function AgentMapOverlay({ finding }) {
    if (!finding) return null;

    const { type, lat, lon, fromLat, fromLon, toLat, toLon, severity } = finding;

    // ── WIND_SHEAR: corridor rectangle + endpoint circles ──
    if (type === 'WIND_SHEAR' && fromLat != null) {
        const corridor = buildCorridor(fromLat, fromLon, toLat, toLon);
        const color = severity === 'HIGH' ? '#ef4444' : '#3b82f6';
        return (
            <>
                <MapFlyTo finding={finding} />
                {corridor && (
                    <Polygon
                        positions={corridor}
                        pathOptions={{ color, fillColor: color, fillOpacity: 0.18, weight: 1.5, opacity: 0.7, dashArray: '6 4' }}
                    />
                )}
                <Polyline
                    positions={[[fromLat, fromLon], [toLat, toLon]]}
                    pathOptions={{ color, weight: 2.5, opacity: 0.9, dashArray: '8 5' }}
                />
                <Circle center={[fromLat, fromLon]} radius={6000}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.35, weight: 2 }} />
                <Circle center={[toLat, toLon]} radius={6000}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.35, weight: 2 }} />
            </>
        );
    }

    // ── EXTREME_WIND: pulsing red zone ──
    if (type === 'EXTREME_WIND' && lat != null) {
        return (
            <>
                <MapFlyTo finding={finding} />
                <Circle center={[lat, lon]} radius={35000}
                    pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.12, weight: 2, dashArray: '5 4' }} />
                <Circle center={[lat, lon]} radius={10000}
                    pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.3, weight: 2.5 }} />
            </>
        );
    }

    // ── MOUNTAIN_WAVE: purple arc zone (no lat/lon stored — skip) ──

    // ── IFR_CLUSTER: large amber coverage zone ──
    if (type === 'IFR_CLUSTER' && lat != null) {
        return (
            <>
                <MapFlyTo finding={finding} />
                <Circle center={[lat, lon]} radius={320000}
                    pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.08, weight: 1.5, dashArray: '8 6' }} />
                <Circle center={[lat, lon]} radius={60000}
                    pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.22, weight: 2 }} />
            </>
        );
    }

    // ── ICING_RISK: cyan zone ──
    if (type === 'ICING_RISK' && lat != null) {
        return (
            <>
                <MapFlyTo finding={finding} />
                <Circle center={[lat, lon]} radius={180000}
                    pathOptions={{ color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 0.1, weight: 1.5, dashArray: '6 4' }} />
                <Circle center={[lat, lon]} radius={40000}
                    pathOptions={{ color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 0.28, weight: 2 }} />
            </>
        );
    }

    // ── FOG_RISK: gray-blue zone (if lat/lon present) ──
    if (type === 'FOG_RISK' && lat != null) {
        return (
            <>
                <MapFlyTo finding={finding} />
                <Circle center={[lat, lon]} radius={250000}
                    pathOptions={{ color: '#94a3b8', fillColor: '#94a3b8', fillOpacity: 0.1, weight: 1, dashArray: '4 4' }} />
            </>
        );
    }

    // ── TURBULENCE_CLUSTER / ICING_PIREPS: no reliable lat/lon — just fly if available ──
    if (lat != null) {
        return (
            <>
                <MapFlyTo finding={finding} />
                <Circle center={[lat, lon]} radius={80000}
                    pathOptions={{ color: '#8b5cf6', fillColor: '#8b5cf6', fillOpacity: 0.15, weight: 2, dashArray: '5 4' }} />
            </>
        );
    }

    return null;
}
