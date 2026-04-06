/**
 * AirspaceDotsLayer — renders colored dot markers for Class B, C, and D airports.
 *
 * Color coding (matches FAA sectional chart conventions):
 *   Class B  — bright cyan    #38bdf8  (40 FAA Class B airports per JO 7400.11)
 *   Class C  — bright fuchsia #e879f9  (122 FAA Class C airports per JO 7400.11)
 *   Class D  — cornflower     #818cf8  (~428 towered airports not in Class B or C)
 *   Class E  — green          #4ade80  (all other airports)
 *
 * Source: FAA JO 7400.11, AIM Chapter 3, Wikipedia "List of Class B/C/D airports in the US"
 * IDs checked against both bare (ATL) and K-prefixed (KATL) forms since us_airports.json
 * stores IDs without the K prefix.
 */

import React, { useMemo, useState } from 'react';
import { CircleMarker, Tooltip, useMapEvents, useMap } from 'react-leaflet';

// ── FAA Class B airports (40 total) ─────────────────────────────────────────
// Source: FAA JO 7400.11 / Wikipedia "List of Class B airports in the United States"
export const CLASS_B_SET = new Set([
  // Northeast
  'KBOS','KBWI','KDCA','KEWR','KIAD','KJFK','KLGA','KPHL',
  // Southeast
  'KADW','KATL','KCLT','KMCO','KMIA','KTPA',
  // Great Lakes / Midwest
  'KCLE','KCVG','KDTW','KMCI','KMEM','KMSP','KORD','KPIT','KSTL',
  // South / Gulf
  'KDAL','KDFW','KHOU','KIAH','KMSY',
  // Mountain / Southwest
  'KDEN','KLAS','KLSV','KPHX','KSLC',
  // Pacific Coast
  'KLAX','KNKX','KSAN','KSEA','KSFO',
  // Hawaii / Alaska
  'PANC','PHNL',
]);

// ── FAA Class C airports (122 total) ────────────────────────────────────────
// Source: FAA JO 7400.11 / Wikipedia "List of Class C airports in the United States"
export const CLASS_C_SET = new Set([
  // Alabama
  'KBHM','KHSV','KMOB',
  // Arizona (incl. Davis-Monthan AFB)
  'KDMA','KTUS',
  // Arkansas
  'KLIT','KXNA',
  // California (incl. Beale AFB, March ARB)
  'KBAB','KBUR','KFAT','KMRY','KOAK','KONT','KRIV','KSBA','KSJC','KSMF','KSNA',
  // Colorado
  'KCOS',
  // Connecticut
  'KBDL',
  // Florida (incl. NAS Whiting Field N/S, NAS Pensacola)
  'KDAB','KFLL','KJAX','KNDZ','KNPA','KNSE','KPBI','KPNS','KRSW','KSFB','KSRQ','KTLH',
  // Georgia
  'KSAV',
  // Idaho
  'KBOI',
  // Illinois
  'KCMI','KMDW','KMLI','KPIA','KSPI',
  // Indiana
  'KEVV','KFWA','KIND','KSBN',
  // Iowa
  'KCID','KDSM',
  // Kansas
  'KICT',
  // Kentucky
  'KLEX','KSDF',
  // Louisiana (incl. Barksdale AFB)
  'KBAD','KBTR','KLFT','KSHV',
  // Maine
  'KBGR','KPWM',
  // Michigan
  'KFNT','KGRR','KLAN',
  // Mississippi (incl. Columbus AFB)
  'KCBM','KJAN',
  // Missouri
  'KSGF',
  // Montana
  'KBIL',
  // Nebraska (incl. Offutt AFB)
  'KLNK','KOFF','KOMA',
  // Nevada
  'KRNO',
  // New Hampshire
  'KMHT',
  // New Jersey
  'KACY',
  // New Mexico
  'KABQ',
  // New York
  'KALB','KBUF','KISP','KROC','KSYR',
  // North Carolina (incl. Pope Army Airfield)
  'KAVL','KFAY','KGSO','KPOB','KRDU',
  // Ohio
  'KCAK','KCMH','KDAY','KTOL',
  // Oklahoma (incl. Tinker AFB)
  'KOKC','KTIK','KTUL',
  // Oregon
  'KPDX',
  // Pennsylvania
  'KABE',
  // Rhode Island
  'KPVD',
  // South Carolina (incl. Shaw AFB)
  'KCAE','KCHS','KGSP','KMYR','KSSC',
  // Tennessee
  'KBNA','KCHA','KTYS',
  // Texas (incl. Laughlin AFB, Dyess AFB)
  'KABI','KAMA','KAUS','KCRP','KDLF','KDYS','KELP','KHRL','KLBB','KMAF','KSAT',
  // Vermont
  'KBTV',
  // Virginia
  'KORF','KRIC','KROA',
  // Washington (incl. NAS Whidbey Island, Fairchild AFB)
  'KGEG','KNUW','KSKA',
  // West Virginia
  'KCRW',
  // Wisconsin
  'KGRB','KMKE','KMSN',
  // Hawaii
  'PHOG',
  // Territories
  'TJSJ','TIST',
]);

// ── FAA Class D airports (~428 towered airports not in Class B or C) ─────────
// Source: Wikipedia "List of Class D airports in the United States"
export const CLASS_D_SET = new Set([
  // Alabama
  'KDHN','KJKA','KBFM','KMGM','KTOI','KTCL',
  // Arizona
  'KIFP','KCHD','KFLG','KFHU','KGEU','KGYR','KGCN','KFFZ','KDVT','KAZA','KPRC','KSDL','KRYN','KNYL',
  // Arkansas
  'KFYV','KFSM','KROG','KASG','KTXK',
  // California
  'KBFL','KCMA','KCRQ','KCIC','KCNO','KCCR','KEMT','KFUL','KHHR','KHWD','KWJF','KPOC',
  'KLVK','KLGB','KWHP','KMER','KMOD','KMHV','KAPC','KOXR','KPMD','KPSP','KPAO','KRNM',
  'KRDD','KRAL','KMHR','KSNS','KSBD','KSQL','KSEE','KMYF','KSDM','KRHV','KSBP',
  'KSMX','KSMO','KSTS','KSCK','KTOA','KTRK','KVNY','KVCV',
  // Colorado
  'KASE','KBJC','KAPA','KCFO','KEGE','KGJT','KPUB',
  // Connecticut
  'KBDR','KDXR','KGON','KHFD','KHVN','KOXC',
  // Delaware
  'KDOV','KILG',
  // Florida
  'KBOW','KBCT','KBKV','KDTS','KFXE','KFMY','KFPR','KGNV','KHWO','KVQQ','KCRG','KEYW',
  'KLCQ','KLAL','KLEE','KMLB','KTMB','KOPF','KAPF','KEVB','KOCF','KISM','KORL','KOMN',
  'KFIN','KECP','KPMP','KPGD','KSGJ','KSPG','KPIE','KSUA','KTIX','KVPS','KVRB',
  // Georgia
  'KABY','KAHN','KFTY','KRYY','KPDK','KAGS','KCSG','KEZM','KLHW','KLZU','KMCN','KVLD',
  // Idaho
  'KSUN','KIDA','KLWS','KPIH','KTWF',
  // Illinois
  'KALN','KBLV','KBMI','KCPS','KMDH','KUGN','KARR','KPWK','KDPA','KDEC','KMWA','KRFD',
  // Indiana
  'KAID','KBMG','KBAK','KEKM','KGYY','KLAF','KMIE','KGUS','KHUF',
  // Iowa
  'KDBQ','KSUX','KALO',
  // Kansas
  'KGCK','KHUT','KMHK','KIXD','KOJC','KSLN','KTOP','KFOE','KBEC',
  // Kentucky
  'KLOU','KOWB','KPAH',
  // Louisiana
  'KAEX','KHDC','KHUM','KLCH','KCWF','KMLU','KARA','KNEW','KDTN',
  // Maryland
  'KMTN','KESN','KFDK','KHGR','KSBY',
  // Massachusetts
  'KBED','KBVY','KHYA','KLWM','KACK','KEWB','KOWD','KCEF','KMVY','KBAF','KORH',
  // Michigan
  'KAPN','KARB','KBTL','KDET','KYIP','KGOV','KJXN','KAZO','KSAW','KMKG','KPTK','KMBS','KTVC',
  // Minnesota
  'KDLH','KMIC','KFCM','KANE','KRST','KSTC','KSTP',
  // Mississippi
  'KHSA','KGTR','KGLH','KGWO','KGPT','KHKS','KMEI','KOLV','KPQL','KTUP',
  // Missouri
  'KBBG','KCGI','KCOU','KTBN','KJEF','KJLN','KMKC','KSTJ','KSUS',
  // Montana
  'KBZN','KGTF','KHLN','KGPI','KMSO',
  // Nebraska
  'KGRI',
  // Nevada
  'KVGT','KHND',
  // New Hampshire
  'KLEB','KASH','KPSM',
  // New Jersey
  'KCDW','KMMU','KTEB','KTTN',
  // New Mexico
  'KAEG','KFMN','KHOB','KROW','KSAF',
  // New York
  'KBGM','KELM','KFRG','KITH','KSWF','KIAG','KPOU','KRME','KSCH','KFOK','KHPN',
  // North Carolina
  'KVUJ','KJQF','KECG','KHKY','KOAJ','KISO','KEWN','KILM','KINT',
  // North Dakota
  'KBIS','KFAR','KGFK','KMOT',
  // Ohio
  'KLUK','KCGF','KBKL','KTZR','KLCK','KOSU','KMFD','KILN','KYNG',
  // Oklahoma
  'KADM','KCSM','KWDG','KLAW','KOUN','KPWA','KSWO','KRVS',
  // Oregon
  'KUAO','KEUG','KLMT','KMFR','KOTH','KPDT','KHIO','KTTD','KRDM','KSLE',
  // Pennsylvania
  'KBVI','KERI','KCXY','KMDT','KJST','KLNS','KLBE','KPNE','KAGC','KRDG','KUNV','KAVP','KIPT',
  // Rhode Island
  'KOQU',
  // South Carolina
  'KFLO','KGMU','KGYH','KHXD','KCRE',
  // South Dakota
  'KRAP','KRCA','KFSD',
  // Tennessee
  'KTRI','KMKL','KNQA','KJWN','KMQY',
  // Texas
  'KGKY','KHYI','KEDC','KBPT','KBRO','KCLL','KRBD','KADS','KTKI','KDTO','KGRK',
  'KFTW','KFWS','KAFW','KGLS','KGTU','KGPM','KGVT','KEFD','KSGR','KTME','KCXO',
  'KDWH','KLRD','KGGG','KMFE','KHQZ','KBAZ','KSJT','KSKF','KSSF','KGYI','KTYR',
  'KVCT','KACT','KCNW','KSPS',
  // Utah
  'KOGD','KPVU',
  // Virginia
  'KBKT','KCHO','KLYH','KPHF','KHEF',
  // Washington
  'KBLI','KPAE','KMWH','KOLM','KPSC','KRNT','KBFI','KSFF','KTIW','KALW','KYKM',
  // West Virginia
  'KCKB','KHTS','KLWB','KMRB','KMGW','KPKB','KHLG',
  // Wisconsin
  'KATW','KEAU','KJVL','KENW','KLSE','KMWC','KCWA','KOSH','KCMY','KUES',
  // Wyoming
  'KCPR','KCYS','KGUR','KJAC',
  // Alaska
  'KMRI','KLHD','KBET','KFAI','KJNU','KENA','KAKN',
  // Pacific Territories
  'PGUM',
  // Hawaii (towered, not Class B/C)
  'PHTO','PHKO','PHMK',
]);

const CLASS_CONFIG = {
  B: { color: '#38bdf8', radius: 12, fillOpacity: 0.07, weight: 2,   minZoom: 5,  label: 'Class B' },
  C: { color: '#e879f9', radius: 9,  fillOpacity: 0.06, weight: 1.5, minZoom: 7,  label: 'Class C' },
  D: { color: '#818cf8', radius: 7,  fillOpacity: 0.05, weight: 1.5, minZoom: 9,  label: 'Class D' },
};

/**
 * Classify an airport by its FAA airspace class.
 * us_airports.json stores IDs without the K prefix (e.g. "ATL" not "KATL"),
 * so we check both forms against the K-prefixed sets.
 */
export function getAirspaceClass(airport) {
  const id  = airport.id;
  const kid = id.startsWith('K') ? id : 'K' + id;
  if (CLASS_B_SET.has(id) || CLASS_B_SET.has(kid)) return 'B';
  if (CLASS_C_SET.has(id) || CLASS_C_SET.has(kid)) return 'C';
  if (CLASS_D_SET.has(id) || CLASS_D_SET.has(kid)) return 'D';
  return null;
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
