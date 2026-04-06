/**
 * AirspaceDotsLayer — renders colored dot markers for Class B, C, and D airports.
 *
 * Color coding (matches FAA sectional chart conventions):
 *   Class B  — bright cyan   #38bdf8   (large_airport)
 *   Class C  — bright fuchsia #e879f9  (medium_airport)
 *   Class D  — cornflower     #818cf8  (small_airport with known Class D code)
 *
 * Visibility by zoom:
 *   Class B  — zoom ≥ 6
 *   Class C  — zoom ≥ 7
 *   Class D  — zoom ≥ 9
 */

import React, { useMemo, useState, useEffect } from 'react';
import { CircleMarker, Tooltip, useMapEvents, useMap } from 'react-leaflet';

// FAA-designated Class D airports (control towers at smaller fields).
// This list covers the most prominent ones; Class B/C come from OurAirports type field.
const CLASS_D_SET = new Set([
  'KBFI','KVNY','KSMO','KCCR','KRHV','KPAO','KHWD','KLVK','KSQL',
  'KTOA','KFUL','KSBA','KOXR','KCMA','KWVI','KOAK','KSJC','KMOD',
  'KFAT','KBFL','KVCV','KONT','KHHR','KTMF','KSBD','KPSP','KPMD',
  'KBUR','KLGB','KCNO','KTOA','KSNA','KMYF','KCRQ','KMCC','KEDU',
  'KSUU','KNUQ','KMOF','KTVL','KAPC','KSTS','KEDU',
  'KMWH','KPUW','KYKM','KHQM','KOTG','KPAE','KRNT','KTIW','KSHN',
  'KOLM','KHIO','KTTD','KEUG','KMFR','KRDM','KGCD','KAPN',
  'KALS','KCOS','KGJT','KPUB','KGXY','KFNL','KBDU',
  'KAPA','KFTG','KSGU','KPVU','KOGD','KPVU','KCDC','KENV','KELKO',
  'KBTM','KMSO','KGTF','KBZN','KHLN','KGPI','KDLN','KIDA','KTWD',
  'KABR','KRAP','KPIR','KFAR','KBIS','KGFK','KJMS','KSMX',
  'KFSD','KABY','KAND','KAGS','KCSG','KVLD','KAXN','KDLH','KRST',
  'KEAU','KAZO','KGRB','KMSN','KLSE','KFWA','KSBN','KMGM',
  'KHSV','KBHM','KJAN','KTUP','KGPT','KGTR','KMOB','KPNS','KDFN',
  'KTLH','KGNV','KVRB','KDAB','KSFB','KPIE','KTPA','KSRQ','KRSW',
  'KPBI','KFLL','KHWO','KFXE','KXMR','KISM','KORL','KMLB','KVAB',
  'KCHA','KTYS','KTRI','KPKB','KCRW','KBKW','KEKN','KHTS','KLWB',
  'KRIC','KORF','KPHF','KNGU','KNTU','KNGU','KNORFOLK','KCPK',
  'KSHD','KLUA','KHSP','KJYO','KHEF','KIAD','KNYG','KDAA','KCJR',
  'KOFP','KDMH','KMDQ','KBWI','KDMA',
  'KBKL','KCGF','KLUK','KIND','KGYY','KPWK','KDPA','KARR','KUGN',
  'KMKE','KRAC','KMSN','KOSH','KATW','KFLD','KGRB','KCWA','KEAU',
  'KSPI','KPIA','KBMI','KURB','KGYY','KLOT','KASD',
  'KCID','KDBQ','KOTM','KSUX','KDSM','KALO','KMCW','KBRL','KFOD',
  'KSPW','KEST','KFPK','KMCB','KSLN','KICT','KLBL','KHYS','KGCK',
  'KBEC','KFOE','KTOP','KCNU','KHLC','KDDC','KJLN','KMKC',
  'KOJC','KSTJ','KCOU','KSGF','KSPD','KMJD','KJEF','KSZL',
  'KFSM','KTXK','KFYV','KROG','KXNA','KHOT','KPBF',
  'KOSU','KCMH','KLCK','KDAY','KCAK','KYNG','KFDY','KCLE','KBKL',
  'KCGF','KTOL','KMFD','KECP',
  'KAVL','KGSO','KRDU','KFAY','KILM','KEWN','KPGV','KORF',
  'KMYR','KCAE','KCHS','KGSP','KAND','KAGS',
  'KLEX','KCVG','KSDF','KBWG','KPAH','KRIC','KCNM','KADS',
  'KAFW','KHQZ','KFTW','KDAL','KGKY','KCRS','KGVT','KTKI',
  'KRBD','KUVA','KSAT','KSSF','KSKF','KBAZ','KGRK','KILE',
  'KACT','KAFW','KCNW','KGGG','KTYR','KLRD','KDRT','KBRO',
  'KHALV','KELP','KMAF','KINK','KABI','KSJT','KSAF','KAEG',
  'KALB','KBGM','KBUF','KART','KBFD','KCQM','KITH',
  'KELM','KFZY','KGFL','KHPN','KJHW','KLKP','KPOU',
  'KRDG','KSCH','KSWR','KUCP','KUCA','KALB',
  'KPVD','KBDL','KHFD','KWST','KEWB','KORH',
  'KBED','KBOS','KPSM','KCON','KBTV','KMPV',
  'KPWM','KAUG','KBHB','KBGR','KCSX','KPQI','KCAR',
  'KALG','KAFJ','KBFD','KLBE','KAGC','KFKL','KUNITOWN',
]);

const CLASS_CONFIG = {
  B: { color: '#38bdf8', radius: 11, fillOpacity: 0.06, weight: 2,   minZoom: 5,  label: 'Class B' },
  C: { color: '#e879f9', radius: 9,  fillOpacity: 0.06, weight: 1.5, minZoom: 7,  label: 'Class C' },
  D: { color: '#818cf8', radius: 7,  fillOpacity: 0.05, weight: 1.5, minZoom: 9,  label: 'Class D' },
};

export function getAirspaceClass(airport) {
  if (airport.type === 'large_airport')  return 'B';
  if (airport.type === 'medium_airport') return 'C';
  if (CLASS_D_SET.has(airport.id))       return 'D';
  return null;
}

export { CLASS_D_SET };

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
      // Visible bounds check with small padding
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
              // Ensure the circle never captures pointer events — wind arrow markers sit on top
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
