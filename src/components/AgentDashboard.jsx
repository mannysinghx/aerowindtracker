/**
 * AgentDashboard — Multi-Agent Intelligence Center
 *
 * Polls /api/agents every 30s and displays live status from:
 *   WindAgent     — Wind shear corridors, mountain wave, extreme winds
 *   HazardAgent   — IFR clusters, icing risks, PIREP analysis
 *   TrendAgent    — Rapid changes between 5-min data cycles
 *   BriefingAgent — Gemini-synthesized pilot situation briefing
 */

import { useState, useEffect, useRef } from 'react';
import { Wind, Shield, TrendingUp, FileText, ChevronDown, ChevronUp, X, Activity, AlertTriangle, CheckCircle, Clock, Zap } from 'lucide-react';

// ─── Agent config ─────────────────────────────────────────────────────────────

const AGENT_META = {
    wind:     { Icon: Wind,        color: '#3b82f6', label: 'WindAgent',     role: 'Wind Pattern Analysis'   },
    hazard:   { Icon: Shield,      color: '#ef4444', label: 'HazardAgent',   role: 'Hazard Detection'         },
    trend:    { Icon: TrendingUp,  color: '#f59e0b', label: 'TrendAgent',    role: 'Condition Trends'         },
    briefing: { Icon: FileText,    color: '#8b5cf6', label: 'BriefingAgent', role: 'Situation Synthesis'      },
};

const SEV_COLOR = {
    HIGH:   '#ef4444',
    MEDIUM: '#f59e0b',
    LOW:    '#3b82f6',
    INFO:   '#6b7280',
};

function severityLabel(sev) {
    if (sev === 'HIGH')   return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   text: 'HIGH' };
    if (sev === 'MEDIUM') return { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  text: 'MED' };
    if (sev === 'INFO')   return { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', text: 'INFO' };
    return                        { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', text: 'LOW' };
}

function StatusDot({ status, color }) {
    const base = {
        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
        transition: 'background 0.3s',
    };
    if (status === 'alert') return (
        <span style={{ ...base, background: '#ef4444', boxShadow: '0 0 6px #ef4444',
            animation: 'agentPulse 1.2s ease-in-out infinite' }} />
    );
    if (status === 'ok') return (
        <span style={{ ...base, background: '#10b981' }} />
    );
    if (status === 'running') return (
        <span style={{ ...base, background: color, animation: 'agentPulse 1s ease-in-out infinite' }} />
    );
    // idle
    return <span style={{ ...base, background: '#4b5563' }} />;
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({ agentKey, data }) {
    const [expanded, setExpanded] = useState(false);
    const meta = AGENT_META[agentKey];
    if (!meta || !data) return null;
    const { Icon, color, label, role } = meta;

    const highCount   = data.findings?.filter(f => f.severity === 'HIGH').length   ?? 0;
    const totalCount  = data.findings?.length ?? 0;
    const topFinding  = data.findings?.find(f => f.severity === 'HIGH') || data.findings?.[0];

    const statusText = {
        alert:   'ALERT',
        ok:      'NOMINAL',
        running: 'ANALYZING',
        idle:    'STANDBY',
    }[data.status] ?? 'STANDBY';

    return (
        <div style={{
            borderRadius: '10px',
            border: `1px solid ${data.status === 'alert' ? 'rgba(239,68,68,0.4)' : 'var(--panel-border)'}`,
            background: data.status === 'alert' ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.03)',
            overflow: 'hidden',
            transition: 'border-color 0.3s',
        }}>
            {/* Card header */}
            <div
                onClick={() => totalCount > 0 && setExpanded(e => !e)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', cursor: totalCount > 0 ? 'pointer' : 'default',
                }}
            >
                {/* Icon */}
                <div style={{
                    width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
                    background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Icon size={14} color={color} />
                </div>

                {/* Name + role */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{label}</span>
                        {/* Status pill */}
                        <span style={{
                            fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.6px',
                            padding: '2px 5px', borderRadius: '4px',
                            color: data.status === 'alert' ? '#ef4444' : data.status === 'ok' ? '#10b981' : '#6b7280',
                            background: data.status === 'alert' ? 'rgba(239,68,68,0.15)' : data.status === 'ok' ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.12)',
                        }}>
                            {statusText}
                        </span>
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '1px' }}>{role}</div>
                </div>

                {/* Finding count + expand toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <StatusDot status={data.status} color={color} />
                    {totalCount > 0 && (
                        <span style={{
                            fontSize: '0.6rem', fontWeight: 800,
                            background: highCount > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)',
                            color: highCount > 0 ? '#ef4444' : 'var(--text-secondary)',
                            borderRadius: '999px', padding: '2px 7px',
                        }}>{totalCount}</span>
                    )}
                    {totalCount > 0 && (expanded ? <ChevronUp size={12} color="var(--text-secondary)" /> : <ChevronDown size={12} color="var(--text-secondary)" />)}
                </div>
            </div>

            {/* Top finding preview (collapsed state) */}
            {!expanded && topFinding && (
                <div style={{
                    margin: '0 12px 10px',
                    padding: '7px 10px', borderRadius: '6px',
                    background: 'rgba(255,255,255,0.04)', borderLeft: `3px solid ${SEV_COLOR[topFinding.severity] || '#6b7280'}`,
                    fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: '1.4',
                }}>
                    {topFinding.message.length > 120 ? topFinding.message.substring(0, 120) + '…' : topFinding.message}
                </div>
            )}

            {/* Expanded findings list */}
            {expanded && data.findings?.length > 0 && (
                <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {data.findings.map((f, i) => {
                        const sev = severityLabel(f.severity);
                        return (
                            <div key={f.id || i} style={{
                                padding: '8px 10px', borderRadius: '7px',
                                background: sev.bg, border: `1px solid ${sev.color}30`,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                    <span style={{ fontSize: '0.55rem', fontWeight: 800, color: sev.color, letterSpacing: '0.5px' }}>{sev.text}</span>
                                    <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{f.type?.replace(/_/g, ' ')}</span>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-primary)', lineHeight: '1.45' }}>{f.message}</p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AgentDashboard({ onClose }) {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(false);
    const intervalRef           = useRef(null);

    async function fetchAgents() {
        try {
            const res = await fetch('/api/agents');
            if (!res.ok) throw new Error('not ok');
            const json = await res.json();
            setData(json);
            setError(false);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchAgents();
        intervalRef.current = setInterval(fetchAgents, 30_000);
        return () => clearInterval(intervalRef.current);
    }, []);

    const agents    = data?.agents ?? {};
    const lastRun   = data?.lastRun;
    const anyAlert  = Object.values(agents).some(a => a.status === 'alert');
    const totalHigh = Object.values(agents).reduce((n, a) =>
        n + (a.findings?.filter(f => f.severity === 'HIGH').length ?? 0), 0
    );
    const briefing  = agents.briefing?.briefing;

    return (
        <>
            {/* Inline keyframes for status dot pulse */}
            <style>{`
                @keyframes agentPulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50%       { opacity: 0.5; transform: scale(1.3); }
                }
            `}</style>

            <div className="glass-panel ui-element" style={{
                width: '340px', maxHeight: '80vh', overflowY: 'auto',
                padding: '0', borderRadius: '14px', pointerEvents: 'auto',
                border: anyAlert ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--panel-border)',
                boxShadow: anyAlert ? '0 0 20px rgba(239,68,68,0.15)' : '0 8px 32px rgba(0,0,0,0.4)',
            }}>
                {/* ── Header ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '14px 16px 12px',
                    borderBottom: '1px solid var(--panel-border)',
                    background: anyAlert ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)',
                }}>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                        background: anyAlert ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Activity size={16} color={anyAlert ? '#ef4444' : '#818cf8'} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                                Agent Intelligence
                            </span>
                            {anyAlert && (
                                <span style={{
                                    fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.5px',
                                    color: '#ef4444', background: 'rgba(239,68,68,0.2)',
                                    borderRadius: '4px', padding: '2px 6px',
                                    animation: 'agentPulse 2s ease-in-out infinite',
                                }}>
                                    {totalHigh} ALERT{totalHigh !== 1 ? 'S' : ''}
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
                            {loading ? 'Connecting to agents…' :
                             error   ? 'Server unavailable — start node server.js' :
                             lastRun ? `Last cycle: ${new Date(lastRun).toLocaleTimeString()}` :
                             'Awaiting first cycle'}
                        </div>
                    </div>

                    {/* Autonomous badge */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        fontSize: '0.55rem', fontWeight: 700, color: '#10b981',
                        background: 'rgba(16,185,129,0.12)', borderRadius: '5px',
                        padding: '3px 7px', letterSpacing: '0.4px',
                    }}>
                        <Zap size={9} />
                        AUTO
                    </div>

                    {onClose && (
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px', flexShrink: 0 }}>
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* ── Loading state ── */}
                {loading && (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        <Activity size={24} style={{ margin: '0 auto 10px', display: 'block', animation: 'agentPulse 1s ease-in-out infinite', color: '#6366f1' }} />
                        Initializing agents…
                    </div>
                )}

                {/* ── Server unavailable fallback ── */}
                {!loading && error && (
                    <div style={{ padding: '20px 16px', textAlign: 'center' }}>
                        <AlertTriangle size={28} color="#f59e0b" style={{ margin: '0 auto 10px', display: 'block' }} />
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: '1.5', margin: 0 }}>
                            Agent backend offline. Run <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '4px' }}>node server.js</code> to enable multi-agent intelligence.
                        </p>
                    </div>
                )}

                {/* ── Agent cards ── */}
                {!loading && !error && data && (
                    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {Object.entries(AGENT_META).map(([key]) => (
                            agents[key] && <AgentCard key={key} agentKey={key} data={agents[key]} />
                        ))}
                    </div>
                )}

                {/* ── Live Briefing ── */}
                {!loading && !error && briefing && (
                    <div style={{
                        margin: '0 12px 14px',
                        padding: '12px 14px', borderRadius: '10px',
                        background: anyAlert ? 'rgba(239,68,68,0.06)' : 'rgba(99,102,241,0.08)',
                        border: `1px solid ${anyAlert ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.25)'}`,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <FileText size={12} color={anyAlert ? '#ef4444' : '#818cf8'} />
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase', color: anyAlert ? '#ef4444' : '#818cf8' }}>
                                Live Briefing
                            </span>
                            {agents.briefing?.status === 'alert' ? (
                                <AlertTriangle size={10} color="#ef4444" />
                            ) : (
                                <CheckCircle size={10} color="#10b981" />
                            )}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-primary)', lineHeight: '1.55' }}>{briefing}</p>
                        {agents.briefing?.runAt && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                                <Clock size={9} color="var(--text-secondary)" />
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                                    {new Date(agents.briefing.runAt).toLocaleTimeString()}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
