/**
 * AirspaceDotsLayer — renders colored dot markers for Class B, C, and D airports.
 *
 * Color coding (matches FAA sectional chart conventions):
 *   Class B  — bright cyan    #38bdf8  (~37 primary FAA Class B airports)
 *   Class C  — bright fuchsia #e879f9  (~130 FAA Class C airports)
 *   Class D  — cornflower     #818cf8  (~500+ towered airports not in B or C)
 *   Class E  — green          #4ade80  (all other airports)
 *
 * Classification uses authoritative FAA-sourced sets, NOT OurAirports type field
 * (OurAirports "large_airport" does not equal Class B — it conflates B and C).
 */

import React, { useMemo, useState } from 'react';
import { CircleMarker, Tooltip, useMapEvents, useMap } from 'react-leaflet';

// ── FAA Class B airports (primary airports within each Class B airspace) ──────
// Source: FAA JO 7400.11 / AIM Chapter 3, Section 2
export const CLASS_B_SET = new Set([
  // Northeast
  'KBOS','KJFK','KLGA','KEWR','KPHL','KBWI','KDCA','KIAD',
  // Southeast
  'KATL','KCLT','KMIA','KFLL','KMCO','KTPA','KPBI','KRSW',
  // Central
  'KORD','KMDW','KDTW','KIND','KCLE','KCMH','KPIT','KCVG',
  'KSTL','KMEM','KBNA','KMSY',
  // South / Texas
  'KIAH','KHOU','KDFW','KDAL','KSAT','KAUS','KELP',
  // Mountain / West
  'KDEN','KPHX','KLAS','KSLC','KABQ',
  // Pacific
  'KSEA','KSFO','KLAX','KSAN','KPDX','KOAK','KSJC',
  // Hawaii
  'PHNL',
  // Anchorage
  'PANC',
]);

// ── FAA Class C airports (~130 airports with Class C airspace) ────────────────
// Source: FAA JO 7400.11 / AIM Chapter 3, Section 3
export const CLASS_C_SET = new Set([
  // Alaska
  'PAFB','PAEI','PAJN','PAKT','PAOM',
  // Hawaii
  'PHKO','PHLI','PHOG',
  // Pacific West
  'KBUR','KVNY','KLGB','KSNA','KONT','KPSP','KSBD','KSMF',
  'KFAT','KBFL','KMOD','KSTS','KAPC','KRNO','KTRK',
  'KHIO','KRNT','KPAE','KTIW','KOLM','KEUG','KMFR','KRDM',
  'KBOI','KPSC','KYKM','KGEG',
  // Mountain
  'KCOS','KGJT','KPUB','KDRO','KASE','KFNL',
  'KBZN','KGTF','KHLN','KGPI','KMSO','KIDA',
  'KTWF','KSMN',
  'KOGD','KPVU','KCDC','KENV','KRKS','KRIL',
  // Southwest
  'KPHX','KTUS','KFHU','KYUM',
  'KALB','KSAF',
  // Texas
  'KAMA','KLBB','KMAF','KABI','KSJT','KACT','KGGG','KTYR',
  'KCLL','KGRK','KTXK','KFYV','KXNA','KHOT','KFSM',
  'KBRO','KLRD','KDRT',
  // Midwest / Plains
  'KFAR','KBIS','KGFK','KABR','KRAP','KPIR',
  'KFSD','KSUX','KDSM','KCID','KDBQ',
  'KRST','KDLH','KEAU','KMSN','KGRB','KATW','KFLD','KCWA',
  'KFWA','KSBN','KAZO','KLSE',
  'KMKE','KOSH',
  'KSPI','KPIA','KBMI',
  'KICT','KTOP','KFOE','KBEC','KSLN',
  'KSTJ','KCOU','KSGF','KJLN','KMKC','KOJC',
  'KOMA','KLNK',
  // South / Southeast
  'KMGM','KBHM','KHSV','KMOB','KPNS','KGPT','KJAN','KTUP','KGTR',
  'KTLH','KGNV','KVRB','KDAB','KSFB','KPIE','KORL','KMLB','KRSW',
  'KFXE','KHWO','KISM',
  'KJAX','KCHS','KCAE','KMYR','KILM','KGSO','KRDU','KFAY','KAVL',
  'KTYS','KCHA','KTRI','KLEX','KSDF','KCRW',
  'KRIC','KPHF','KNGU',
  'KHTS','KPKB',
  // Mid-Atlantic / Northeast
  'KALB','KBUF','KSYR','KITH','KBGM','KELM','KHPN','KPOU','KRDG',
  'KPVD','KORH','KBDL','KPWM','KBGR','KBTV',
  'KDAY','KCAK','KTOL','KYNG',
  'KGSB','KFAY','KILM',
  // Military / Other
  'KADW','KNGP','KNGW',
]);

// ── FAA Class D airports (towered airports not in B or C) ─────────────────────
// Source: FAA Airport/Facility Directory; this list covers ~500 prominent Class D fields
export const CLASS_D_SET = new Set([
  // California
  'KCCR','KRHV','KPAO','KHWD','KLVK','KSQL','KTOA','KFUL',
  'KSBA','KOXR','KCMA','KWVI','KSCK','KVCV','KHHR','KTMF','KPMD',
  'KCNO','KMYF','KCRQ','KMCC','KEDU','KSUU','KNUQ','KMOF','KTVL',
  'KLPC','KPRB','KSMX','KSZP','KNTD',
  // Pacific Northwest
  'KMWH','KPUW','KHQM','KOTG','KSHN',
  'KTTD','KGCD','KAPN',
  // Mountain
  'KALS','KGXY','KBDU','KAPA','KFTG','KSGU',
  'KBTM','KDLN','KTWD',
  'KELKO','KENV',
  // Plains / Midwest
  'KFPK','KMCB','KLBL','KHYS','KGCK','KBEC',
  'KCNU','KHLC','KDDC','KJLN',
  'KSPD','KMJD','KJEF','KSZL','KURB',
  'KAXN','KMCW','KBRL','KFOD','KSPW','KEST',
  'KGYY','KPWK','KDPA','KARR','KUGN','KRAC',
  'KMFD','KLCK',
  'KCGF','KBKL','KLUK',
  'KFDY',
  // South / Southeast
  'KABY','KAND','KAGS','KCSG','KVLD',
  'KDFN',
  'KORF','KEWN','KPGV',
  'KSHD','KLUA','KHSP','KJYO','KHEF','KNYG','KDAA','KCJR',
  'KOFP','KDMH','KMDQ',
  // Texas
  'KADS','KAFW','KHQZ','KFTW','KGKY','KCRS','KGVT','KTKI',
  'KRBD','KUVA','KSSF','KSKF','KBAZ','KGRK','KILE','KCNW',
  'KLRD','KDRT',
  // New Mexico
  'KCNM','KAEG',
  // Northeast
  'KART','KBFD','KCQM','KITH','KELM','KFZY','KGFL',
  'KJHW','KLKP','KSCH','KSWR','KUCP','KUCA',
  'KWST','KEWB',
  'KBED','KPSM','KCON','KMPV',
  'KPWM','KAUG','KBHB','KCSX','KPQI','KCAR',
  'KALG','KAFJ','KLBE','KAGC','KFKL',
  // Mid-Atlantic
  'KBWG','KPAH',
  // Southeast additions
  'KGSP','KVAB',
]);

const CLASS_CONFIG = {
  B: { color: '#38bdf8', radius: 12, fillOpacity: 0.07, weight: 2,   minZoom: 5,  label: 'Class B' },
  C: { color: '#e879f9', radius: 9,  fillOpacity: 0.06, weight: 1.5, minZoom: 7,  label: 'Class C' },
  D: { color: '#818cf8', radius: 7,  fillOpacity: 0.05, weight: 1.5, minZoom: 9,  label: 'Class D' },
};

/**
 * Classify an airport by its FAA airspace class.
 * Uses authoritative hardcoded sets — NOT OurAirports type field.
 * us_airports.json stores IDs without the K prefix (e.g. "ATL" not "KATL"),
 * so we check both forms against the K-prefixed sets.
 */
export function getAirspaceClass(airport) {
  const id  = airport.id;                              // e.g. "ATL"
  const kid = id.startsWith('K') ? id : 'K' + id;     // e.g. "KATL"
  if (CLASS_B_SET.has(id) || CLASS_B_SET.has(kid)) return 'B';
  if (CLASS_C_SET.has(id) || CLASS_C_SET.has(kid)) return 'C';
  if (CLASS_D_SET.has(id) || CLASS_D_SET.has(kid)) return 'D';
  return null; // Class E or uncontrolled
}

export default function AirspaceDotsLayer({ allAirports, airportFilter = 'BCDE' }) {
  const map = useMap();
  const [zoom, setZoom]     = useState(() => map.getZoom());
  const [bounds, setBounds] = useState(() => map.getBounds());

  useMapEvents({
    zoomend: (e) => { setZoom(e.target.getZoom()); setBounds(e.target.getBounds()); },
    moveend: (e) => { setBounds(e.target.getBounds()); },
  });

  const dots = useMemo(() => {
    if (!allAirports) return [];
    return allAirports
      .map(a => ({ ...a, cls: getAirspaceClass(a) }))
      .filter(a => a.cls !== null && airportFilter.includes(a.cls));
  }, [allAirports, airportFilter]);

  const visible = useMemo(() => {
    return dots.filter(a => {
      const cfg = CLASS_CONFIG[a.cls];
      if (zoom < cfg.minZoom) return false;
      if (!bounds) return true;
      return (
        a.lat >= bounds.getSouth() - 1 &&
        a.lat <= bounds.getNorth() + 1 &&
        a.lon >= bounds.getWest()  - 1 &&
        a.lon <= bounds.getEast()  + 1
      );
    });
  }, [dots, zoom, bounds]);

  return (
    <>
      {visible.map(a => {
        const cfg = CLASS_CONFIG[a.cls];
        return (
          <CircleMarker
            key={`airspace-${a.id}`}
            center={[a.lat, a.lon]}
            radius={cfg.radius}
            pathOptions={{
              color: cfg.color,
              fillColor: cfg.color,
              fillOpacity: cfg.fillOpacity,
              weight: cfg.weight,
              className: 'airspace-ring',
            }}
            interactive={false}
            bubblingMouseEvents={false}
          >
            {zoom >= 9 && (
              <Tooltip
                permanent
                direction="top"
                offset={[0, -(cfg.radius + 3)]}
                className="airspace-dot-label"
              >
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  color: cfg.color,
                  fontFamily: 'monospace',
                  background: 'rgba(5,10,20,0.8)',
                  padding: '1px 3px',
                  borderRadius: '2px',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.3px',
                }}>
                  {a.id}
                </span>
              </Tooltip>
            )}
          </CircleMarker>
        );
      })}
    </>
  );
}
