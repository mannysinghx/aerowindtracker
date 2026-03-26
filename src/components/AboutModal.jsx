import { X, Mail, Wind, Bot, Zap, RefreshCw, Heart } from 'lucide-react';

export default function AboutModal({ onClose, theme }) {
  const isDark = theme === 'dark';

  const overlay = {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '16px',
  };

  const modal = {
    background: isDark ? '#0d1828' : '#f8fafc',
    border: `1px solid ${isDark ? 'rgba(56,189,248,0.2)' : 'rgba(37,99,235,0.15)'}`,
    borderRadius: '16px',
    width: '100%',
    maxWidth: '520px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
    position: 'relative',
  };

  const header = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
  };

  const body = { padding: '20px 24px 24px' };

  const section = { marginBottom: '22px' };

  const sectionTitle = {
    fontSize: '0.68rem', fontWeight: 800, letterSpacing: '1.2px',
    textTransform: 'uppercase', color: 'var(--accent-color)',
    marginBottom: '10px',
  };

  const text = {
    fontSize: '0.875rem', color: isDark ? '#94a3b8' : '#475569',
    lineHeight: 1.65, margin: 0,
  };

  const agentGrid = {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px',
  };

  const agentCard = (color) => ({
    background: isDark ? `rgba(${color},0.07)` : `rgba(${color},0.06)`,
    border: `1px solid rgba(${color},0.2)`,
    borderRadius: '10px',
    padding: '12px 14px',
  });

  const agentName = (color) => ({
    color: `rgb(${color})`, fontWeight: 700, fontSize: '0.82rem', marginBottom: '3px',
  });

  const agentDesc = {
    color: isDark ? '#64748b' : '#94a3b8', fontSize: '0.78rem', lineHeight: 1.4, margin: 0,
  };

  const freeBadge = {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
    color: '#10b981', borderRadius: '8px', padding: '8px 14px',
    fontSize: '0.82rem', fontWeight: 700, marginBottom: '10px',
  };

  const contactBox = {
    background: isDark ? 'rgba(14,165,233,0.07)' : 'rgba(14,165,233,0.05)',
    border: `1px solid ${isDark ? 'rgba(14,165,233,0.2)' : 'rgba(14,165,233,0.15)'}`,
    borderRadius: '10px',
    padding: '14px 16px',
    display: 'flex', alignItems: 'flex-start', gap: '12px',
  };

  const contactInfo = { flex: 1 };

  const contactName = {
    color: isDark ? '#f1f5f9' : '#0f172a', fontWeight: 700,
    fontSize: '0.9rem', marginBottom: '2px',
  };

  const contactEmail = {
    color: 'var(--accent-color)', fontSize: '0.82rem',
    textDecoration: 'none', fontWeight: 500,
  };

  const divider = {
    height: '1px',
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
    margin: '0 0 22px',
  };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Wind size={18} color="var(--accent-color)" />
            <span style={{ fontWeight: 800, fontSize: '1rem', color: isDark ? '#f8fafc' : '#0f172a' }}>
              About AeroWindy
            </span>
            <span style={{
              background: '#ef4444', color: '#fff',
              padding: '1px 6px', borderRadius: '4px',
              fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.8px',
            }}>BETA</span>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: isDark ? '#64748b' : '#94a3b8', padding: '4px', borderRadius: '6px',
            display: 'flex', alignItems: 'center',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={body}>

          {/* Free forever */}
          <div style={section}>
            <div style={freeBadge}>
              <Heart size={13} /> Free Forever — No Account Required
            </div>
            <p style={text}>
              AeroWindy is completely free to use. No subscription, no login, no paywall.
              Every feature — live METAR maps, AI hazard intelligence, TAF timelines, NOTAM
              decoding, crosswind calculator, and the Pilot Copilot chatbot — is available
              to every pilot at no cost. That's the plan, and we're sticking to it.
            </p>
          </div>

          <div style={divider} />

          {/* Continuously updated */}
          <div style={section}>
            <p style={sectionTitle}><RefreshCw size={10} style={{ display: 'inline', marginRight: '4px' }} />Continuously Updated</p>
            <p style={text}>
              AeroWindy is actively developed. New features, data sources, and AI capabilities
              are added regularly. Upcoming improvements include airport-specific weather pages,
              a blog with pilot weather education, SIGMET/AIRMET overlays, international
              airport coverage, and deeper AI agent analysis. If there's something you want,
              tell us — feature requests directly shape the roadmap.
            </p>
          </div>

          <div style={divider} />

          {/* AI Agents */}
          <div style={section}>
            <p style={sectionTitle}><Bot size={10} style={{ display: 'inline', marginRight: '4px' }} />Powered by AI Agents</p>
            <p style={{ ...text, marginBottom: '10px' }}>
              AeroWindy runs four autonomous AI agents powered by Google Gemini. They analyse
              live METAR data every 5 minutes and brief you on hazards in plain English —
              no raw data decoding required.
            </p>
            <div style={agentGrid}>
              {[
                { color: '56,189,248', name: 'WindAgent', desc: 'Wind shear corridors & mountain wave detection' },
                { color: '252,165,165', name: 'HazardAgent', desc: 'IFR clusters, icing zones & fog risk' },
                { color: '253,224,71', name: 'TrendAgent', desc: 'Rapid weather change monitoring' },
                { color: '134,239,172', name: 'BriefingAgent', desc: 'Plain-English pilot situation brief' },
              ].map(({ color, name, desc }) => (
                <div key={name} style={agentCard(color)}>
                  <p style={agentName(color)}>{name}</p>
                  <p style={agentDesc}>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={divider} />

          {/* Developer */}
          <div style={section}>
            <p style={sectionTitle}><Mail size={10} style={{ display: 'inline', marginRight: '4px' }} />Developer & Contact</p>
            <div style={contactBox}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800, fontSize: '0.95rem',
              }}>MS</div>
              <div style={contactInfo}>
                <p style={contactName}>Maninder Singh</p>
                <a href="mailto:manindersinghx@gmail.com" style={contactEmail}>
                  manindersinghx@gmail.com
                </a>
                <p style={{ ...text, marginTop: '8px' }}>
                  Reach out for bug reports, feature requests, partnership inquiries,
                  or just to say hi. All messages are read and replied to.
                </p>
              </div>
            </div>
          </div>

          {/* Disclaimer note */}
          <p style={{ ...text, fontSize: '0.75rem', color: isDark ? '#475569' : '#94a3b8', textAlign: 'center', marginTop: '4px' }}>
            AeroWindy is an experimental tool. Not for real-world flight or navigation.
            Always verify conditions through official FAA-approved sources before flight.
          </p>
        </div>
      </div>
    </div>
  );
}
