import { Link } from 'react-router-dom';
import FeatureLayout from './FeatureLayout';

const s = {
  hero: {
    textAlign: 'center',
    padding: '48px 0 40px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    marginBottom: '48px',
  },
  badge: {
    display: 'inline-block',
    background: 'rgba(14,165,233,0.12)',
    border: '1px solid rgba(14,165,233,0.3)',
    color: '#38bdf8',
    borderRadius: '999px',
    padding: '4px 14px',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    marginBottom: '20px',
  },
  h1: {
    fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
    fontWeight: 800,
    color: '#f8fafc',
    margin: '0 0 16px',
    lineHeight: 1.2,
    letterSpacing: '-0.5px',
  },
  lead: {
    fontSize: '1.1rem',
    color: '#94a3b8',
    maxWidth: '620px',
    margin: '0 auto 28px',
  },
  ctaBtn: {
    display: 'inline-block',
    background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '10px',
    padding: '13px 28px',
    fontWeight: 700,
    fontSize: '1rem',
    boxShadow: '0 4px 24px rgba(14,165,233,0.35)',
    transition: 'opacity 0.15s',
  },
  h2: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#f8fafc',
    margin: '0 0 16px',
    paddingBottom: '10px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  section: { marginBottom: '48px' },
  p: { color: '#94a3b8', marginBottom: '16px', fontSize: '0.975rem' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    margin: '24px 0',
  },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '20px',
  },
  cardTitle: { color: '#38bdf8', fontWeight: 700, marginBottom: '6px', fontSize: '0.9rem' },
  cardText: { color: '#94a3b8', fontSize: '0.85rem', margin: 0 },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.9rem',
    margin: '16px 0',
  },
  th: {
    background: 'rgba(255,255,255,0.05)',
    color: '#38bdf8',
    padding: '10px 14px',
    textAlign: 'left',
    fontWeight: 700,
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  td: {
    padding: '10px 14px',
    color: '#94a3b8',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  faq: { marginBottom: '24px' },
  faqQ: { color: '#f8fafc', fontWeight: 700, marginBottom: '8px', fontSize: '1rem' },
  faqA: { color: '#94a3b8', fontSize: '0.95rem', margin: 0 },
  formula: {
    background: 'rgba(14,165,233,0.08)',
    border: '1px solid rgba(14,165,233,0.2)',
    borderRadius: '10px',
    padding: '16px 20px',
    fontFamily: 'monospace',
    fontSize: '0.95rem',
    color: '#7dd3fc',
    margin: '16px 0',
  },
  internalLinks: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '24px',
    marginTop: '48px',
  },
  internalLinksTitle: { color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' },
  linkRow: { display: 'flex', flexWrap: 'wrap', gap: '12px' },
  inLink: {
    color: '#38bdf8',
    textDecoration: 'none',
    fontSize: '0.875rem',
    padding: '6px 14px',
    background: 'rgba(14,165,233,0.08)',
    borderRadius: '6px',
    border: '1px solid rgba(14,165,233,0.2)',
    fontWeight: 500,
  },
};

export default function CrosswindCalculatorPage() {
  return (
    <FeatureLayout
      title="Free Crosswind Calculator for Pilots — Real-Time Runway Analysis | AeroWindy"
      description="Free online crosswind calculator for pilots. Enter any US airport ICAO code to instantly see crosswind and headwind components for every runway based on live METAR data."
    >
      <div style={s.hero}>
        <div style={s.badge}>Free Tool · No Account Needed</div>
        <h1 style={s.h1}>Free Crosswind Calculator<br />for Pilots</h1>
        <p style={s.lead}>
          Instant crosswind and headwind components for every runway at any US airport —
          calculated automatically from live METAR data. No manual math required.
        </p>
        <a href="/" style={s.ctaBtn}>Open Live Crosswind Calculator →</a>
      </div>

      <section style={s.section}>
        <h2 style={s.h2}>What Does the Crosswind Calculator Show?</h2>
        <p style={s.p}>
          When you search any US airport by ICAO code (e.g., KSEA, KLAX, KORD), AeroWindy instantly
          computes the crosswind and headwind component for every runway based on the current METAR
          wind direction and speed. The best runway is automatically highlighted so you know which
          direction gives the lightest crosswind and strongest headwind.
        </p>
        <div style={s.grid}>
          <div style={s.card}>
            <p style={s.cardTitle}>Crosswind Component</p>
            <p style={s.cardText}>Wind perpendicular to the runway centerline. Must stay within your aircraft's demonstrated limit.</p>
          </div>
          <div style={s.card}>
            <p style={s.cardTitle}>Headwind Component</p>
            <p style={s.cardText}>Wind directly opposing your takeoff/landing direction. Reduces groundspeed and shortens distances.</p>
          </div>
          <div style={s.card}>
            <p style={s.cardTitle}>Best Runway</p>
            <p style={s.cardText}>Automatically computed from all available runways to minimize crosswind and maximize headwind.</p>
          </div>
          <div style={s.card}>
            <p style={s.cardTitle}>Live METAR Data</p>
            <p style={s.cardText}>Wind data refreshes every 5 minutes directly from the FAA Aviation Weather Center.</p>
          </div>
        </div>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>How to Calculate Crosswind — The Formula</h2>
        <p style={s.p}>
          The crosswind component formula uses basic trigonometry. Given the wind direction, wind speed,
          and runway heading, you calculate the angle between them and apply sine/cosine:
        </p>
        <div style={s.formula}>
          Crosswind component = Wind Speed × sin(Wind Angle)<br />
          Headwind component = Wind Speed × cos(Wind Angle)<br /><br />
          Where Wind Angle = |Wind Direction − Runway Heading|
        </div>
        <p style={s.p}>
          For example: Wind from 270° at 20 knots, landing runway heading 240°. The wind angle is
          30°. Crosswind = 20 × sin(30°) = <strong>10 knots</strong>. Headwind = 20 × cos(30°) = <strong>17 knots</strong>.
          AeroWindy computes this automatically for all runways the moment you search an airport.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Crosswind Limits by Aircraft Type</h2>
        <p style={s.p}>
          Every aircraft has a demonstrated crosswind component listed in its Pilot Operating Handbook (POH)
          or Aircraft Flight Manual (AFM). These are not hard limits — they are the highest crosswind
          tested during certification. Always check your specific POH. Common limits:
        </p>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Aircraft</th>
              <th style={s.th}>Max Demonstrated Crosswind</th>
              <th style={s.th}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Cessna 172 Skyhawk', '15 knots', 'Most common trainer'],
              ['Piper PA-28 Cherokee', '17 knots', 'Popular trainer/traveler'],
              ['Beechcraft Bonanza', '17 knots', 'Common complex aircraft'],
              ['Cirrus SR22', '21 knots', 'Popular modern GA'],
              ['Piper PA-46 Malibu', '20 knots', 'High-performance piston'],
              ['Cessna Citation CJ', '26 knots', 'Light business jet'],
              ['Boeing 737-800', '36 knots', 'Commercial transport'],
            ].map(([ac, limit, note]) => (
              <tr key={ac}>
                <td style={s.td}>{ac}</td>
                <td style={{ ...s.td, color: '#38bdf8', fontWeight: 600 }}>{limit}</td>
                <td style={s.td}>{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={s.p}>
          <strong>Important:</strong> Always verify with your specific aircraft's POH. These figures
          represent the aircraft tested during FAA certification and may differ by serial number,
          modification, or equipment configuration.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Crosswind Landing Technique</h2>
        <p style={s.p}>
          There are two main techniques for crosswind landings. Both require coordinated use of aileron,
          rudder, and appropriate airspeed control:
        </p>
        <div style={s.grid}>
          <div style={s.card}>
            <p style={s.cardTitle}>Wing-Low (Sideslip)</p>
            <p style={s.cardText}>Bank into the wind with opposite rudder to track the centerline. Touch down on the upwind main wheel first. Most common for GA aircraft.</p>
          </div>
          <div style={s.card}>
            <p style={s.cardTitle}>Crab Method</p>
            <p style={s.cardText}>Point the nose into the wind to track the centerline. Kick out the crab just before touchdown with rudder. Common in larger aircraft.</p>
          </div>
        </div>
        <p style={s.p}>
          AeroWindy's <strong>Taxi Wind Deflection</strong> panel shows you exactly which control
          inputs to use for the current wind conditions at your airport, including aileron, rudder,
          and elevator positions for taxiing.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Frequently Asked Questions</h2>
        {[
          {
            q: 'What is a crosswind component?',
            a: "A crosswind component is the portion of wind blowing perpendicular to the runway centerline. It pushes the aircraft sideways during takeoff and landing. A 20-knot wind directly across the runway is a 20-knot crosswind. The same 20 knots at a 30° angle to the runway gives a 10-knot crosswind component."
          },
          {
            q: 'Does AeroWindy show crosswind for all runways?',
            a: "Yes. AeroWindy calculates crosswind and headwind components for every runway at the searched airport simultaneously, using live METAR data. It highlights the best runway based on minimum crosswind component."
          },
          {
            q: 'How often does the wind data update?',
            a: "METAR data refreshes every 5 minutes from the FAA Aviation Weather Center API. The crosswind calculation updates automatically after each data cycle."
          },
          {
            q: 'Can I use AeroWindy for flight planning?',
            a: "AeroWindy is a demonstration tool — not an official flight planning resource. Always verify wind data against official sources (ATIS, AWOS, AviationWeather.gov) before flight. See the disclaimer on the app."
          },
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
          <Link to="/features/ai-hazard-intelligence" style={s.inLink}>AI Hazard Intelligence</Link>
          <Link to="/features/notam-decoder" style={s.inLink}>NOTAM Decoder</Link>
          <a href="/" style={s.inLink}>Open Live App</a>
        </div>
      </div>
    </FeatureLayout>
  );
}
