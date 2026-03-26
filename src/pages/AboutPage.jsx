import { Link } from 'react-router-dom';
import { Heart, RefreshCw, Bot, Mail, Shield, Zap } from 'lucide-react';
import FeatureLayout from './FeatureLayout';

const s = {
  hero: { textAlign: 'center', padding: '48px 0 40px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '48px' },
  badge: { display: 'inline-block', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', borderRadius: '999px', padding: '4px 14px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '20px' },
  h1: { fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 800, color: '#f8fafc', margin: '0 0 16px', lineHeight: 1.2, letterSpacing: '-0.5px' },
  lead: { fontSize: '1.05rem', color: '#94a3b8', maxWidth: '580px', margin: '0 auto', lineHeight: 1.65 },
  h2: { fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '10px' },
  section: { marginBottom: '48px' },
  p: { color: '#94a3b8', marginBottom: '14px', fontSize: '0.95rem', lineHeight: 1.7 },
  divider: { height: '1px', background: 'rgba(255,255,255,0.07)', margin: '0 0 48px' },
  freeBox: {
    background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(14,165,233,0.06))',
    border: '1px solid rgba(16,185,129,0.2)',
    borderRadius: '14px',
    padding: '24px 28px',
    marginBottom: '14px',
  },
  freeTitle: { color: '#10b981', fontWeight: 800, fontSize: '1.15rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' },
  pillarGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginTop: '16px' },
  pillarCard: (color) => ({ background: `rgba(${color},0.06)`, border: `1px solid rgba(${color},0.18)`, borderRadius: '12px', padding: '18px 20px' }),
  pillarTitle: (color) => ({ color: `rgb(${color})`, fontWeight: 700, fontSize: '0.88rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '7px' }),
  pillarText: { color: '#64748b', fontSize: '0.82rem', lineHeight: 1.5, margin: 0 },
  agentGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', margin: '16px 0' },
  agentCard: (color) => ({ background: `rgba(${color},0.07)`, border: `1px solid rgba(${color},0.2)`, borderRadius: '10px', padding: '14px 16px' }),
  agentName: (color) => ({ color: `rgb(${color})`, fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }),
  agentDesc: { color: '#64748b', fontSize: '0.8rem', lineHeight: 1.4, margin: 0 },
  contactCard: {
    background: 'rgba(14,165,233,0.07)',
    border: '1px solid rgba(14,165,233,0.2)',
    borderRadius: '14px',
    padding: '24px 28px',
    display: 'flex', gap: '20px', alignItems: 'flex-start',
  },
  avatar: {
    width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 800, fontSize: '1.1rem',
  },
  contactName: { color: '#f1f5f9', fontWeight: 800, fontSize: '1rem', marginBottom: '2px' },
  contactRole: { color: '#64748b', fontSize: '0.8rem', marginBottom: '12px' },
  emailBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '7px',
    background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.3)',
    color: '#38bdf8', borderRadius: '8px', padding: '8px 16px',
    textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600,
    transition: 'background 0.15s',
  },
  useCases: { display: 'flex', flexDirection: 'column', gap: '8px', margin: '14px 0' },
  useCase: { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' },
  useDot: { color: '#38bdf8', fontWeight: 700, fontSize: '0.9rem', marginTop: '1px', flexShrink: 0 },
  useText: { color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 },
  disclaimer: { background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '10px', padding: '14px 18px', marginTop: '48px' },
  disclaimerText: { color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.6, margin: 0, textAlign: 'center' },
  internalLinks: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginTop: '32px' },
  internalLinksTitle: { color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '14px' },
  linkRow: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  inLink: { color: '#38bdf8', textDecoration: 'none', fontSize: '0.875rem', padding: '6px 14px', background: 'rgba(14,165,233,0.08)', borderRadius: '6px', border: '1px solid rgba(14,165,233,0.2)', fontWeight: 500 },
};

export default function AboutPage() {
  return (
    <FeatureLayout
      title="About AeroWindy — Free Aviation Weather Intelligence for Pilots"
      description="AeroWindy is a free real-time aviation weather app built for pilots. Developed by Maninder Singh. Contact manindersinghx@gmail.com for issues or feature requests."
    >
      <div style={s.hero}>
        <div style={s.badge}><Heart size={11} style={{ display: 'inline', marginRight: '4px' }} />Free Forever</div>
        <h1 style={s.h1}>Built for Pilots.<br />Free for Everyone.</h1>
        <p style={s.lead}>
          AeroWindy is a real-time aviation weather intelligence tool — live METAR maps,
          AI hazard detection, TAF timelines, NOTAM decoding, and crosswind calculators —
          all free, all the time, with no account required.
        </p>
      </div>

      {/* Free forever */}
      <section style={s.section}>
        <div style={s.freeBox}>
          <p style={s.freeTitle}><Heart size={16} /> Free Forever — Here's Why</p>
          <p style={{ ...s.p, margin: 0 }}>
            Aviation weather information should be accessible to every pilot regardless of
            budget. Student pilots doing their cross-country prep, weekend VFR flyers checking
            before a morning departure, or instrument pilots scanning the system — everyone
            deserves the same quality of weather intelligence. AeroWindy is free and will
            stay free. No freemium trap, no hidden paywalls.
          </p>
        </div>
        <div style={s.pillarGrid}>
          {[
            { color: '16,185,129', Icon: Shield, title: 'No Account', text: 'Open the app, start flying. No sign-up, no email, no password.' },
            { color: '14,165,233', Icon: Zap, title: 'No Paywall', text: 'Every feature is unlocked. AI agents, NOTAM decoder, TAF timeline — all free.' },
            { color: '139,92,246', Icon: RefreshCw, title: 'Always Updated', text: 'New features ship regularly based on real pilot feedback and requests.' },
          ].map(({ color, Icon, title, text }) => (
            <div key={title} style={s.pillarCard(color)}>
              <p style={s.pillarTitle(color)}><Icon size={13} />{title}</p>
              <p style={s.pillarText}>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <div style={s.divider} />

      {/* What it does */}
      <section style={s.section}>
        <h2 style={s.h2}><Zap size={18} color="#38bdf8" />What AeroWindy Does</h2>
        <p style={s.p}>
          AeroWindy pulls live METAR data from the FAA Aviation Weather Center every 5 minutes
          and presents it on an interactive map across the continental United States. Four
          AI agents powered by Google Gemini analyse that data continuously and surface the
          hazards that matter — so you spend less time decoding raw data and more time
          making good decisions.
        </p>
        <div style={s.useCases}>
          {[
            'Check current winds and crosswind components for any US airport before departure',
            'Scan for wind shear corridors, IFR clusters, and icing zones across your route',
            'Get a plain-English AI pilot briefing summarising current hazards in the system',
            'Decode active NOTAMs at your departure, destination, and alternates',
            'Review the 24-hour TAF timeline with plain-English forecast period summaries',
            'See winds aloft at 6 altitude levels from ground to 18,000 ft across the US',
          ].map(text => (
            <div key={text} style={s.useCase}>
              <span style={s.useDot}>→</span>
              <p style={s.useText}>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <div style={s.divider} />

      {/* AI Agents */}
      <section style={s.section}>
        <h2 style={s.h2}><Bot size={18} color="#38bdf8" />The AI Agents</h2>
        <p style={s.p}>
          Four autonomous agents run after every data cycle. Each is scoped to a specific
          hazard domain so the analysis is focused, not generic.
        </p>
        <div style={s.agentGrid}>
          {[
            { color: '56,189,248', name: 'WindAgent', desc: 'Scans adjacent stations for wind shear corridors — speed differences > 15 kt or direction shifts > 45° within 50 nm.' },
            { color: '252,165,165', name: 'HazardAgent', desc: 'Classifies every station as VFR/MVFR/IFR/LIFR. Flags icing risk (temp −20°C to 0°C + moisture) and fog formation probability.' },
            { color: '253,224,71', name: 'TrendAgent', desc: 'Compares current cycle to the previous cycle. Flags deteriorating conditions, rapidly rising winds, and ceiling collapses.' },
            { color: '134,239,172', name: 'BriefingAgent', desc: 'Takes all agent outputs and calls Google Gemini to synthesise a plain-English pilot situation briefing with severity-rated action items.' },
          ].map(({ color, name, desc }) => (
            <div key={name} style={s.agentCard(color)}>
              <p style={s.agentName(color)}>{name}</p>
              <p style={s.agentDesc}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div style={s.divider} />

      {/* Roadmap */}
      <section style={s.section}>
        <h2 style={s.h2}><RefreshCw size={18} color="#38bdf8" />What's Coming</h2>
        <p style={s.p}>
          AeroWindy is actively developed. The feature roadmap is shaped by what pilots
          actually ask for. Here's what's in the pipeline:
        </p>
        <div style={s.useCases}>
          {[
            'Airport-specific weather pages (e.g. /airport/KSEA) with live data and SEO-indexed forecasts',
            'Pilot weather education blog — how to read METARs, TAFs, NOTAMs, wind shear, and icing',
            'SIGMET and AIRMET polygon overlays on the map',
            'International airport coverage starting with Canada and the Caribbean',
            'Turbulence forecast layer integration (GTG from AWC)',
            'Saved airport favourites (no account — stored locally)',
          ].map(text => (
            <div key={text} style={s.useCase}>
              <span style={{ ...s.useDot, color: '#a78bfa' }}>◆</span>
              <p style={s.useText}>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <div style={s.divider} />

      {/* Contact */}
      <section style={s.section}>
        <h2 style={s.h2}><Mail size={18} color="#38bdf8" />Developer & Contact</h2>
        <p style={s.p}>
          AeroWindy is built and maintained by one developer. Bug reports, feature requests,
          partnership enquiries, and general feedback all go to the same inbox — and are
          read and replied to.
        </p>
        <div style={s.contactCard}>
          <div style={s.avatar}>MS</div>
          <div>
            <p style={s.contactName}>Maninder Singh</p>
            <p style={s.contactRole}>Developer · AeroWindy</p>
            <a href="mailto:manindersinghx@gmail.com" style={s.emailBtn}>
              <Mail size={13} /> manindersinghx@gmail.com
            </a>
            <p style={{ ...s.p, marginTop: '14px', marginBottom: 0 }}>
              Whether it's a bug, a wrong data reading, a UI suggestion, or a feature you'd
              love to see — send an email. Feature requests directly shape what gets built next.
              All messages are welcome.
            </p>
          </div>
        </div>
      </section>

      <div style={s.disclaimer}>
        <p style={s.disclaimerText}>
          <strong style={{ color: '#fca5a5' }}>Not for real-world flight or navigation.</strong>{' '}
          AeroWindy is an experimental demonstration tool. All weather data, AI analyses, runway
          recommendations, and hazard alerts must be verified against official FAA-approved sources
          (AviationWeather.gov, Flight Service, active ATIS/AWOS) before any flight operation.
          The developers disclaim all liability.
        </p>
      </div>

      <div style={s.internalLinks}>
        <p style={s.internalLinksTitle}>Explore Features</p>
        <div style={s.linkRow}>
          <Link to="/features/live-aviation-weather-map" style={s.inLink}>Live Weather Map</Link>
          <Link to="/features/crosswind-calculator" style={s.inLink}>Crosswind Calculator</Link>
          <Link to="/features/ai-hazard-intelligence" style={s.inLink}>AI Hazard Intelligence</Link>
          <Link to="/features/notam-decoder" style={s.inLink}>NOTAM Decoder</Link>
          <a href="/" style={s.inLink}>Open Live App</a>
        </div>
      </div>
    </FeatureLayout>
  );
}
