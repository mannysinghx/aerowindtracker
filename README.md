# AeroWind Tracker

> AI-powered aviation weather intelligence — live wind analysis, multi-agent hazard detection, and pilot briefings for 16,000+ US airports.

---

## Overview

AeroWind Tracker is a real-time aviation weather platform built for pilots, dispatchers, and aviation personnel. It combines live FAA weather data with a multi-agent AI system powered by Google Gemini to deliver automated hazard analysis, active runway advisories, and natural-language pilot briefings — refreshed every 5 minutes, served from a pre-loaded Redis cache so every user gets sub-100ms responses.

**This is not a certified weather service. Not for real-world flight planning. Always verify conditions with official FAA sources (ATIS, ForeFlight, 1800wxbrief.com).**

---

## Features

### Live Weather Map
- Interactive wind barb map covering 16,000+ continental US airports
- Wind speed colour coding: Green (<5 kt) → Blue (5–15) → Orange (15–25) → Red (25–40) → Purple (>40)
- Altitude selector: Ground, 3k, 6k, 9k, 12k, 18k ft (winds aloft from FAA)
- 4 base map styles: Dark, Light, Hybrid, Terrain

### Runway & Wind Analysis
- Runway headings rendered directly on the map (visible at zoom ≥ 10)
- Active runway computed automatically — best headwind for current wind direction
- Small plane icon positioned at the active runway threshold
- Wind radial with 360° compass rose, chevron flow indicator, and bright FROM-indicator
- Crosswind controls panel: aileron/elevator/rudder deflection for taxi, yoke position diagram

### Weather Overlays
- Live radar (RainViewer)
- Infrared satellite (NASA GIBS / GOES East)
- Icing PIREPs (altitude-selectable FL030–FL240)
- Turbulence PIREPs (FL030–FL340)
- SIGMETs (polygon geometry from AWC)

### Multi-Agent AI Analysis
Four autonomous AI agents run every 5 minutes:

| Agent | What it does |
|---|---|
| **WindAgent** | Detects wind shear between stations, mountain wave conditions, extreme surface winds |
| **HazardAgent** | Identifies IFR clusters, icing risk zones, fog formation, PIREP hazard clusters |
| **TrendAgent** | Compares current vs previous METAR cycle — detects rapid wind changes, IFR degradation, pressure drops |
| **BriefingAgent** | Gemini 2.5 Flash synthesises all findings into a 3–4 sentence pilot briefing |

Agent findings appear as map overlays (shear corridors, hazard polygons) and as a structured alert feed.

### AI Copilot Chat
- Powered by Gemini 2.5 Flash
- Context-aware: knows the selected airport's current METAR and active alerts
- Uses proper pilot phraseology
- Maintains up to 12 messages of conversation history
- Refuses to hallucinate weather data or issue definitive go/no-go

### Alert System
- Rule-based alerts: `SEVERE_WIND` (≥35 kt sustained / ≥45 kt gusts), `VISIBILITY` (fog prediction from temp/dew spread), `SYSTEM`
- Severity levels: HIGH (red), MEDIUM (orange), INFO (grey)
- Clickable alerts fly the map to the affected station

### Airport Search
- Real-time autocomplete across 16,000+ US airports
- ID-first matching (KSEA, KJFK) then name-based
- Smooth fly-to animation with automatic zoom

---

## Architecture

```
Browser (React 19 + Leaflet)
    │
    ├─ /api/data      ← METARs, aloft, PIREPs, alerts
    ├─ /api/agents    ← 4-agent AI analysis
    ├─ /api/chat      ← Gemini copilot
    └─ /api/tracking  ← Anonymous session (KV)

Vercel Serverless Functions (Node.js ES modules)
    │
    ├─ api/_wx.js         ← Shared fetch utilities (METARs, aloft, PIREPs, alerts)
    ├─ api/data.js        ← /api/data handler
    ├─ api/agents.js      ← /api/agents handler (WindAgent, HazardAgent, TrendAgent, BriefingAgent)
    ├─ api/chat.js        ← /api/chat handler
    ├─ api/refresh.js     ← Cron endpoint (pre-populates KV every 5 min)
    └─ api/tracking.js    ← /api/tracking handler

Cache (3 layers)
    L1  In-memory (5-min TTL, warm container, ~0ms)
    L2  Vercel KV / Redis (10-min TTL, cross-container, ~5ms)
    L3  Live FAA fetch (fallback, first cold start only)

Cron (vercel.json)
    */5 * * * *  →  /api/refresh
                     ├─ buildWeatherData() → wx:data
                     └─ runAgents()        → agents:cache
```

### Cache Keys (Vercel KV)

| Key | Content | TTL |
|---|---|---|
| `wx:data` | METARs + aloft + alerts + PIREPs | 10 min |
| `agents:cache` | All 4 agent results | 10 min |
| `agents:prev_ground` | Previous METAR snapshot (TrendAgent) | 10 min |
| `user:{uuid}` | Anonymous session (lat, lon, IP) | permanent |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Leaflet 1.9, react-leaflet 5 |
| Backend | Vercel Serverless Functions (Node.js ES modules) |
| AI / LLM | Google Gemini 2.5 Flash (`@google/generative-ai`) |
| Cache / DB | Vercel KV (Redis) |
| Weather Data | FAA aviationweather.gov (METARs, aloft, PIREPs, SIGMETs) |
| Radar | RainViewer (free) |
| Satellite | NASA GIBS GOES East WMS |
| Hosting | Vercel |
| Icons | lucide-react |
| Local dev | Express 5 (`server.js`) |

---

## Project Structure

```
├── api/
│   ├── _wx.js          # Shared weather utilities (bboxes, fetch, alerts)
│   ├── agents.js       # /api/agents — 4 AI agents + KV cache
│   ├── chat.js         # /api/chat — Gemini copilot
│   ├── data.js         # /api/data — weather data + KV cache
│   ├── refresh.js      # /api/refresh — cron pre-loader
│   └── tracking.js     # /api/tracking — session tracking
├── public/
│   ├── us_airports.json    # 16k+ US airports (id, name, lat, lon)
│   ├── us_runways.json     # Runway headings and identifiers
│   ├── manifest.json       # PWA manifest
│   └── favicon.svg
├── src/
│   ├── App.jsx             # Main app — state, map, markers, wind radial
│   ├── App.css             # Theme variables, glassmorphic styles
│   ├── constants.js        # Map styles, altitude levels
│   ├── services/
│   │   └── api.js          # Client-side fetch with fallback
│   └── components/
│       ├── AgentDashboard.jsx      # Agent findings card UI
│       ├── AgentMapOverlay.jsx     # Leaflet shapes for agent findings
│       ├── CrosswindControls.jsx   # Taxi wind deflection panel
│       ├── MobileToggleBtn.jsx     # Mobile menu toggle
│       ├── SidebarLeft.jsx         # Alert feed + search
│       ├── SidebarRight.jsx        # Alt selector, font size, map style
│       └── WeatherOverlay.jsx      # Radar, satellite, PIREP, SIGMET layers
├── server.js               # Express server for local development
├── vercel.json             # Cron, rewrites, security headers
├── vite.config.js
├── eslint.config.js
├── ROADMAP.md              # Strategic feature roadmap
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com) API key (free tier works)
- A [Vercel](https://vercel.com) account (for KV and deployment)

### Local Development

```bash
# 1. Clone the repo
git clone https://github.com/mannysinghx/aerowindtracker.git
cd aerowindtracker

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env.local
# Edit .env.local with your keys (see Environment Variables section)

# 4. Start the Vite dev server
npm run dev
# → http://localhost:5173

# 5. (Optional) Start the Express API server for local backend testing
npm start
# → http://localhost:3001
```

> In development, the Vite dev server proxies `/api/*` requests to `localhost:3001` where the Express server runs the same handlers. The Vercel KV cache degrades gracefully — data is fetched live from aviationweather.gov when KV is unavailable.

### Build for Production

```bash
npm run build
# Output: dist/
```

---

## Deployment (Vercel)

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/mannysinghx/aerowindtracker)

### Manual Deployment

```bash
npm install -g vercel
vercel --prod
```

### Environment Variables

Set these in **Vercel → Project Settings → Environment Variables**:

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key — get one at [aistudio.google.com](https://aistudio.google.com) |
| `CRON_SECRET` | Recommended | Secret for securing `/api/refresh`. Generate with `openssl rand -hex 32` |
| `KV_REST_API_URL` | Auto | Set automatically when you link a Vercel KV store |
| `KV_REST_API_TOKEN` | Auto | Set automatically when you link a Vercel KV store |

### Setting up Vercel KV

```bash
# Install Vercel CLI
npm install -g vercel

# Link KV store to your project
vercel link
vercel env pull  # pulls KV credentials to .env.local
```

Or in the Vercel dashboard: **Storage → Create → KV → Link to project**.

### Cron Job

The cron job (`/api/refresh`) is defined in `vercel.json` and runs automatically every 5 minutes on Vercel's infrastructure. No additional setup required. It pre-populates the KV cache before any user makes a request.

To manually trigger a cache refresh:
```bash
curl -X POST https://your-app.vercel.app/api/refresh \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Data Sources

All weather data is sourced from publicly available FAA APIs — no API keys required for weather data.

| Source | Data | Endpoint |
|---|---|---|
| [aviationweather.gov](https://aviationweather.gov) | METARs | `/api/data/metar?bbox=...&format=json` |
| [aviationweather.gov](https://aviationweather.gov) | Winds Aloft | `/api/data/windtemp?region=all&level=low` |
| [aviationweather.gov](https://aviationweather.gov) | PIREPs | `/api/data/aircraftreport?format=json` |
| [aviationweather.gov](https://aviationweather.gov) | SIGMETs | AWC GeoJSON endpoint |
| [RainViewer](https://www.rainviewer.com) | Radar tiles | Free, no key |
| [NASA GIBS](https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs) | Satellite IR | Free WMS |
| [FAA](https://www.faa.gov/air_traffic/flight_info/aeronav/) | Airports + Runways | Bundled as static JSON (`public/`) |

---

## AI Agent Details

### WindAgent
Analyses surface METAR pairs within 80 km for:
- **Wind shear**: speed diff >15 kt OR directional shift >45° (HIGH if >90°/25 kt)
- **Mountain wave**: aloft winds ≥60 kt at 12,000 ft or ≥80 kt at 18,000 ft
- **Extreme winds**: surface sustained ≥40 kt

### HazardAgent
Scans the full METAR dataset for:
- **IFR clusters**: 3+ airports with visibility <3 SM within 300 nm
- **Icing risk**: temperature −10°C to +2°C with temp/dew spread <4°C
- **Widespread fog**: 6+ stations with temp/dew spread ≤3°C and calm winds
- **PIREP clusters**: grouped icing/turbulence reports by altitude band

### TrendAgent
Compares current METAR cycle to previous (stored in KV as `agents:prev_ground`):
- **Rapid wind change**: ≥12 kt increase in 5 minutes (HIGH if ≥20 kt)
- **IFR degradation**: visibility dropping from ≥5 SM to <3 SM
- **Pressure drop**: altimeter falling ≥0.04 inHg at 4+ stations

### BriefingAgent
Sends all findings to Gemini 2.5 Flash with a pilot-focused system prompt. Returns a 3–4 sentence professional briefing leading with the most operationally significant hazard. Falls back to a static text briefing if the Gemini key is unavailable.

---

## Runway Analysis

Active runway selection uses a headwind-optimisation algorithm:

```js
// getBestRunway: returns the runway end with the smallest angular
// difference between the runway heading and the wind direction.
// This maximises headwind component (safest takeoff/landing condition).
function getBestRunway(runways, windDir) {
  let best = null, minDiff = Infinity;
  for (const rw of runways) {
    const heading = rw.le_heading;
    if (heading === null) continue;
    let diff = Math.abs(windDir - heading) % 360;
    if (diff > 180) diff = 360 - diff;
    const oppDiff = Math.abs(180 - diff);
    const effective = Math.min(diff, oppDiff);
    if (effective < minDiff) { minDiff = effective; best = rw; }
  }
  return best ? best.le_ident : null;
}
```

The wind radial uses SVG with `overflow: visible` and a 260px diameter (radius 130) drawn on a 32×32 viewBox. The coordinate transform: `arrowRot = (windDir + 180) % 360` rotates the TO arrow so it points in the direction the wind is travelling.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes — run `npm run lint` before committing
4. Push and open a pull request

Please read [ROADMAP.md](./ROADMAP.md) for planned features before building something new — it may already be scoped.

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the full strategic feature map covering:
- **P0** — TAF integration, NOTAM display, offline PWA, aircraft performance profiles
- **P1** — Predictive hazard AI, route Go/No-Go analysis, audio alerts, D-ATIS
- **P2** — User accounts, developer API, mobile native app, flight school tools
- **P3** — Crowdsourced PIREP network, compliance engine, delay prediction

---

## Disclaimer

**AeroWind Tracker is an experimental, AI-driven demonstration interface.**

All meteorological insights, METAR interpolations, runway heading projections, aerodynamic taxi vectors, and system alerts are generated by artificial intelligence and rule-based algorithms. This system is prone to hallucinations, data delays, and miscalculations.

Pilots, dispatchers, and aviation personnel **MUST NOT** substitute this application for official flight briefings. Always verify conditions against official FAA-approved primary sources — ATIS/AWOS recordings, [aviationweather.gov](https://aviationweather.gov), [1800wxbrief.com](https://www.1800wxbrief.com), or ForeFlight — before making any flight decisions.

The developers disclaim all liability for decisions made based on information from this platform.

---

## License

MIT — see [LICENSE](./LICENSE) for details.

---

*Built with React 19 · Gemini 2.5 Flash · Vercel KV · aviationweather.gov*
