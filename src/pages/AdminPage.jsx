import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Users, Settings, ArrowLeft, Shield,
    Eye, EyeOff, RefreshCw, Search, MapPin, Clock,
    Wifi, WifiOff, Save, ChevronDown, Check, AlertCircle,
    Globe, Type, Palette, Sliders, Map, Layers, Wind,
    Activity, UserCheck, UserX
} from 'lucide-react';

// ─── Default settings (mirrors api/admin.js) ─────────────────────────────────

const DEFAULT_SETTINGS = {
    fontFamily: 'Inter',
    accentColor: '#3b82f6',
    panelOpacity: 0.75,
    defaultMapStyle: 'dark',
    defaultAltitude: 'ground',
    barbSize: 28,
    runwayFontSize: 13,
    defaultPanels: { alerts: true, agents: false, weather: false },
};

const FONT_OPTIONS = [
    { value: 'Inter', label: 'Inter (Default)' },
    { value: "'JetBrains Mono', monospace", label: 'JetBrains Mono' },
    { value: 'Roboto, sans-serif', label: 'Roboto' },
    { value: 'system-ui, sans-serif', label: 'System UI' },
    { value: "'Georgia', serif", label: 'Georgia' },
];

const MAP_STYLES = ['dark', 'light', 'hybrid', 'terrain'];
const ALTITUDES  = ['ground', '3k', '6k', '9k', '12k', '18k'];

// ─── Shared styles ────────────────────────────────────────────────────────────

const S = {
    page: {
        minHeight: '100vh',
        background: 'var(--bg-color)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-family)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem 1.5rem',
        borderBottom: '1px solid var(--panel-border)',
        background: 'var(--panel-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
    },
    card: {
        background: 'var(--panel-bg)',
        border: '1px solid var(--panel-border)',
        borderRadius: '12px',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
    },
    btn: (active = false, variant = 'default') => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.5rem 1rem',
        borderRadius: '8px',
        border: '1px solid',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: 500,
        transition: 'all 0.15s',
        ...(variant === 'primary'
            ? { background: active ? 'var(--accent-color)' : 'transparent', borderColor: 'var(--accent-color)', color: active ? '#fff' : 'var(--accent-color)' }
            : { background: active ? 'rgba(255,255,255,0.1)' : 'transparent', borderColor: 'var(--panel-border)', color: 'var(--text-primary)' }),
    }),
    input: {
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid var(--panel-border)',
        borderRadius: '8px',
        padding: '0.5rem 0.75rem',
        color: 'var(--text-primary)',
        fontSize: '0.875rem',
        outline: 'none',
        width: '100%',
    },
    label: {
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.4rem',
        display: 'block',
    },
    section: {
        marginBottom: '1.5rem',
    },
    sectionTitle: {
        fontSize: '0.8rem',
        color: 'var(--text-secondary)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
    },
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color, sub }) {
    return (
        <div style={{ ...S.card, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
                <Icon size={16} color={color || 'var(--accent-color)'} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: color || 'var(--text-primary)', lineHeight: 1 }}>
                {value ?? '–'}
            </div>
            {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{sub}</div>}
        </div>
    );
}

// ─── Tab Nav ──────────────────────────────────────────────────────────────────

function TabNav({ active, onChange }) {
    const tabs = [
        { id: 'analytics', label: 'Analytics',  icon: LayoutDashboard },
        { id: 'users',     label: 'Users',       icon: Users            },
        { id: 'settings',  label: 'Settings',    icon: Settings         },
    ];
    return (
        <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--panel-border)', padding: '0 1.5rem' }}>
            {tabs.map(({ id, label, icon: Icon }) => (
                <button
                    key={id}
                    onClick={() => onChange(id)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        padding: '0.75rem 1rem',
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '0.875rem', fontWeight: 500,
                        color: active === id ? 'var(--accent-color)' : 'var(--text-secondary)',
                        borderBottom: active === id ? '2px solid var(--accent-color)' : '2px solid transparent',
                        transition: 'color 0.15s',
                        marginBottom: '-1px',
                    }}
                >
                    <Icon size={15} />
                    {label}
                </button>
            ))}
        </div>
    );
}

// ─── Login Gate ───────────────────────────────────────────────────────────────

function LoginGate({ onAuth }) {
    const [password, setPassword] = useState('');
    const [showPw, setShowPw]     = useState(false);
    const [error, setError]       = useState('');
    const [loading, setLoading]   = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!password.trim()) return;
        setLoading(true);
        setError('');

        try {
            const res = await fetch(`/api/admin?secret=${encodeURIComponent(password.trim())}`);
            // Guard against Vite SPA fallback returning HTML instead of JSON
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                setError('Admin API not reachable. Make sure the backend server is running.');
                return;
            }
            const json = await res.json();
            if (res.ok && !json.error) {
                sessionStorage.setItem('admin_secret', password.trim());
                onAuth(password.trim(), json);
            } else {
                setError('Invalid admin password.');
            }
        } catch {
            setError('Could not reach the admin API.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-color)',
        }}>
            <div style={{ ...S.card, padding: '2.5rem', width: '100%', maxWidth: '380px', textAlign: 'center' }}>
                <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 1.25rem',
                }}>
                    <Shield size={24} color="var(--accent-color)" />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>AeroWind Admin</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.75rem' }}>
                    Enter your admin password to continue
                </p>

                <form onSubmit={handleSubmit}>
                    <div style={{ position: 'relative', marginBottom: '1rem' }}>
                        <input
                            type={showPw ? 'text' : 'password'}
                            placeholder="Admin password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            style={{ ...S.input, paddingRight: '2.5rem' }}
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={() => setShowPw(p => !p)}
                            style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                        >
                            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    </div>

                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ef4444', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                            <AlertCircle size={13} /> {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !password.trim()}
                        style={{
                            ...S.btn(true, 'primary'), width: '100%', justifyContent: 'center',
                            padding: '0.65rem', opacity: loading ? 0.7 : 1,
                        }}
                    >
                        {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Shield size={14} />}
                        {loading ? 'Verifying…' : 'Access Dashboard'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab({ stats, users }) {
    const recentUsers = (users || []).slice(0, 8);
    const topIps = React.useMemo(() => {
        if (!users?.length) return [];
        const counts = {};
        users.forEach(u => { if (u.ip && u.ip !== 'unknown') counts[u.ip] = (counts[u.ip] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    }, [users]);

    const retentionPct = stats?.total > 0 ? Math.round((stats.active7d / stats.total) * 100) : 0;

    return (
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                <StatCard icon={Users}     label="Total Users"     value={stats?.total}         color="#3b82f6" />
                <StatCard icon={Activity}  label="Active (24 h)"   value={stats?.active24h}     color="#10b981" />
                <StatCard icon={UserCheck} label="Active (7 d)"    value={stats?.active7d}      color="#f59e0b" sub={`${retentionPct}% retention`} />
                <StatCard icon={MapPin}    label="With Location"   value={stats?.withLocation}  color="#8b5cf6" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Recent Activity */}
                <div style={{ ...S.card, padding: '1.25rem' }}>
                    <div style={S.sectionTitle}><Clock size={13} /> Recent Activity</div>
                    {recentUsers.length === 0
                        ? <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No users tracked yet.</p>
                        : recentUsers.map(u => (
                            <div key={u.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--panel-border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline(u.lastSeen) ? '#10b981' : 'var(--text-secondary)' }} />
                                    <span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{u.userId.slice(0, 12)}…</span>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{relativeTime(u.lastSeen)}</span>
                            </div>
                        ))
                    }
                </div>

                {/* Top IPs */}
                <div style={{ ...S.card, padding: '1.25rem' }}>
                    <div style={S.sectionTitle}><Globe size={13} /> Top IP Addresses</div>
                    {topIps.length === 0
                        ? <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No data yet.</p>
                        : topIps.map(([ip, count]) => (
                            <div key={ip} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--panel-border)' }}>
                                <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{ip}</span>
                                <span style={{ fontSize: '0.75rem', background: 'rgba(59,130,246,0.15)', color: 'var(--accent-color)', padding: '0.1rem 0.5rem', borderRadius: '99px' }}>{count} session{count !== 1 ? 's' : ''}</span>
                            </div>
                        ))
                    }
                </div>
            </div>

            {/* Location map placeholder */}
            {stats?.withLocation > 0 && (
                <div style={{ ...S.card, padding: '1.25rem' }}>
                    <div style={S.sectionTitle}><MapPin size={13} /> User Locations ({stats.withLocation} tracked)</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {(users || []).filter(u => u.lat && u.lon).slice(0, 24).map(u => (
                            <span key={u.userId} style={{ fontSize: '0.7rem', fontFamily: 'monospace', background: 'rgba(139,92,246,0.15)', color: '#a78bfa', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                                {parseFloat(u.lat).toFixed(1)}°, {parseFloat(u.lon).toFixed(1)}°
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({ users }) {
    const [search, setSearch]         = useState('');
    const [sortKey, setSortKey]       = useState('lastSeen');
    const [sortDir, setSortDir]       = useState('desc');
    const [filterOnline, setFilter]   = useState(false);

    const filtered = React.useMemo(() => {
        let list = users || [];
        if (filterOnline) list = list.filter(u => isOnline(u.lastSeen));
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(u =>
                u.userId?.toLowerCase().includes(q) ||
                u.ip?.toLowerCase().includes(q) ||
                String(u.lat || '').includes(q) ||
                String(u.lon || '').includes(q)
            );
        }
        return [...list].sort((a, b) => {
            let av = a[sortKey] || ''; let bv = b[sortKey] || '';
            if (sortKey === 'lastSeen') { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
            return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
        });
    }, [users, search, sortKey, sortDir, filterOnline]);

    const toggleSort = (key) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const thStyle = (key) => ({
        padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.75rem',
        color: sortKey === key ? 'var(--accent-color)' : 'var(--text-secondary)',
        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
        cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
    });

    return (
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                    <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input
                        type="text"
                        placeholder="Search by user ID, IP, location…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ ...S.input, paddingLeft: '2rem' }}
                    />
                </div>
                <button
                    onClick={() => setFilter(f => !f)}
                    style={{ ...S.btn(filterOnline, 'primary'), whiteSpace: 'nowrap' }}
                >
                    {filterOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
                    {filterOnline ? 'Online only' : 'All users'}
                </button>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{filtered.length} users</span>
            </div>

            {/* Table */}
            <div style={{ ...S.card, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
                                <th style={thStyle('userId')} onClick={() => toggleSort('userId')}>User ID</th>
                                <th style={thStyle('ip')}     onClick={() => toggleSort('ip')}>IP Address</th>
                                <th style={thStyle('lat')}>Location</th>
                                <th style={thStyle('lastSeen')} onClick={() => toggleSort('lastSeen')}>Last Seen</th>
                                <th style={{ ...thStyle('status'), cursor: 'default' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                    {(users || []).length === 0 ? 'No users tracked yet. Data requires Vercel KV in production.' : 'No matching users.'}
                                </td></tr>
                            )}
                            {filtered.map((u, i) => (
                                <tr key={u.userId} style={{ borderBottom: '1px solid var(--panel-border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                                    <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        <span title={u.userId}>{u.userId.slice(0, 16)}…</span>
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                        {u.ip === 'unknown' || !u.ip ? <span style={{ color: 'var(--text-secondary)' }}>—</span> : u.ip}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {u.lat && u.lon
                                            ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                <MapPin size={11} style={{ color: '#8b5cf6' }} />
                                                {parseFloat(u.lat).toFixed(2)}°, {parseFloat(u.lon).toFixed(2)}°
                                              </span>
                                            : '—'
                                        }
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                        {u.lastSeen ? relativeTime(u.lastSeen) : '—'}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                            fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '99px',
                                            background: isOnline(u.lastSeen) ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.1)',
                                            color: isOnline(u.lastSeen) ? '#10b981' : 'var(--text-secondary)',
                                        }}>
                                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                                            {isOnline(u.lastSeen) ? 'Online' : 'Offline'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ settings: initialSettings, secret, onSaved }) {
    const [settings, setSettings] = useState(initialSettings || DEFAULT_SETTINGS);
    const [status, setStatus]     = useState(''); // '', 'saving', 'saved', 'error'

    useEffect(() => {
        if (initialSettings) setSettings(initialSettings);
    }, [initialSettings]);

    const set = (key, value) => setSettings(s => ({ ...s, [key]: value }));
    const setPanel = (key, value) => setSettings(s => ({ ...s, defaultPanels: { ...s.defaultPanels, [key]: value } }));

    const save = async () => {
        setStatus('saving');
        try {
            const res = await fetch(`/api/admin?secret=${encodeURIComponent(secret)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings }),
            });
            if (res.ok) {
                setStatus('saved');
                onSaved?.(settings);
                setTimeout(() => setStatus(''), 2500);
            } else {
                setStatus('error');
            }
        } catch {
            setStatus('error');
        }
    };

    const ToggleBtn = ({ value, active, onClick }) => (
        <button
            onClick={onClick}
            style={{
                padding: '0.35rem 0.75rem', borderRadius: '6px', cursor: 'pointer',
                border: '1px solid', fontSize: '0.8rem', fontWeight: 500,
                background: active ? 'var(--accent-color)' : 'transparent',
                borderColor: active ? 'var(--accent-color)' : 'var(--panel-border)',
                color: active ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.15s',
            }}
        >
            {value}
        </button>
    );

    return (
        <div style={{ padding: '1.5rem', maxWidth: 680 }}>
            {/* Appearance */}
            <div style={{ ...S.card, padding: '1.5rem', marginBottom: '1rem' }}>
                <div style={S.sectionTitle}><Palette size={13} /> Appearance</div>

                <div style={{ marginBottom: '1.25rem' }}>
                    <label style={S.label}>Font Family</label>
                    <div style={{ position: 'relative' }}>
                        <select
                            value={settings.fontFamily}
                            onChange={e => set('fontFamily', e.target.value)}
                            style={{ ...S.input, appearance: 'none', paddingRight: '2rem', cursor: 'pointer' }}
                        >
                            {FONT_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value} style={{ background: '#1e293b' }}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={14} style={{ position: 'absolute', right: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                        Preview: <span style={{ fontFamily: settings.fontFamily }}>AeroWind Tracker — 270° at 18 kts</span>
                    </p>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                    <label style={S.label}>Accent Color</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <input
                            type="color"
                            value={settings.accentColor}
                            onChange={e => set('accentColor', e.target.value)}
                            style={{ width: 40, height: 36, borderRadius: '8px', border: '1px solid var(--panel-border)', background: 'none', cursor: 'pointer', padding: 2 }}
                        />
                        <input
                            type="text"
                            value={settings.accentColor}
                            onChange={e => {
                                if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) set('accentColor', e.target.value);
                            }}
                            style={{ ...S.input, width: 110 }}
                            placeholder="#3b82f6"
                        />
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                            {['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'].map(c => (
                                <button
                                    key={c}
                                    onClick={() => set('accentColor', c)}
                                    title={c}
                                    style={{
                                        width: 20, height: 20, borderRadius: '50%', background: c, border: settings.accentColor === c ? '2px solid white' : '2px solid transparent', cursor: 'pointer',
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div>
                    <label style={S.label}>Panel Opacity — {Math.round(settings.panelOpacity * 100)}%</label>
                    <input
                        type="range" min={0.3} max={1} step={0.05}
                        value={settings.panelOpacity}
                        onChange={e => set('panelOpacity', parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: settings.accentColor }}
                    />
                </div>
            </div>

            {/* Map Defaults */}
            <div style={{ ...S.card, padding: '1.5rem', marginBottom: '1rem' }}>
                <div style={S.sectionTitle}><Map size={13} /> Map Defaults</div>

                <div style={{ marginBottom: '1.25rem' }}>
                    <label style={S.label}>Default Map Style</label>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {MAP_STYLES.map(s => (
                            <ToggleBtn key={s} value={s.charAt(0).toUpperCase() + s.slice(1)} active={settings.defaultMapStyle === s} onClick={() => set('defaultMapStyle', s)} />
                        ))}
                    </div>
                </div>

                <div>
                    <label style={S.label}>Default Altitude</label>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {ALTITUDES.map(a => (
                            <ToggleBtn key={a} value={a === 'ground' ? 'Ground' : a} active={settings.defaultAltitude === a} onClick={() => set('defaultAltitude', a)} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Display */}
            <div style={{ ...S.card, padding: '1.5rem', marginBottom: '1rem' }}>
                <div style={S.sectionTitle}><Sliders size={13} /> Display</div>

                <div style={{ marginBottom: '1.25rem' }}>
                    <label style={S.label}>Wind Barb Size — {settings.barbSize}px</label>
                    <input
                        type="range" min={16} max={48} step={2}
                        value={settings.barbSize}
                        onChange={e => set('barbSize', parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: settings.accentColor }}
                    />
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                    <label style={S.label}>Runway Label Font Size — {settings.runwayFontSize}px</label>
                    <input
                        type="range" min={9} max={20} step={1}
                        value={settings.runwayFontSize}
                        onChange={e => set('runwayFontSize', parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: settings.accentColor }}
                    />
                </div>

                <div>
                    <label style={S.label}>Default Open Panels</label>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {[['alerts','Alerts'], ['agents','AI Agents'], ['weather','Weather Overlay']].map(([key, label]) => (
                            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                                <input
                                    type="checkbox"
                                    checked={!!settings.defaultPanels?.[key]}
                                    onChange={e => setPanel(key, e.target.checked)}
                                    style={{ accentColor: settings.accentColor, width: 14, height: 14 }}
                                />
                                {label}
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            {/* Save */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button
                    onClick={save}
                    disabled={status === 'saving'}
                    style={{ ...S.btn(true, 'primary'), padding: '0.6rem 1.5rem', opacity: status === 'saving' ? 0.7 : 1 }}
                >
                    {status === 'saving'
                        ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        : status === 'saved'
                            ? <Check size={14} />
                            : <Save size={14} />
                    }
                    {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved!' : 'Save Settings'}
                </button>
                {status === 'error' && (
                    <span style={{ fontSize: '0.8rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <AlertCircle size={13} /> Failed to save. Check console.
                    </span>
                )}
                {status === 'saved' && (
                    <span style={{ fontSize: '0.8rem', color: '#10b981' }}>
                        Settings saved. New users will load with these defaults.
                    </span>
                )}
            </div>
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isOnline(lastSeen) {
    if (!lastSeen) return false;
    return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

function relativeTime(iso) {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000)         return 'just now';
    if (diff < 3_600_000)      return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000)     return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminPage() {
    const navigate = useNavigate();
    const [secret,      setSecret]      = useState(() => sessionStorage.getItem('admin_secret') || '');
    const [authed,      setAuthed]      = useState(() => !!sessionStorage.getItem('admin_secret'));
    const [activeTab,   setActiveTab]   = useState('analytics');
    const [loading,     setLoading]     = useState(false);
    const [lastFetched, setLastFetched] = useState(null);
    const [data,        setData]        = useState(null); // { users, stats, settings }

    const fetchData = useCallback(async (s = secret, preloaded = null) => {
        if (!s) return;
        if (preloaded) { setData(preloaded); setLastFetched(new Date()); return; }
        setLoading(true);
        try {
            const res = await fetch(`/api/admin?secret=${encodeURIComponent(s)}`);
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('application/json')) {
                console.warn('[AdminPage] API returned non-JSON — backend not running?');
                setLoading(false);
                return;
            }
            const json = await res.json();
            if (res.ok && !json.error) {
                setData(json);
                setLastFetched(new Date());
            } else if (res.status === 401) {
                sessionStorage.removeItem('admin_secret');
                setAuthed(false);
                setSecret('');
            }
        } catch (err) {
            console.error('[AdminPage] fetch error', err);
        } finally {
            setLoading(false);
        }
    }, [secret]);

    useEffect(() => {
        if (authed && secret) fetchData(secret);
    }, [authed]);

    const handleAuth = (s, preloaded) => {
        setSecret(s);
        setAuthed(true);
        fetchData(s, preloaded);
    };

    const handleLogout = () => {
        sessionStorage.removeItem('admin_secret');
        setAuthed(false);
        setSecret('');
        setData(null);
    };

    if (!authed) return <LoginGate onAuth={handleAuth} />;

    return (
        <div style={S.page}>
            {/* Keyframe for spinner */}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* Header */}
            <header style={S.header}>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.875rem' }}>
                    <ArrowLeft size={15} /> Back to App
                </button>

                <div style={{ width: 1, height: 20, background: 'var(--panel-border)' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                    <Shield size={16} color="var(--accent-color)" />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>AeroWind Admin</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {lastFetched && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Updated {relativeTime(lastFetched.toISOString())}
                        </span>
                    )}
                    <button
                        onClick={() => fetchData()}
                        disabled={loading}
                        style={{ ...S.btn(false), padding: '0.4rem 0.75rem' }}
                    >
                        <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
                        Refresh
                    </button>
                    <button onClick={handleLogout} style={{ ...S.btn(false), padding: '0.4rem 0.75rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                        Logout
                    </button>
                </div>
            </header>

            {/* Tab Nav */}
            <TabNav active={activeTab} onChange={setActiveTab} />

            {/* Content */}
            {loading && !data
                ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: '0.5rem' }}>
                        <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
                    </div>
                )
                : (
                    <>
                        {activeTab === 'analytics' && <AnalyticsTab stats={data?.stats} users={data?.users} />}
                        {activeTab === 'users'     && <UsersTab users={data?.users} />}
                        {activeTab === 'settings'  && (
                            <SettingsTab
                                settings={data?.settings}
                                secret={secret}
                                onSaved={(s) => setData(d => ({ ...d, settings: s }))}
                            />
                        )}
                    </>
                )
            }
        </div>
    );
}
