import { Link } from 'react-router-dom';
import FeatureLayout from './FeatureLayout';

const s = {
  hero: { textAlign: 'center', padding: '48px 0 40px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '48px' },
  badge: { display: 'inline-block', background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.3)', color: '#38bdf8', borderRadius: '999px', padding: '4px 14px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '20px' },
  h1: { fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 800, color: '#f8fafc', margin: '0 0 16px', lineHeight: 1.2, letterSpacing: '-0.5px' },
  lead: { fontSize: '1.1rem', color: '#94a3b8', maxWidth: '620px', margin: '0 auto 28px' },
  ctaBtn: { display: 'inline-block', background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: '#fff', textDecoration: 'none', borderRadius: '10px', padding: '13px 28px', fontWeight: 700, fontSize: '1rem', boxShadow: '0 4px 24px rgba(14,165,233,0.35)' },
  h2: { fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 16px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  section: { marginBottom: '48px' },
  p: { color: '#94a3b8', marginBottom: '16px', fontSize: '0.975rem' },
  example: { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '16px 20px', margin: '16px 0' },
  exRaw: { fontFamily: 'monospace', fontSize: '0.85rem', color: '#fbbf24', marginBottom: '12px', wordBreak: 'break-all' },
  exDecoded: { color: '#10b981', fontSize: '0.9rem', fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', margin: '24px 0' },
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' },
  cardTitle: { color: '#38bdf8', fontWeight: 700, marginBottom: '6px', fontSize: '0.9rem' },
  cardText: { color: '#94a3b8', fontSize: '0.85rem', margin: 0 },
  typeList: { listStyle: 'none', padding: 0, margin: '16px 0' },
  typeItem: { display: 'flex', gap: '16px', marginBottom: '12px', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', alignItems: 'flex-start' },
  typeCode: { color: '#38bdf8', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', minWidth: '80px', paddingTop: '2px' },
  typeDesc: { color: '#94a3b8', fontSize: '0.875rem' },
  faq: { marginBottom: '24px' },
  faqQ: { color: '#f8fafc', fontWeight: 700, marginBottom: '8px', fontSize: '1rem' },
  faqA: { color: '#94a3b8', fontSize: '0.95rem', margin: 0 },
  internalLinks: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginTop: '48px' },
  internalLinksTitle: { color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' },
  linkRow: { display: 'flex', flexWrap: 'wrap', gap: '12px' },
  inLink: { color: '#38bdf8', textDecoration: 'none', fontSize: '0.875rem', padding: '6px 14px', background: 'rgba(14,165,233,0.08)', borderRadius: '6px', border: '1px solid rgba(14,165,233,0.2)', fontWeight: 500 },
};

export default function NotamDecoderPage() {
  return (
    <FeatureLayout
      title="Free NOTAM Decoder for Pilots — Plain-English NOTAM Summaries | AeroWindy"
      description="Free AI-powered NOTAM decoder for pilots. Search any US airport ICAO code to get active NOTAMs decoded into plain English — no cryptic abbreviations. Free, no account required."
    >
      <div style={s.hero}>
        <div style={s.badge}>AI-Powered Plain-English Decode</div>
        <h1 style={s.h1}>Free NOTAM Decoder<br />for Pilots</h1>
        <p style={s.lead}>
          Stop wading through cryptic NOTAM shorthand. Search any US airport by ICAO code to get
          all active NOTAMs instantly decoded into plain English by AI — so you can focus on
          what matters for your flight.
        </p>
        <a href="/" style={s.ctaBtn}>Decode NOTAMs for Your Airport →</a>
      </div>

      <section style={s.section}>
        <h2 style={s.h2}>NOTAM Raw vs. Plain English — Examples</h2>
        <p style={s.p}>
          Raw NOTAMs are written in a compressed shorthand format designed for data transmission
          efficiency, not human readability. AeroWindy uses AI to translate every NOTAM into a
          plain-English one-sentence summary:
        </p>
        {[
          {
            raw: '!SEA 03/012 SEA RWY 16L/34R CLSD EXC PPR 2503151400-2503160600',
            decoded: '✓ Runway 16L/34R at Seattle-Tacoma (KSEA) is closed except by prior permission required, from March 15 14:00 UTC to March 16 06:00 UTC.',
          },
          {
            raw: '!FDC 5/2197 ZLA NV..AIRSPACE RENO NV TO WINNEMUCCA NV 119.7 EMRG AUTH REQ BTN SFC AND 18000FT',
            decoded: '✓ Temporary Flight Restriction active over central Nevada between Reno and Winnemucca — contact 119.7 for emergency authorization. Surface to 18,000 ft.',
          },
          {
            raw: '!LAX 03/044 LAX OBST CRANE (ASN 2025-AWP-1234-OE) 340DEG 0.8NM FM LAX ARP 94FT (47FT AGL) FLAGGED AND LGTD',
            decoded: '✓ Crane obstruction 0.8nm north-northwest of KLAX airport at 94 ft MSL (47 ft AGL) — flagged and lighted.',
          },
        ].map(({ raw, decoded }) => (
          <div style={s.example} key={raw.slice(0, 20)}>
            <p style={s.exRaw}>{raw}</p>
            <p style={s.exDecoded}>{decoded}</p>
          </div>
        ))}
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Types of NOTAMs AeroWindy Decodes</h2>
        <ul style={s.typeList}>
          {[
            { code: 'RWY', desc: 'Runway closures, partial closures, surface conditions, displaced thresholds, and arresting gear status.' },
            { code: 'TWY', desc: 'Taxiway closures, restricted segments, surface markings, and lighting outages.' },
            { code: 'OBST', desc: 'New construction cranes, towers, and other temporary obstacles near airports or in approach paths.' },
            { code: 'NAV', desc: 'VOR, ILS, NDB, and GPS RAIM outages and restrictions affecting instrument approach procedures.' },
            { code: 'SVC', desc: 'Airport service interruptions — ATIS, control tower hours, fuel availability, and customs/immigration changes.' },
            { code: 'AIRSPACE', desc: 'Temporary Flight Restrictions (TFRs), Special Use Airspace activations, NOTAM-D airspace notices.' },
            { code: 'PAPI/VASI', desc: 'Visual approach slope indicator outages affecting night VFR and non-precision approach operations.' },
            { code: 'PARACHUTE', desc: 'Active parachute jump operations within airport airspace or approach corridors.' },
          ].map(({ code, desc }) => (
            <li style={s.typeItem} key={code}>
              <span style={s.typeCode}>{code}</span>
              <span style={s.typeDesc}>{desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Why NOTAMs Matter for Every Flight</h2>
        <p style={s.p}>
          Under FAR 91.103, the Pilot in Command must familiarise themselves with all available
          information prior to any flight — including applicable NOTAMs. Failure to check NOTAMs
          has contributed to runway incursions, airspace violations, and fatal accidents.
        </p>
        <div style={s.grid}>
          {[
            ['Runway Closures', 'A closed runway that appears open on charts has caused numerous ground incidents and aborted takeoffs.'],
            ['ILS Outages', 'An IFR approach to a runway with a NOTAM-flagged ILS outage can result in a missed approach at minimums.'],
            ['TFR Violations', 'Temporary Flight Restrictions around VIP movements and disaster areas can result in certificate action and prosecution.'],
            ['Obstruction Hazards', 'Construction cranes can appear overnight and exceed charted obstacle heights before sectional updates.'],
          ].map(([title, desc]) => (
            <div style={s.card} key={title}>
              <p style={s.cardTitle}>{title}</p>
              <p style={s.cardText}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>How AeroWindy Fetches and Decodes NOTAMs</h2>
        <p style={s.p}>
          When you search an airport in AeroWindy, the NOTAM panel automatically fetches all active
          NOTAMs for that facility from the FAA NOTAM system. Each raw NOTAM is sent to the AI
          engine which returns a concise plain-English summary along with the effective time window
          converted to local time at the airport.
        </p>
        <p style={s.p}>
          The local time conversion uses the airport's geographic coordinates to determine the
          correct timezone, so you always see NOTAM effective times in the local time you'd see
          on a plate or chart — not just UTC.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Frequently Asked Questions</h2>
        {[
          { q: 'What is a NOTAM?', a: "A NOTAM (Notice to Air Missions) is an official notice distributed to pilots containing information essential to safe flight — runway closures, navaid outages, airspace restrictions, crane hazards, and more. The FAA issues thousands of NOTAMs every day across the US." },
          { q: 'Are AeroWindy NOTAMs official?', a: "AeroWindy fetches NOTAMs from the FAA NOTAM system, but this tool should not be used as your sole preflight NOTAM source. Always verify critical NOTAMs through official FAA NOTAM systems, 1800wxbrief.com, or by calling Flight Service before flight." },
          { q: 'How many NOTAMs are active at a typical airport?', a: "A major airport like KLAX or KJFK may have 50-100 active NOTAMs at any given time. Small GA airports typically have 5-20. AeroWindy fetches all active NOTAMs and uses AI to surface the most operationally significant ones first." },
          { q: 'What does NOTAM local time conversion mean?', a: "Raw NOTAMs use UTC timestamps (e.g., 2503151400 = March 15, 2025 14:00 UTC). AeroWindy automatically converts these to the local timezone at the searched airport so you can see effective times in the same timezone as the airport's ATIS and approach plates." },
        ].map(({ q, a }) => (
          <div style={s.faq} key={q}>
            <p style={s.faqQ}>{q}</p>
            <p style={s.faqA}>{a}</p>
          </div>
        ))}
      </section>

      <div style={s.internalLinks}>
        <p style={s.internalLinksTitle}>Related Features</p>
        <div style={s.linkRow}>
          <Link to="/features/live-aviation-weather-map" style={s.inLink}>Live Aviation Weather Map</Link>
          <Link to="/features/crosswind-calculator" style={s.inLink}>Crosswind Calculator</Link>
          <Link to="/features/ai-hazard-intelligence" style={s.inLink}>AI Hazard Intelligence</Link>
          <a href="/" style={s.inLink}>Open Live App</a>
        </div>
      </div>
    </FeatureLayout>
  );
}
