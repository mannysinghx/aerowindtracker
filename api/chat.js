import { GoogleGenerativeAI } from '@google/generative-ai';

// Make sure to add GEMINI_API_KEY in your Vercel Environment Variables.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MISSING_KEY');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MISSING_KEY') {
             return res.status(200).json({ reply: "AeroGuard AI is still under construction. Real-time intelligence will be available soon." });
        }

        const { message, context, history } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const systemPrompt = `You are AeroGuard AI, a highly experienced and cautious aviation copilot and weather specialist. 
You are speaking directly to a pilot or dispatcher inside the AeroWind Tracker application. 
Your primary job is to provide specific, actionable insights based on the live METAR and weather data provided to you in the user's context.

CURRENT WEATHER CONTEXT:
${JSON.stringify(context || 'No specific airport selected. Talk generally about aviation weather.')}

 RULES:
 1. Be concise but highly technical. Use pilot phraseology when appropriate.
 2. If the user asks for a recommendation (e.g. "Is it safe?"), DO NOT give a definitive "Go/No-Go" decision, but state the specific risks (e.g., crosswind elements, visibility limitations) based on the context data.
 3. If the context data shows severe winds (>30kts) or bad visibility, warn them proactively.
 4. Do not hallucinate weather data. Only use what is provided in the CURRENT WEATHER CONTEXT.
 5. Format your output nicely using standard text, avoiding complex markdown blockquotes where possible.`;

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt 
        });

        const chat = model.startChat({
            history: history || []
        });

        const result = await chat.sendMessage(message);
        const responseText = result.response.text();

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json({ reply: responseText });
    } catch (error) {
        console.error("Agent CoPilot Error:", error);
        res.status(500).json({ error: 'Internal Server Error engaging AI Copilot.' });
    }
}
