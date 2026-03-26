import { useEffect } from 'react';
import { Link } from 'react-router-dom';

const styles = {
  root: {
    fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
    background: '#060d1a',
    color: '#e2e8f0',
    minHeight: '100vh',
    lineHeight: 1.6,
  },
  nav: {
    background: 'rgba(6,13,26,0.95)',
    borderBottom: '1px solid rgba(56,189,248,0.15)',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '56px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backdropFilter: 'blur(12px)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    textDecoration: 'none',
    color: '#f8fafc',
    fontWeight: 700,
    fontSize: '1.1rem',
    letterSpacing: '-0.3px',
  },
  navLinks: {
    display: 'flex',
    gap: '24px',
    alignItems: 'center',
  },
  navLink: {
    color: '#94a3b8',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: 500,
    transition: 'color 0.15s',
  },
  ctaBtn: {
    background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '7px 16px',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'opacity 0.15s',
    display: 'inline-block',
  },
  main: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '48px 24px 80px',
  },
  footer: {
    borderTop: '1px solid rgba(255,255,255,0.07)',
    padding: '32px 24px',
    textAlign: 'center',
    fontSize: '0.8rem',
    color: '#64748b',
  },
  footerLinks: {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    marginBottom: '12px',
    flexWrap: 'wrap',
  },
  footerLink: {
    color: '#64748b',
    textDecoration: 'none',
  },
};

export default function FeatureLayout({ title, description, children }) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) {
      const el = document.querySelector('meta[name="description"]');
      if (el) el.setAttribute('content', description);
    }
  }, [title, description]);

  return (
    <div style={styles.root}>
      <nav style={styles.nav}>
        <a href="/" style={styles.brand}>
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <path d="M16 3L28 26H4L16 3Z" fill="#0ea5e9" stroke="#38bdf8" strokeWidth="1.5" strokeLinejoin="round"/>
            <circle cx="16" cy="19" r="3" fill="#0a1122"/>
          </svg>
          AeroWindy
        </a>
        <div style={styles.navLinks}>
          <Link to="/features/live-aviation-weather-map" style={styles.navLink}>Weather Map</Link>
          <Link to="/features/crosswind-calculator" style={styles.navLink}>Crosswind Calc</Link>
          <Link to="/features/ai-hazard-intelligence" style={styles.navLink}>AI Hazards</Link>
          <Link to="/features/notam-decoder" style={styles.navLink}>NOTAM Decoder</Link>
          <a href="/" style={styles.ctaBtn}>Open Live Map →</a>
        </div>
      </nav>

      <main style={styles.main}>
        {children}
      </main>

      <footer style={styles.footer}>
        <div style={styles.footerLinks}>
          <a href="/" style={styles.footerLink}>Live Weather Map</a>
          <Link to="/features/crosswind-calculator" style={styles.footerLink}>Crosswind Calculator</Link>
          <Link to="/features/live-aviation-weather-map" style={styles.footerLink}>Aviation Weather Map</Link>
          <Link to="/features/ai-hazard-intelligence" style={styles.footerLink}>AI Hazard Intelligence</Link>
          <Link to="/features/notam-decoder" style={styles.footerLink}>NOTAM Decoder</Link>
        </div>
        <p>© 2025 AeroWindy. Free real-time aviation weather for pilots. Not for real-world flight navigation.</p>
      </footer>
    </div>
  );
}
