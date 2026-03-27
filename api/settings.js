import { kv } from '@vercel/kv';
import { getDefaultSettings } from './admin.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const settings = await kv.get('admin:settings').catch(() => null);
        return res.json(settings || getDefaultSettings());
    } catch (err) {
        return res.json(getDefaultSettings());
    }
}
