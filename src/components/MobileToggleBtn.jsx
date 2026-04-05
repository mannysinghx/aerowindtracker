import React from 'react';
import { Menu, X } from 'lucide-react';

export default function MobileToggleBtn({ isMobileMenuOpen, setIsMobileMenuOpen }) {
  return (
    <button
      className="mobile-toggle-btn glass-panel"
      onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      style={{
        position: 'absolute',
        top: '10px',
        right: '12px',
        zIndex: 5000,
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        border: '1px solid var(--panel-border)',
        background: 'rgba(10,17,34,0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        pointerEvents: 'auto',
        color: 'var(--text-primary)',
      }}
    >
      {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
    </button>
  );
}
