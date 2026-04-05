import React from 'react';

export default function CrosswindControls({ windDir, runwayHeading, theme, fullWidth }) {
  if (windDir === null || runwayHeading === null) return null;

  // Relative wind angle relative to the nose (0 is straight ahead, 90 is right wing)
  let relativeWind = (windDir - runwayHeading) % 360;
  if (relativeWind < 0) relativeWind += 360;

  let lhAil = "NEUTRAL";
  let rhAil = "NEUTRAL";
  let elev = "NEUTRAL";
  let instruction = "Headwind (Neutral Controls)";
  
  let stickX = 50;
  let stickY = 50;

  if (relativeWind >= 0 && relativeWind <= 90) {
      rhAil = "UP";
      instruction = "Use Up Aileron on RH Wing and Neutral Elevator";
      stickX = 80;
      stickY = 50;
  } else if (relativeWind > 270 && relativeWind <= 360) {
      lhAil = "UP";
      instruction = "Use Up Aileron on LH Wing and Neutral Elevator";
      stickX = 20;
      stickY = 50;
  } else if (relativeWind > 90 && relativeWind <= 180) {
      rhAil = "DOWN"; // Turn away from wind (wind is Right, so turn Left -> Left Up, Right Down)
      elev = "DOWN";
      instruction = "Use Down Aileron on RH Wing and Down Elevator";
      stickX = 20; // Turn left
      stickY = 20; // Push forward
  } else if (relativeWind > 180 && relativeWind <= 270) {
      lhAil = "DOWN"; // Turn away from wind (wind is Left, so turn Right -> Right Up, Left Down)
      elev = "DOWN";
      instruction = "Use Down Aileron on LH Wing and Down Elevator";
      stickX = 80; // Turn right
      stickY = 20; // Push forward
  }

  // Rudder steers against weathervaning (nose wants to turn into wind)
  let rudder = "NEUTRAL";
  if (relativeWind > 180 && relativeWind < 360) {
      rudder = "RIGHT"; // Wind from Left, nose pulls Left, steer Right
  } else if (relativeWind > 0 && relativeWind < 180) {
      rudder = "LEFT"; // Wind from Right, nose pulls Right, steer Left
  }

  const getGlow = (state) => {
    if (state === "UP" || state === "LEFT") return "rgba(239, 68, 68, 0.8)"; // Red
    if (state === "DOWN" || state === "RIGHT") return "rgba(59, 130, 246, 0.8)"; // Blue
    return theme === 'dark' ? "transparent" : "transparent"; 
  };
  
  const getStroke = (state) => {
     if (state === "UP" || state === "LEFT") return "#ef4444";
     if (state === "DOWN" || state === "RIGHT") return "#3b82f6";
     return theme === 'dark' ? "#475569" : "#cbd5e1";
  }

  const planeBody = theme === 'dark' ? '#1e293b' : '#f1f5f9';
  const planeOutline = theme === 'dark' ? '#64748b' : '#94a3b8';
  const textColor = theme === 'dark' ? '#f8fafc' : '#0f172a';
  const secTextColor = theme === 'dark' ? '#94a3b8' : '#475569';

  return (
    <div className="crosswind-controls glass-panel ui-element" style={{ width: fullWidth ? '100%' : '320px', padding: '15px', position: 'relative', marginTop: '-5px', flexShrink: 0, transition: 'all 0.3s ease', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 className="text-sm font-bold" style={{ color: textColor }}>Taxi Wind Deflection</h3>
        <span style={{ fontSize: '0.7rem', color: 'var(--accent-color)', padding: '2px 6px', border: '1px solid var(--accent-color)', borderRadius: '4px', fontWeight: 'bold' }}>
          HDG {runwayHeading}°
        </span>
      </div>
      
      <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
        <div style={{ width: '120px', height: '140px', position: 'relative', background: theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)', borderRadius: '8px' }}>
          <svg width="120" height="140" viewBox="0 0 120 140" style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
             <g transform={`rotate(${relativeWind} 60 70)`} style={{ transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}>
               <line x1="60" y1="5" x2="60" y2="40" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
               <polygon points="60,46 66,34 54,34" fill="#10b981" />
             </g>
          </svg>
        
          <svg width="120" height="140" viewBox="0 0 120 140" style={{ position: 'relative', zIndex: 10 }}>
            {/* Fuselage */}
            <rect x="52" y="20" width="16" height="90" rx="8" fill={planeBody} stroke={planeOutline} strokeWidth="2" />
            
            {/* Left Wing */}
            <path d="M52 45 L10 52 L10 65 L52 65 Z" fill={planeBody} stroke={planeOutline} strokeWidth="2" strokeLinejoin="round" />
            <path d="M10 65 L33 65 L33 72 L10 75 Z" fill={getGlow(lhAil)} stroke={getStroke(lhAil)} strokeWidth="2" strokeLinejoin="round" />

            {/* Right Wing */}
            <path d="M68 45 L110 52 L110 65 L68 65 Z" fill={planeBody} stroke={planeOutline} strokeWidth="2" strokeLinejoin="round" />
            <path d="M110 65 L87 65 L87 72 L110 75 Z" fill={getGlow(rhAil)} stroke={getStroke(rhAil)} strokeWidth="2" strokeLinejoin="round" />

            {/* Horizontal Stabilizer */}
            <path d="M52 95 L30 100 L30 105 L52 105 Z" fill={planeBody} stroke={planeOutline} strokeWidth="2" strokeLinejoin="round" />
            <path d="M68 95 L90 100 L90 105 L68 105 Z" fill={planeBody} stroke={planeOutline} strokeWidth="2" strokeLinejoin="round" />
            
            {/* Elevator */}
            <path d="M30 105 L90 105 L88 114 L32 114 Z" fill={getGlow(elev)} stroke={getStroke(elev)} strokeWidth="2" strokeLinejoin="round" />

            {/* Rudder Base */}
            <path d="M58 90 L62 90 L62 102 L58 102 Z" fill={planeBody} stroke={planeOutline} strokeWidth="1" />
            {/* Dynamic Rudder Deflection */}
            {rudder === "LEFT" ? (
               <path d="M58 102 L62 102 L58 115 L54 115 Z" fill={getGlow("LEFT")} stroke={getStroke("LEFT")} strokeWidth="1" />
            ) : rudder === "RIGHT" ? (
               <path d="M58 102 L62 102 L66 115 L62 115 Z" fill={getGlow("RIGHT")} stroke={getStroke("RIGHT")} strokeWidth="1" />
            ) : (
               <path d="M58 102 L62 102 L62 115 L58 115 Z" fill={planeBody} stroke={planeOutline} strokeWidth="1" />
            )}
          </svg>
        </div>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ padding: '8px', background: theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)', borderRadius: '6px', borderLeft: '3px solid #10b981' }}>
             <span style={{ fontSize: '0.65rem', color: secTextColor, display: 'block', marginBottom: '2px', fontWeight: 'bold' }}>AERODYNAMIC DRAG</span>
             <span style={{ fontSize: '0.8rem', color: textColor, fontWeight: 'bold', lineHeight: '1.2' }}>{instruction}</span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', padding: '8px', borderRadius: '6px', flex: 1 }}>
               <div style={{ fontSize: '0.7rem', color: secTextColor }}>REL WIND</div>
               <div style={{ fontSize: '0.7rem', color: textColor, fontWeight: 'bold' }}>{Math.round(relativeWind)}°</div>
               <div style={{ fontSize: '0.7rem', color: secTextColor }}>RUDDER</div>
               <div style={{ fontSize: '0.7rem', color: getStroke(rudder), fontWeight: 'bold' }}>{rudder}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', padding: '5px 10px', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.6rem', color: secTextColor, marginBottom: '2px', fontWeight: 'bold', letterSpacing: '1px' }}>YOKE</div>
              <svg width="40" height="40" viewBox="0 0 100 100" style={{ background: theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)', borderRadius: '6px', border: `1px solid ${planeOutline}` }}>
                <line x1="50" y1="10" x2="50" y2="90" stroke={planeOutline} strokeWidth="1" strokeDasharray="2,2" />
                <line x1="10" y1="50" x2="90" y2="50" stroke={planeOutline} strokeWidth="1" strokeDasharray="2,2" />
                <circle cx={stickX} cy={stickY} r="12" fill="transparent" stroke="var(--accent-color)" strokeWidth="4" style={{ transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }} />
                <circle cx={stickX} cy={stickY} r="5" fill={textColor} style={{ transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }} />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
