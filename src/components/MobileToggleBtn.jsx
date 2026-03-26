import React from 'react';
import { Menu, X } from 'lucide-react';

export default function MobileToggleBtn({ isMobileMenuOpen, setIsMobileMenuOpen }) {
  return (
    <button
      className="mobile-toggle-btn glass-panel"
      onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 5000,
        width: '45px',
        height: '45px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        border: '1px solid var(--panel-border)',
        pointerEvents: 'auto',
        color: 'var(--text-primary)',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
      }}
    >
      {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
    </button>
  );
}
