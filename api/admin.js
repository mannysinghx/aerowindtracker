import { kv } from '@vercel/kv';

export function getDefaultSettings() {
    return {
        fontFamily: 'Inter',
        accentColor: '#3b82f6',
        panelOpacity: 0.75,
        defaultMapStyle: 'dark',
        defaultAltitude: 'ground',
        barbSize: 28,
        runwayFontSize: 13,
        defaultPanels: { alerts: true, agents: false, weather: false },
    };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const secret = req.query.secret || req.headers['x-admin-secret'];
    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminSecret || secret !== adminSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // ── GET: fetch users + stats + settings ──────────────────────────────────
    if (req.method === 'GET') {
        try {
            const keys = await kv.keys('user:*').catch(() => []);
            const users = [];

            // Batch-fetch all user hashes (max 500)
            for (const key of keys.slice(0, 500)) {
                const data = await kv.hgetall(key).catch(() => null);
                if (data) {
                    users.push({ userId: key.replace('user:', ''), ...data });
                }
            }

            users.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));

            const now = Date.now();
            const stats = {
                total: users.length,
                active24h: users.filter(u => now - new Date(u.lastSeen).getTime() < 86_400_000).length,
                active7d:  users.filter(u => now - new Date(u.lastSeen).getTime() < 604_800_000).length,
                withLocation: users.filter(u => u.lat && u.lon).length,
            };

            const settings = await kv.get('admin:settings').catch(() => null);

            return res.json({ users, stats, settings: settings || getDefaultSettings() });
        } catch (err) {
            console.error('[admin GET]', err);
            return res.status(500).json({ error: 'Failed to fetch admin data' });
        }
    }

    // ── POST: save settings ──────────────────────────────────────────────────
    if (req.method === 'POST') {
        try {
            const { settings } = req.body;
            if (!settings || typeof settings !== 'object') {
                return res.status(400).json({ error: 'settings object required' });
            }
            await kv.set('admin:settings', settings);
            return res.json({ success: true });
        } catch (err) {
            console.error('[admin POST]', err);
            return res.status(500).json({ error: 'Failed to save settings' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
