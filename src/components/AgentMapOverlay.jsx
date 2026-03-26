/**
 * AgentMapOverlay — renders Leaflet shapes for an active agent finding.
 * Must be rendered inside a <MapContainer>.
 */

import { useEffect } from 'react';
import { useMap, Polyline, Circle, Polygon } from 'react-leaflet';

// Build a rectangular corridor polygon between two lat/lon points
function buildCorridor(lat1, lon1, lat2, lon2, widthDeg = 0.28) {
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

// Fly map to the finding's location, offset right so the left panel doesn't cover it
function MapFlyTo({ finding }) {
    const map = useMap();
    useEffect(() => {
        if (!finding) return;
        const rawLat = finding.lat ?? (finding.fromLat != null ? (finding.fromLat + finding.toLat) / 2 : null);
        const rawLon = finding.lon ?? (finding.fromLon != null ? (finding.fromLon + finding.toLon) / 2 : null);
        if (rawLat == null || rawLon == null) return;

        // Offset the target point ~180px right to keep it visible beside the left panel
        const zoom = Math.max(map.getZoom(), 6);
        const targetPx = map.project([rawLat, rawLon], zoom);
        targetPx.x -= 180; // shift center right so overlay appears in open map area
        const offsetLatLon = map.unproject(targetPx, zoom);
        map.flyTo(offsetLatLon, zoom, { duration: 1.2 });
    }, [finding, map]);
    return null;
}

export default function AgentMapOverlay({ finding }) {
    if (!finding) return null;

    const { type, lat, lon, fromLat, fromLon, toLat, toLon, severity } = finding;

    // ── WIND_SHEAR: corridor rectangle + centerline + endpoint circles ──
    if (type === 'WIND_SHEAR') {
        const color = severity === 'HIGH' ? '#ef4444' : '#38bdf8';
        // Full corridor when we have both endpoints
        if (fromLat != null && toLat != null) {
            const corridor = buildCorridor(fromLat, fromLon, toLat, toLon);
            return (
                <>
                    <MapFlyTo finding={finding} />
                    {corridor && (
                        <Polygon
                            positions={corridor}
                            pathOptions={{ color, fillColor: color, fillOpacity: 0.25, weight: 2, opacity: 0.85, dashArray: '7 4' }}
                        />
                    )}
                    <Polyline
                        positions={[[fromLat, fromLon], [toLat, toLon]]}
                        pathOptions={{ color, weight: 3.5, opacity: 1, dashArray: '10 6' }}
                    />
                    <Circle center={[fromLat, fromLon]} radius={8000}
                        pathOptions={{ color, fillColor: color, fillOpacity: 0.55, weight: 2.5 }} />
                    <Circle center={[toLat, toLon]} radius={8000}
                        pathOptions={{ color, fillColor: color, fillOpacity: 0.55, weight: 2.5 }} />
                </>
            );
        }
        // Fallback: just midpoint circle when only lat/lon available
        if (lat != null) {
            return (
                <>
                    <MapFlyTo finding={finding} />
                    <Circle center={[lat, lon]} radius={60000}
                        pathOptions={{ color, fillColor: color, fillOpacity: 0.2, weight: 2.5, dashArray: '8 5' }} />
                    <Circle center={[lat, lon]} radius={12000}
                        pathOptions={{ color, fillColor: color, fillOpacity: 0.5, weight: 2.5 }} />
                </>
            );
        }
        return <MapFlyTo finding={finding} />;
    }

    // ── EXTREME_WIND: red pulse zone ──
    if (type === 'EXTREME_WIND' && lat != null) {
        return (
            <>
                <MapFlyTo finding={finding} />
                <Circle center={[lat, lon]} radius={40000}
                    pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, weight: 2, dashArray: '6 4' }} />
                <Circle center={[lat, lon]} radius={12000}
                    pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.45, weight: 3 }} />
            </>
        );
    }

    // ── IFR_CLUSTER: amber coverage zone ──
    if (type === 'IFR_CLUSTER' && lat != null) {
        return (
            <>
                <MapFlyTo finding={finding} />
                <Circle center={[lat, lon]} radius={320000}
                    pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.1, weight: 1.5, dashArray: '10 6' }} />
                <Circle center={[lat, lon]} radius={70000}
                    pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.3, weight: 2.5 }} />
            </>
        );
    }

    // ── ICING_RISK: cyan zone ──
    if (type === 'ICING_RISK' && lat != null) {
        return (
            <>
                <MapFlyTo finding={finding} />
                <Circle center={[lat, lon]} radius={200000}
                    pathOptions={{ color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 0.12, weight: 1.5, dashArray: '7 4' }} />
                <Circle center={[lat, lon]} radius={45000}
                    pathOptions={{ color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 0.35, weight: 2.5 }} />
            </>
        );
    }

    // ── FOG_RISK ──
    if (type === 'FOG_RISK' && lat != null) {
        return (
            <>
                <MapFlyTo finding={finding} />
                <Circle center={[lat, lon]} radius={260000}
                    pathOptions={{ color: '#94a3b8', fillColor: '#94a3b8', fillOpacity: 0.12, weight: 1.5, dashArray: '5 4' }} />
            </>
        );
    }

    // ── Generic fallback for any finding with lat/lon ──
    if (lat != null) {
        return (
            <>
                <MapFlyTo finding={finding} />
                <Circle center={[lat, lon]} radius={90000}
                    pathOptions={{ color: '#8b5cf6', fillColor: '#8b5cf6', fillOpacity: 0.18, weight: 2.5, dashArray: '6 4' }} />
            </>
        );
    }

    return <MapFlyTo finding={finding} />;
}
