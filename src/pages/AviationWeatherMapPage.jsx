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
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', margin: '24px 0' },
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' },
  cardTitle: { color: '#38bdf8', fontWeight: 700, marginBottom: '6px', fontSize: '0.9rem' },
  cardText: { color: '#94a3b8', fontSize: '0.85rem', margin: 0 },
  altGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', margin: '16px 0' },
  altCard: { background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' },
  altLabel: { color: '#38bdf8', fontWeight: 700, fontSize: '0.9rem', display: 'block' },
  altSub: { color: '#64748b', fontSize: '0.78rem' },
  colorRow: { display: 'flex', flexDirection: 'column', gap: '8px', margin: '16px 0' },
  colorItem: { display: 'flex', alignItems: 'center', gap: '12px' },
  dot: (c) => ({ width: '14px', height: '14px', borderRadius: '50%', background: c, flexShrink: 0 }),
  colorLabel: { color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 600, minWidth: '80px' },
  colorDesc: { color: '#64748b', fontSize: '0.85rem' },
  faq: { marginBottom: '24px' },
  faqQ: { color: '#f8fafc', fontWeight: 700, marginBottom: '8px', fontSize: '1rem' },
  faqA: { color: '#94a3b8', fontSize: '0.95rem', margin: 0 },
  internalLinks: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginTop: '48px' },
  internalLinksTitle: { color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' },
  linkRow: { display: 'flex', flexWrap: 'wrap', gap: '12px' },
  inLink: { color: '#38bdf8', textDecoration: 'none', fontSize: '0.875rem', padding: '6px 14px', background: 'rgba(14,165,233,0.08)', borderRadius: '6px', border: '1px solid rgba(14,165,233,0.2)', fontWeight: 500 },
};

const altitudeLayers = [
  { label: 'Ground', sub: 'Surface METARs', },
  { label: '3,000 ft', sub: 'Low altitude', },
  { label: '6,000 ft', sub: 'Transition', },
  { label: '9,000 ft', sub: 'Low cruise', },
  { label: '12,000 ft', sub: 'Mid cruise', },
  { label: '18,000 ft', sub: 'Class A floor', },
];

const windColors = [
  { color: '#10b981', label: 'Green', desc: 'Calm — < 5 knots' },
  { color: '#3b82f6', label: 'Blue', desc: 'Light — 5–14 knots' },
  { color: '#f59e0b', label: 'Amber', desc: 'Moderate — 15–24 knots' },
  { color: '#ef4444', label: 'Red', desc: 'Strong — 25–39 knots' },
  { color: '#8b5cf6', label: 'Purple', desc: 'Severe — 40+ knots' },
];

export default function AviationWeatherMapPage() {
  return (
    <FeatureLayout
      title="Live Aviation Weather Map for US Pilots — Real-Time METAR Wind Data | AeroWindy"
      description="Interactive real-time aviation weather map for US pilots. Live METAR wind barbs, radar overlays, 6 altitude layers from ground to 18,000 ft. Free with no account required."
    >
      <div style={s.hero}>
        <div style={s.badge}>Updated Every 5 Minutes</div>
        <h1 style={s.h1}>Live Aviation Weather Map<br />for US Pilots</h1>
        <p style={s.lead}>
          Every METAR-reporting airport in the US on one interactive map.
          Wind barbs, radar, altitude layers, and AI hazard overlays — updated every 5 minutes.
        </p>
        <a href="/" style={s.ctaBtn}>Open Live Weather Map →</a>
      </div>

      <section style={s.section}>
        <h2 style={s.h2}>What Data Does AeroWindy Display?</h2>
        <p style={s.p}>
          AeroWindy pulls live data from the FAA Aviation Weather Center (AWC) METAR API every 5 minutes.
          Each wind barb on the map represents one METAR-reporting station and shows the current wind direction,
          wind speed, temperature, dewpoint, and visibility. Click any station to see full decoded METAR details.
        </p>
        <div style={s.grid}>
          {[
            ['METAR Winds', 'Live direction and speed from every reporting station. Updates every 5 minutes.'],
            ['Radar Overlay', 'RainViewer live precipitation tiles. Toggle on/off with opacity control.'],
            ['Satellite IR', 'NASA GIBS GOES East infrared cloud imagery.'],
            ['PIREP Icing', 'Pilot-reported icing from AWC filtered by altitude band.'],
            ['PIREP Turbulence', 'Pilot-reported turbulence overlaid by severity and altitude.'],
            ['SIGMETs', 'Active SIGMET polygon overlays from the AWC GeoJSON API.'],
            ['AI Hazard Alerts', 'Wind shear corridors, IFR clusters, icing zones detected by AI agents.'],
            ['Winds Aloft', 'Upper-air forecast winds from GFS model at 6 altitude levels.'],
          ].map(([title, desc]) => (
            <div style={s.card} key={title}>
              <p style={s.cardTitle}>{title}</p>
              <p style={s.cardText}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Altitude Layers — Ground to FL180</h2>
        <p style={s.p}>
          Switch between 6 altitude layers to see how winds change with height. The ground layer shows
          surface METAR data. Layers above ground show winds aloft from the GFS model, giving you the
          full picture from taxiing to cruise.
        </p>
        <div style={s.altGrid}>
          {altitudeLayers.map(({ label, sub }) => (
            <div style={s.altCard} key={label}>
              <span style={s.altLabel}>{label}</span>
              <span style={s.altSub}>{sub}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Wind Speed Color Coding</h2>
        <p style={s.p}>
          Wind barb colors give you an instant visual read of wind intensity across the entire map.
          Scan for red or purple markers before your route to identify high-wind corridors quickly.
        </p>
        <div style={s.colorRow}>
          {windColors.map(({ color, label, desc }) => (
            <div style={s.colorItem} key={label}>
              <div style={s.dot(color)} />
              <span style={s.colorLabel}>{label}</span>
              <span style={s.colorDesc}>{desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Map Styles — Dark, Light, Hybrid, Terrain</h2>
        <p style={s.p}>
          AeroWindy offers four map base layers. The Dark theme (CartoDB Dark Matter) is optimized for
          night flying and dim-light environments. The Terrain style (Google Maps Terrain) is ideal for
          VFR planning in mountainous terrain where orographic lift and mountain wave turbulence
          are concerns. Hybrid mode shows satellite imagery with labels.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Frequently Asked Questions</h2>
        {[
          { q: 'How often does the weather data update?', a: "METAR data refreshes every 5 minutes from the FAA Aviation Weather Center API. Winds aloft data updates every hour from the GFS model. The AI hazard analysis runs after each METAR cycle." },
          { q: 'Does AeroWindy work on mobile?', a: "Yes. AeroWindy is a Progressive Web App (PWA) and works on any modern browser — desktop, tablet, or mobile. On iOS Safari and Android Chrome, you can add it to your home screen for full-screen app behavior." },
          { q: 'What airports are covered?', a: "All METAR-reporting airports in the continental United States — from major international airports to small general aviation fields. Canadian and Caribbean airports near the US border may also appear depending on AWC feed coverage." },
          { q: 'What is a wind barb?', a: "A wind barb is a standard meteorological symbol showing wind direction and speed. The line points in the direction the wind is blowing FROM. Barbs (small lines) on the tail indicate speed: one full barb = 10 knots, one half barb = 5 knots. AeroWindy shows wind direction as an arrow and uses color for speed intensity." },
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
          <Link to="/features/crosswind-calculator" style={s.inLink}>Crosswind Calculator</Link>
          <Link to="/features/ai-hazard-intelligence" style={s.inLink}>AI Hazard Intelligence</Link>
          <Link to="/features/notam-decoder" style={s.inLink}>NOTAM Decoder</Link>
          <a href="/" style={s.inLink}>Open Live App</a>
        </div>
      </div>
    </FeatureLayout>
  );
}
