import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { userId, lat, lon } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const timestamp = new Date().toISOString();

        // Store the user tracking data in Vercel KV Redis
        await kv.hset(`user:${userId}`, {
            lat: lat || null,
            lon: lon || null,
            ip,
            lastSeen: timestamp
        });

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json({ success: true, message: 'Tracking data recorded' });
    } catch (error) {
        console.error("Vercel KV Tracking Error:", error);
        res.status(500).json({ error: 'Internal Server Error saving tracking data' });
    }
}
