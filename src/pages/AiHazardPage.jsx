import { Link } from 'react-router-dom';
import FeatureLayout from './FeatureLayout';

const s = {
  hero: { textAlign: 'center', padding: '48px 0 40px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '48px' },
  badge: { display: 'inline-block', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', borderRadius: '999px', padding: '4px 14px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '20px' },
  h1: { fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 800, color: '#f8fafc', margin: '0 0 16px', lineHeight: 1.2, letterSpacing: '-0.5px' },
  lead: { fontSize: '1.1rem', color: '#94a3b8', maxWidth: '640px', margin: '0 auto 28px' },
  ctaBtn: { display: 'inline-block', background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: '#fff', textDecoration: 'none', borderRadius: '10px', padding: '13px 28px', fontWeight: 700, fontSize: '1rem', boxShadow: '0 4px 24px rgba(14,165,233,0.35)' },
  h2: { fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 16px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  section: { marginBottom: '48px' },
  p: { color: '#94a3b8', marginBottom: '16px', fontSize: '0.975rem' },
  agentGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', margin: '24px 0' },
  agentCard: (color) => ({ background: `rgba(${color},0.06)`, border: `1px solid rgba(${color},0.2)`, borderRadius: '12px', padding: '20px' }),
  agentIcon: { fontSize: '1.5rem', marginBottom: '10px' },
  agentName: (color) => ({ color: `rgb(${color})`, fontWeight: 700, marginBottom: '6px', fontSize: '1rem' }),
  agentDesc: { color: '#94a3b8', fontSize: '0.85rem', margin: 0 },
  hazardList: { listStyle: 'none', padding: 0, margin: '16px 0' },
  hazardItem: { display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' },
  hazardDot: (c) => ({ width: '10px', height: '10px', borderRadius: '50%', background: c, marginTop: '5px', flexShrink: 0 }),
  hazardContent: {},
  hazardTitle: { color: '#f8fafc', fontWeight: 700, marginBottom: '4px', fontSize: '0.9rem' },
  hazardText: { color: '#64748b', fontSize: '0.85rem', margin: 0 },
  pipeline: { display: 'flex', flexDirection: 'column', gap: '12px', margin: '20px 0' },
  step: { display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 18px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' },
  stepNum: { width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 },
  stepText: { color: '#94a3b8', fontSize: '0.9rem' },
  faq: { marginBottom: '24px' },
  faqQ: { color: '#f8fafc', fontWeight: 700, marginBottom: '8px', fontSize: '1rem' },
  faqA: { color: '#94a3b8', fontSize: '0.95rem', margin: 0 },
  internalLinks: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginTop: '48px' },
  internalLinksTitle: { color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' },
  linkRow: { display: 'flex', flexWrap: 'wrap', gap: '12px' },
  inLink: { color: '#38bdf8', textDecoration: 'none', fontSize: '0.875rem', padding: '6px 14px', background: 'rgba(14,165,233,0.08)', borderRadius: '6px', border: '1px solid rgba(14,165,233,0.2)', fontWeight: 500 },
};

export default function AiHazardPage() {
  return (
    <FeatureLayout
      title="AI Aviation Hazard Intelligence — Automated Wind Shear & IFR Detection | AeroWindy"
      description="AeroWindy's AI agents automatically detect wind shear corridors, IFR clusters, structural icing zones, and fog formation risk from live METAR data. Updated every 5 minutes."
    >
      <div style={s.hero}>
        <div style={s.badge}>Powered by Google Gemini AI</div>
        <h1 style={s.h1}>AI Aviation Hazard<br />Intelligence</h1>
        <p style={s.lead}>
          Four autonomous AI agents run continuously on live METAR data, detecting patterns
          that take pilots minutes to spot manually — and briefing you in plain English
          in seconds.
        </p>
        <a href="/" style={s.ctaBtn}>View Live AI Hazard Alerts →</a>
      </div>

      <section style={s.section}>
        <h2 style={s.h2}>The Four AI Agents</h2>
        <p style={s.p}>
          AeroWindy runs four specialized AI agents powered by Google Gemini. Each agent monitors
          a specific hazard category and runs automatically after every METAR data refresh cycle —
          every 5 minutes.
        </p>
        <div style={s.agentGrid}>
          <div style={s.agentCard('14,165,233')}>
            <div style={s.agentIcon}>💨</div>
            <p style={s.agentName('56,189,248')}>WindAgent</p>
            <p style={s.agentDesc}>Detects wind shear corridors where adjacent stations show speed differences {'>'} 15 knots or direction shifts {'>'} 45° within 50nm.</p>
          </div>
          <div style={s.agentCard('239,68,68')}>
            <div style={s.agentIcon}>⚠️</div>
            <p style={s.agentName('252,165,165')}>HazardAgent</p>
            <p style={s.agentDesc}>Identifies IFR clusters (ceiling {'<'} 1,000 ft or visibility {'<'} 3 mi), structural icing zones, and fog formation risk areas.</p>
          </div>
          <div style={s.agentCard('251,191,36')}>
            <div style={s.agentIcon}>📈</div>
            <p style={s.agentName('253,224,71')}>TrendAgent</p>
            <p style={s.agentDesc}>Monitors rapid weather changes between data cycles — deteriorating conditions, rising winds, and ceiling collapses.</p>
          </div>
          <div style={s.agentCard('34,197,94')}>
            <div style={s.agentIcon}>📋</div>
            <p style={s.agentName('134,239,172')}>BriefingAgent</p>
            <p style={s.agentDesc}>Synthesizes all agent findings into a pilot-oriented plain-English situation briefing with prioritized action items.</p>
          </div>
        </div>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Hazards Detected Automatically</h2>
        <ul style={s.hazardList}>
          {[
            { color: '#ef4444', title: 'Wind Shear Corridors', text: 'Boundaries where wind speed or direction changes dramatically over short distances. Critical for departure and arrival phases of flight.' },
            { color: '#8b5cf6', title: 'Structural Icing Zones', text: 'Areas where temperature is between -20°C and 0°C with visible moisture present — conditions favorable for in-flight ice accretion.' },
            { color: '#f59e0b', title: 'IFR Cluster Areas', text: 'Geographic clusters of airports reporting ceiling below 1,000 ft or visibility below 3 miles, indicating widespread instrument conditions.' },
            { color: '#06b6d4', title: 'Fog Formation Risk', text: 'Airports where temperature-dewpoint spread is within 3°C and winds are calm — high probability of fog formation, especially at night.' },
            { color: '#10b981', title: 'Severe Wind Events', text: 'Stations reporting sustained winds above 25 knots or gusts above 35 knots, flagged for potential SIGMET issuance.' },
            { color: '#3b82f6', title: 'Mountain Wave Risk', text: 'When strong upper winds cross perpendicular to mountain ranges, flagged for severe turbulence and rotor risk in lee-wave areas.' },
          ].map(({ color, title, text }) => (
            <li style={s.hazardItem} key={title}>
              <div style={s.hazardDot(color)} />
              <div style={s.hazardContent}>
                <p style={s.hazardTitle}>{title}</p>
                <p style={s.hazardText}>{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>How the AI Analysis Pipeline Works</h2>
        <div style={s.pipeline}>
          {[
            'FAA AWC METAR API returns fresh data for all US stations (every 5 min)',
            'Raw METAR observations decoded into structured JSON (wind, temp, dewpoint, ceiling, visibility)',
            'WindAgent scans all station pairs within 50nm for wind shear signatures',
            'HazardAgent classifies each station: IFR/MVFR/VFR, icing risk level, fog probability',
            'TrendAgent compares current cycle to previous cycle to detect rapid changes',
            'BriefingAgent aggregates all findings and calls Google Gemini to write a plain-English pilot brief',
            'Results are cached and served to the AeroWindy map with severity-rated alert cards',
          ].map((text, i) => (
            <div style={s.step} key={i}>
              <div style={s.stepNum}>{i + 1}</div>
              <span style={s.stepText}>{text}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Frequently Asked Questions</h2>
        {[
          { q: 'How accurate is the AI hazard detection?', a: "The AI agents analyze the same raw METAR data that human meteorologists and dispatchers use. The detection logic is based on established aviation meteorology thresholds — not guesses. However, AeroWindy is a demonstration tool and should never replace official weather briefings from licensed meteorologists or the FAA." },
          { q: 'What is wind shear and why is it dangerous?', a: "Wind shear is a rapid change in wind speed or direction over a short distance. On approach or departure, encountering unexpected wind shear can cause sudden airspeed loss that is difficult to recover from, especially at low altitude. The FAA cites wind shear as a contributing factor in numerous fatal accidents, including the 1985 Delta 191 crash at Dallas/Fort Worth." },
          { q: 'What counts as IFR conditions?', a: "Instrument Flight Rules (IFR) conditions are defined as ceiling below 1,000 feet AGL or visibility below 3 statute miles. LIFR (Low IFR) is ceiling below 500 ft or visibility below 1 mile. AeroWindy's HazardAgent flags all IFR and LIFR airports and identifies geographic clusters that indicate widespread instrument conditions." },
          { q: 'Can the AI brief me about a specific airport?', a: "Yes. AeroWindy includes an interactive Pilot Copilot chatbot you can ask specific questions about current conditions, hazards, or weather at any airport you've searched. The chatbot is powered by Google Gemini and has access to the live weather data." },
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
          <Link to="/features/notam-decoder" style={s.inLink}>NOTAM Decoder</Link>
          <a href="/" style={s.inLink}>Open Live App</a>
        </div>
      </div>
    </FeatureLayout>
  );
}
