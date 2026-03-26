import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const PAGE_CONFIG = {
  'crosswind-calculator': {
    title: 'Crosswind Calculator',
    subtitle: 'Real-time crosswind & headwind components\nfor every US airport runway',
    accent: '#38bdf8',
    icon: '🛬',
  },
  'aviation-weather-map': {
    title: 'Live Aviation Weather Map',
    subtitle: 'Real-time METAR wind barbs, radar &\n6 altitude layers across the US',
    accent: '#3b82f6',
    icon: '🗺️',
  },
  'ai-hazard-intelligence': {
    title: 'AI Hazard Intelligence',
    subtitle: 'Automated wind shear, IFR cluster\nand icing detection via AI agents',
    accent: '#fbbf24',
    icon: '🤖',
  },
  'notam-decoder': {
    title: 'NOTAM Decoder',
    subtitle: 'Active NOTAMs decoded into\nplain English for any US airport',
    accent: '#10b981',
    icon: '📋',
  },
};

const DEFAULT_CONFIG = {
  title: 'AeroWindy',
  subtitle: 'Real-time aviation weather & AI hazard\nintelligence for US pilots',
  accent: '#38bdf8',
  icon: '✈️',
};

export default function handler(request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '';
  const cfg = PAGE_CONFIG[page] || DEFAULT_CONFIG;

  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #060d1a 0%, #0a1628 60%, #0d1f35 100%)',
          padding: '60px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        },
        children: [
          // Top brand row
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', gap: '16px' },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      width: '48px', height: '48px',
                      background: `rgba(${cfg.accent === '#38bdf8' ? '56,189,248' : cfg.accent === '#fbbf24' ? '251,191,36' : cfg.accent === '#10b981' ? '16,185,129' : '59,130,246'},0.15)`,
                      border: `2px solid ${cfg.accent}`,
                      borderRadius: '12px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '24px',
                    },
                    children: cfg.icon,
                  },
                },
                {
                  type: 'span',
                  props: {
                    style: { color: '#f8fafc', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' },
                    children: 'AeroWindy',
                  },
                },
                {
                  type: 'span',
                  props: {
                    style: {
                      background: `rgba(${cfg.accent === '#38bdf8' ? '56,189,248' : '255,255,255'},0.1)`,
                      border: `1px solid rgba(${cfg.accent === '#38bdf8' ? '56,189,248' : '255,255,255'},0.2)`,
                      color: cfg.accent,
                      borderRadius: '999px',
                      padding: '4px 14px',
                      fontSize: '13px',
                      fontWeight: '700',
                      letterSpacing: '0.8px',
                      textTransform: 'uppercase',
                    },
                    children: 'Free Tool',
                  },
                },
              ],
            },
          },
          // Main content
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column', gap: '20px' },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      color: cfg.accent,
                      fontSize: '18px',
                      fontWeight: '700',
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                    },
                    children: 'Aviation Weather Intelligence',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      color: '#f8fafc',
                      fontSize: '62px',
                      fontWeight: '800',
                      lineHeight: '1.1',
                      letterSpacing: '-2px',
                    },
                    children: cfg.title,
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: { color: '#94a3b8', fontSize: '26px', lineHeight: '1.4' },
                    children: cfg.subtitle.replace('\\n', ' · '),
                  },
                },
              ],
            },
          },
          // Bottom row
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingTop: '24px',
              },
              children: [
                {
                  type: 'span',
                  props: {
                    style: { color: '#475569', fontSize: '18px' },
                    children: 'www.aerowindy.com',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      background: `linear-gradient(135deg, #0ea5e9, #2563eb)`,
                      color: '#fff',
                      borderRadius: '10px',
                      padding: '12px 28px',
                      fontSize: '18px',
                      fontWeight: '700',
                    },
                    children: 'Free for All Pilots →',
                  },
                },
              ],
            },
          },
        ],
      },
    },
    { width: 1200, height: 630 }
  );
}
