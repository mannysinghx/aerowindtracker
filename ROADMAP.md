# AeroWind Tracker — Future Feature Map
### Vision: The definitive AI-powered weather intelligence platform for aviation professionals

---

## Current State (v1.0 — Baseline)

| Capability | Status |
|---|---|
| Live METAR / Winds Aloft / PIREPs | ✅ |
| Interactive wind barb map (16k+ stations) | ✅ |
| Multi-agent AI analysis (Wind / Hazard / Trend / Briefing) | ✅ |
| Runway heading + active runway visualization | ✅ |
| Crosswind / taxi deflection controls | ✅ |
| Weather overlays (Radar, Satellite, SIGMETs, Icing, Turbulence) | ✅ |
| Gemini 2.5 Flash AI copilot chat | ✅ |
| Vercel KV pre-loaded cache + 5-min cron refresh | ✅ |
| Rule-based alert feed (wind, fog, system) | ✅ |

---

## Priority Tiers

- **P0 — Critical Foundation** (must-have to serve professional pilots)
- **P1 — Competitive Differentiation** (beats ForeFlight / Garmin Pilot in specific areas)
- **P2 — Market Expansion** (opens new customer segments)
- **P3 — Platform Play** (defensible moat, network effects)

---

## P0 — Critical Foundation

> Without these, professional pilots cannot trust or rely on the platform.

---

### P0.1 — TAF Integration & Forecast Timeline

**What**: Parse and display Terminal Aerodrome Forecasts alongside live METARs. Show a 24-hour weather timeline per airport.

**Why**: Every professional pre-flight involves TAFs. Without them, pilots must leave the app.

**Features**:
- Fetch TAF from `aviationweather.gov/api/data/taf` (same provider, no new credentials)
- Decode raw TAF into structured periods: FM, TEMPO, BECMG, PROB groups
- Visual 24-hour timeline bar per airport (similar to Garmin Pilot's timeline)
- Color-coded blocks: VFR (green) → MVFR (blue) → IFR (red) → LIFR (magenta)
- Overlay expected ceiling and visibility changes on the wind radial
- AI agent summarises TAF changes ("expect IFR conditions after 18Z due to marine layer")

**Tech**: Extend `api/_wx.js` with `fetchTAFs()`, add `TafTimeline` React component, store in `wx:tafs` KV key.

---

### P0.2 — NOTAM Ingestion & Spatial Display

**What**: Display active NOTAMs (Notices to Airmen) as map overlays and airport-specific lists.

**Why**: NOTAM awareness is a legal pilot-in-command responsibility. It's the #1 gap vs. ForeFlight.

**Features**:
- Integrate FAA NOTAM API (public, no key required at basic tier)
- Spatial clustering: show NOTAM count badges on airports
- Click airport → see prioritised NOTAM list (TFRs, NAVAID outages, runway closures, airspace)
- TFR polygons rendered as red overlay on map (identical to SIGMETs pattern already in use)
- AI NOTAM Digest agent: "KPAE has 3 NOTAMs. RWY 16R CLSD 0800-1200Z. ILS out of service until NOTAM 2026-00341 expires."
- Filter NOTAMs by type: Airspace / Navigation / Obstacle / Aerodrome / FDC

**Tech**: New `api/notams.js` endpoint, new `NotamLayer` component in `WeatherOverlay.jsx`, store at `wx:notams` KV key (30-min TTL since NOTAMs change less frequently than METARs).

---

### P0.3 — Offline PWA Mode with Background Sync

**What**: Full offline capability — last known weather data available when no internet connection.

**Why**: Pilots operate in FBOs, ramps, and rural airports with poor connectivity. An app that goes blank is worthless.

**Features**:
- Service Worker (`/sw.js`) caching all static assets + last API response
- Background Sync API: queue METAR refresh when connection restored
- Offline banner: "Showing data from [timestamp]. Reconnecting..."
- IndexedDB for last 3 weather snapshots (allows manual time comparison)
- PWA install prompt (already has manifest.json — just needs service worker)
- Cache `wx:data` and `agents:cache` locally for 60-minute offline coverage

**Tech**: Add `vite-plugin-pwa`, configure `workbox` strategy (NetworkFirst with fallback). Already has PWA manifest.

---

### P0.4 — Aircraft Performance Profiles

**What**: Let pilots enter their aircraft's crosswind limit and performance data. All runway analysis is personalised.

**Why**: A Cessna 172 pilot and a Boeing 737 captain need completely different crosswind advisories.

**Features**:
- Aircraft profile modal: max crosswind, max tailwind, cruise altitude, category (A/B/C/D)
- Saved locally (localStorage + optional cloud sync if user account added later)
- Crosswind calculator: "RWY 16R — 8.2 kt crosswind component — within your 15 kt limit ✅"
- Active runway scoring: rank all runways by how well they suit the pilot's aircraft, not just best headwind
- Wind component display: headwind / crosswind / tailwind components shown numerically
- Color-coded runway labels: green (within limits) / orange (approaching limit) / red (exceeds limit)

**Tech**: New `AircraftProfile` component, extend `getBestRunway()` with max-crosswind constraint, integrate with `CrosswindControls.jsx`.

---

### P0.5 — Multi-Region Coverage Expansion

**What**: Extend beyond continental US to Alaska, Hawaii, Caribbean, and Canada.

**Why**: A significant portion of general aviation operates in these regions. Alaska is the highest per-capita GA state.

**Features**:
- Add Alaska METAR bbox (all latitudes above 54°N)
- Hawaiian Islands bbox
- Caribbean / ETOPS coverage
- Canada via Nav Canada METAR API (public)
- Puerto Rico / USVI
- Map center auto-detection by browser geolocation on first load
- Regional alert calibration (Alaska mountain wave thresholds are different)

**Tech**: Extend `BBOXES` array in `api/_wx.js`, update map center logic, add Nav Canada as additional METAR source.

---

## P1 — Competitive Differentiation

> Features where AeroWind is uniquely positioned to beat established players.

---

### P1.1 — Predictive Hazard AI (ProactiveAgent)

**What**: A fifth AI agent that uses trend data to predict hazards 30–90 minutes before they develop.

**Why**: Current tools show current conditions. AeroWind can show what's about to happen — a genuine first-mover advantage.

**Features**:
- Extend TrendAgent with multi-cycle memory (store last 6 cycles = 30 min of trends in KV)
- Predict fog: if temp/dew spread narrowing at >0.5°C / 5min AND calm winds → "KOAK likely IFR in 25–40 min"
- Predict wind shift: track direction rotation rate → "expect 40° directional shift at KSFO by 1530Z"
- Predict convective build-up: if satellite IR cloud tops cooling rapidly + PIREP clusters forming
- Confidence intervals shown (70% / 85% / 95% confidence)
- "Condition Expected In" countdown timer on alert card
- Gemini synthesises predictions into a ProactiveAlert with specific time windows

**Tech**: Extend `agents:prev_ground` to store an array of 6 snapshots (ring buffer in KV), add `runProactiveAgent()` function, new `ProactiveAlert` UI component with countdown.

---

### P1.2 — Route Analysis & Go/No-Go Assessment

**What**: Draw a flight route on the map. AeroWind analyses weather along the entire route and gives a structured Go/No-Go assessment.

**Why**: Pre-flight weather is always route-based, not just airport-based. This is the most-requested feature in pilot forums.

**Features**:
- Click-to-draw route on map (waypoints with drag-handles)
- Or paste flight plan (ICAO format: KSEA RADDY ROBER KPDX)
- Route weather corridor: shows METARs within 50 nm of route
- Altitude-specific wind profile along route (from aloft data)
- Icing risk zones highlighted on route
- SIGMET / TFR intersections detected and flagged
- Go/No-Go Gemini report: structured assessment with legal minimum references
- Fuel burn impact: estimated headwind / tailwind component for cruise leg
- Output: printable PDF briefing (Gemini-generated, ForeFlight-compatible format)

**Tech**: New `RouteAnalysis` component with Leaflet polyline drawing, corridor search algorithm on `ground` stations, new `/api/route` endpoint.

---

### P1.3 — Audio Situational Awareness

**What**: Text-to-speech weather briefings and push notifications for developing hazards.

**Why**: Pilots are often in the cockpit with hands on controls. Eyes-free weather updates are a safety multiplier.

**Features**:
- "Read Briefing" button: Web Speech API reads the BriefingAgent synthesis aloud
- Configurable voice: gender, speed, accent
- "Monitor Mode": background audio alert when HIGH severity condition enters route corridor
- ATIS-style phonetic readout: "Wind one-five-zero at five. Gusts niner. Active runway one-six-right."
- Browser Push Notifications (requires permission): "⚠️ Wind shear detected between KSEA and KPAE"
- Notification scheduling: alert me 1 hour before departure if conditions change

**Tech**: Web Speech API (no external service), Notification API + Service Worker for push, new `AudioBriefing` component.

---

### P1.4 — Real-Time ATIS / D-ATIS Integration

**What**: Fetch and display actual ATIS broadcasts for airports that publish them digitally.

**Why**: ATIS is the ground truth that pilots actually use. Showing it removes the need to switch apps.

**Features**:
- FAA D-ATIS API integration (free, ~500 major US airports have digital ATIS)
- Display current ATIS letter code prominently in station panel ("Information ALPHA")
- ATIS text displayed in monospace phonetic aviation format
- Compare ATIS ceiling/visibility to METAR (flag discrepancies)
- ATIS-aware AI: copilot knows the actual ATIS information when answering questions
- Auto-refresh ATIS every 20 minutes (ATIS updates less frequently than METARs)

**Tech**: New `api/atis.js` endpoint hitting FAA D-ATIS service, display in `StationPanel` component, store in `wx:atis:{icaoId}` KV keys.

---

### P1.5 — Visual Approach Path Overlay

**What**: Render instrument approach paths (ILS, LPV, RNAV, VOR) as lines on the map, with weather-based usability assessment.

**Why**: When ceiling is 800 ft at destination, pilots need to know which approach they can fly. This is deeply visual and hard to do in text-only tools.

**Features**:
- Parse FAA approach procedure database (public CIFP — Coded Instrument Flight Procedures)
- Render ILS glide slopes and localizer courses as overlay lines
- Colour code by current weather usability:
  - Green: ceiling and vis above published minimums
  - Orange: within 200 ft / 0.5 SM of minimums
  - Red: below minimums — approach not legal
- Show Decision Altitude / Minimum Descent Altitude on hover
- AI commentary: "ILS RWY 16R at KPAE: Ceiling 800 ft OVC, minimum 200 ft. 600 ft margin. Approach viable."
- Filter by aircraft category

**Tech**: CIFP file parsing (large binary — host on CDN, load lazily), new `ApproachOverlay` Leaflet layer.

---

### P1.6 — Collaborative Real-Time Dispatch Mode

**What**: A shared-screen mode where dispatchers and pilots see the same live weather picture simultaneously.

**Why**: Part-135 and regional operators need dispatchers and pilots on the same page. No tool does this well today.

**Features**:
- Generate shareable room code (6-character): "Join room ALPHA7"
- WebSocket sync: both users see the same selected airport, same route, same alerts in real-time
- Dispatcher can annotate map (text notes, drawn circles) visible to pilot
- Chat sidebar with timestamped messages (separate from AI copilot)
- Release authority: dispatcher explicitly approves departure ("DISPATCH RELEASE ISSUED 1542Z")
- Session export: full weather + chat log as PDF for ops record-keeping

**Tech**: Vercel WebSockets / Ably Realtime, session state in Vercel KV, new `/api/room` endpoint.

---

### P1.7 — Logbook-Integrated Flight Debrief

**What**: After a flight, automatically generate a weather debrief using historical METAR data and compare it to the pre-flight forecast.

**Why**: Unique to AeroWind. Pilots learn from post-flight analysis, and no existing tool closes this loop.

**Features**:
- Archive last 24 hours of METAR data in KV / Postgres (store compact snapshots hourly)
- Pilot inputs: departure airport, destination, takeoff time, landing time
- App shows what the weather actually was during the flight vs. what was forecast (TAF)
- Highlights any conditions that exceeded aircraft limits during the flight
- AI debrief: "Actual ceiling at KSEA was 400 ft lower than TAF forecast. TrendAgent had predicted this degradation at 1523Z."
- Output: Pilot logbook weather note (formatted for paper or digital logbook)

**Tech**: New `api/archive.js` that stores hourly snapshots to Vercel Postgres (better than KV for time-series), `FlightDebrief` component.

---

## P2 — Market Expansion

> Opens the platform to new customer segments and revenue streams.

---

### P2.1 — User Accounts & Personalisation

**What**: Optional sign-in (email / Google OAuth) for saving preferences, aircraft profiles, and favourite airports.

**Why**: Logged-in users are retained users. Personalisation increases daily active use.

**Features**:
- Auth: Clerk or Auth.js (Next.js-compatible, works with Vercel)
- Saved: Aircraft profile, home airport, favourite airports (starred), custom alert thresholds
- Cross-device sync: settings follow the pilot across phone and desktop
- "My Airports" dashboard: quick access to all starred airports with one-glance weather
- Alert subscriptions: email/SMS when conditions change at saved airports
- Flight plan history: review past routes and weather

**Tech**: Clerk auth, Vercel Postgres for user data, extend `api/tracking.js` → `api/user.js`.

---

### P2.2 — API & Embeddable Widget (Developer Platform)

**What**: Expose AeroWind's intelligence as a REST API and embeddable widget for other aviation apps.

**Why**: Platform plays generate compounding revenue and distribution. FBOs, flight schools, and aviation blogs could embed AeroWind.

**Features**:
- Public API: `GET /api/v1/station/{icao}` — returns METAR + AI analysis for any airport
- Route API: `POST /api/v1/route` — accepts waypoints, returns corridor weather + Go/No-Go
- Embeddable widget: `<script src="aerowind.io/embed.js" data-icao="KSEA"></script>`
- API key management dashboard (rate limits per tier)
- Pricing tiers: Free (100 calls/day) / Pro ($49/mo, 10k calls) / Enterprise

**Tech**: API key middleware in Vercel functions, rate limiting via KV counters, iframe-safe embed bundle.

---

### P2.3 — Mobile Native App (React Native)

**What**: Native iOS and Android apps sharing the same API backend.

**Why**: Pilots prefer mobile. A native app with offline support, push alerts, and Apple/Google Wallet integration beats a PWA for daily use.

**Features**:
- React Native with react-native-maps (uses existing business logic)
- Native push notifications via APNs / FCM (better than web push)
- Apple Watch / WearOS companion: glanceable airport weather
- Home screen widgets (iOS 16+ / Android 12+)
- Background location: auto-suggest nearest airport as position changes
- Siri / Google Assistant shortcuts: "Hey Siri, check weather at KSEA"

**Tech**: Expo managed workflow, shared `services/api.js` as a package, `@react-native-maps/leaflet` alternative.

---

### P2.4 — Flight School & Instructor Tools

**What**: Multi-student dashboard for flight instructors; student weather go/no-go assignments.

**Why**: Flight schools are high-volume, repeat users. Each school is a multiplier of individual pilot accounts.

**Features**:
- Instructor dashboard: see all students' home airports on one map
- Weather assignment: "Today's pre-flight exercise: brief KSEA → KBLI. Submit your go/no-go."
- Student submissions reviewed by AI first, then instructor
- AI grading rubric: checks if student identified all significant hazards
- Curriculum integration: weather modules linked to FAA ACS (Airman Certification Standards)
- Progress tracking: student weather decision quality over time

**Tech**: New school/instructor/student account types in Postgres, `Classroom` component, Gemini grading prompt.

---

### P2.5 — Drone & UAS Operators

**What**: Dedicated mode for drone pilots with relevant data: low-altitude wind gradients, airspace restrictions, LAANC integration.

**Why**: Drone operators are the fastest-growing aviation segment. FAA Part 107 pilots need weather too, but current tools are overkill for them.

**Features**:
- UAS mode toggle: UI simplifies to low-altitude data (surface to 400 ft AGL)
- Surface wind gradient: show wind speed/direction at 50 ft, 100 ft, 200 ft, 400 ft
- LAANC airspace grid overlay (from FAA DroneZone API)
- Gust factor analysis: "8 kt gusts — exceeds recommended limit for DJI Mini 3"
- No-fly zone alerts: airports, stadiums, national parks, TFRs
- One-click LAANC authorisation link for Part 107 pilots

**Tech**: New `UAS_MODE` app state, altitude bands 0–400 ft in aloft data interpolation, FAA DroneZone API integration.

---

## P3 — Platform Play

> Long-term defensible moat features that create network effects and data advantages.

---

### P3.1 — Crowdsourced Pilot Weather Reports (PilotWeather Network)

**What**: In-app PIREP submission. Pilots report conditions they encounter; reports appear on map within 60 seconds.

**Why**: FAA PIREPs are sparse and slow. A crowdsourced network of thousands of AeroWind pilots creates a real-time layer no competitor can replicate.

**Features**:
- One-tap PIREP submission: "I'm at FL095 — tap: smooth / light chop / moderate chop / severe / icing"
- Optional voice input (Speech-to-Text via Web Speech API)
- Automatic location from GPS / IP
- Displayed on map as coloured markers (different icon from official PIREPs)
- AI validation: Gemini checks submission is plausible given nearby METARs (rejects nonsense)
- Verified pilot badge: enhanced credibility for frequent accurate reporters
- API feed: expose crowdsourced PIREPs to other apps (data network effect)
- Privacy: only approximate location shared (5 nm grid snapping)

**Tech**: `api/crowd_pirep.js`, Vercel Postgres for persistence, WebSocket broadcast to connected clients, moderation queue.

---

### P3.2 — Predictive Delay Intelligence

**What**: Predict ground delays and departure queue times at major airports using weather + historical traffic patterns.

**Why**: Weather causes 70% of all US flight delays. Predicting delays before they're official is a massive value-add for commercial-aware GA/charter operators.

**Features**:
- Integrate FAA ASDI (Aviation System Performance Metrics) delay data
- ML model: correlate weather patterns (ceiling, vis, wind, convection) with historical delays at each airport
- Show Ground Delay Programs (GDP) and Ground Stop predictions 1–2 hours ahead
- En route advisory: "If you depart now, KJFK departure queue is 45 min. Wait 2 hours for likely queue reduction."
- Alert: "KEWR likely entering GDP within 60 min based on current trend + historical model"

**Tech**: Train a lightweight model (scikit-learn or TensorFlow.js) on public BTS and FAA data, serve predictions via `/api/delays` endpoint, cache in KV.

---

### P3.3 — ForeFlight / Garmin Pilot / SkyDemon Integration

**What**: Two-way data exchange with existing EFB platforms pilots already use.

**Why**: Pilots won't abandon ForeFlight entirely. But they will add AeroWind if it enhances their existing workflow. Integration is the fastest growth channel.

**Features**:
- ForeFlight Sharing API: push AeroWind route weather analysis as a ForeFlight "Moment"
- Garmin Pilot Sync: export AeroWind-selected airport weather to active Garmin session
- SkyDemon UK integration: UK/European extension (EUROCONTROL METARs + EuroFIR NOTAMs)
- GDL 90 / ADS-B In: read traffic from Stratus / Sentry portables into AeroWind map
- Export: download current weather briefing as a standard PDF or JSON

**Tech**: ForeFlight URL scheme (`foreflight://`), deep links, PDF generation with `jsPDF`.

---

### P3.4 — Regulatory Compliance Engine

**What**: Automatically check proposed flights against FAA regulations and operator minimums.

**Why**: Part-91 has weather minimums. Part-135 has stricter ones. Operators get fined for non-compliance. Automating this check removes liability.

**Features**:
- User selects their operating certificate: Part 91 / 61 / 135 / 121
- App knows applicable minima (ceiling, vis, alternate requirements)
- For each leg: "LEGAL ✅ Ceiling 1500 ft, minima 1000 ft" or "NOT LEGAL ❌ Vis 1.2 SM, minima 3 SM"
- Alternate airport finder: automatically suggests qualifying alternates within range
- Fuel reserve check: current winds → estimated burn → fuel required for alternate
- Dispatch release generation (Part-135 format): AI drafts legal weather release

**Tech**: FAA regulation database as JSON (static, updated quarterly), compliance engine as pure function, Gemini for plain-language explanation.

---

### P3.5 — Insurance & Safety Analytics Dashboard (Fleet Operators)

**What**: For flight schools, charter operators, and corporate flight departments — aggregate safety analytics across all operations.

**Why**: Insurance companies and safety managers need systemic weather risk data. This opens a new B2B revenue stream with high LTV customers.

**Features**:
- Fleet dashboard: all company aircraft / airports on one map
- Weather exposure score: what % of flights operated in marginal conditions last 90 days
- Near-miss log: flights that encountered conditions outside aircraft limits (auto-detected from logbook integration)
- SMS (Safety Management System) report generation: monthly AI weather risk report
- Trend analysis: improving or worsening weather decision quality over time
- Benchmark: compare to industry averages
- Export: formats compatible with WYVERN, IS-BAO, ARG/US

**Tech**: Organisation account type, fleet data in Postgres, Gemini-generated reports, scheduled weekly email via Resend.

---

## Infrastructure & Technical Roadmap

### Data & Performance
- [ ] **Vercel Postgres**: Replace KV for time-series data (METAR archives, user data, crowdsourced PIREPs)
- [ ] **Edge Functions**: Move read-only endpoints to Vercel Edge (sub-10ms globally)
- [ ] **Gzip compression**: Compress API responses (saves 60–70% bandwidth on large METAR datasets)
- [ ] **WebSocket real-time**: Push weather updates to all connected clients without polling
- [ ] **Image CDN**: Store radar snapshots for playback/animation on Vercel Blob
- [ ] **Rate limiting**: KV-based rate limiter on all public API endpoints

### AI & Intelligence
- [ ] **Fine-tuned aviation model**: Fine-tune Gemini / Llama on FAA weather decision case studies
- [ ] **Multi-model routing**: Use lightweight model for simple queries, full model for route analysis
- [ ] **Structured outputs**: Switch all Gemini calls to `response_mime_type: "application/json"` (more reliable than regex parsing)
- [ ] **Embedding search**: Store all PIREPs as vectors (Pinecone) for semantic similarity search ("find PIREPs similar to this icing report")
- [ ] **Confidence calibration**: Track agent prediction accuracy over time; surface confidence scores

### Developer Experience
- [ ] **Monorepo**: Separate packages — `@aerowind/core`, `@aerowind/agents`, `@aerowind/ui`
- [ ] **TypeScript migration**: Full type safety for all components and API contracts
- [ ] **E2E tests**: Playwright tests for critical paths (search → select → verify data)
- [ ] **Storybook**: Component library for UI consistency as team grows
- [ ] **OpenAPI spec**: Auto-generate from route handlers for public API documentation

---

## Competitive Positioning

| Feature | AeroWind | ForeFlight | Garmin Pilot | Windy |
|---|---|---|---|---|
| AI multi-agent analysis | ✅ | ❌ | ❌ | ❌ |
| Predictive hazard alerts | 🔜 P1.1 | ❌ | ❌ | ❌ |
| Route Go/No-Go AI | 🔜 P1.2 | Manual | Manual | ❌ |
| Real-time wind barbs | ✅ | ✅ | ✅ | ✅ |
| Crowdsourced PIREPs | 🔜 P3.1 | ❌ | ❌ | ❌ |
| Compliance engine | 🔜 P3.4 | ❌ | ❌ | ❌ |
| Offline PWA | 🔜 P0.3 | ✅ native | ✅ native | ⚠️ |
| TAF display | 🔜 P0.1 | ✅ | ✅ | ❌ |
| NOTAMs | 🔜 P0.2 | ✅ | ✅ | ❌ |
| Price | Free → Freemium | $99–179/yr | $75–110/yr | Free |

**AeroWind's unfair advantages:**
1. AI-native from day one — competitors are retrofitting AI onto 15-year-old codebases
2. Sub-100ms response from pre-loaded KV cache — faster than any competitor
3. Open web platform — no app store, instant updates, shareable links
4. Crowdsourced PIREP network (when built) — unique real-time data no competitor can buy

---

## Suggested Development Order

```
Q1 2026 — Foundation (P0)
  ├── P0.1 TAF integration
  ├── P0.2 NOTAM display
  ├── P0.3 Offline PWA
  └── P0.4 Aircraft profiles

Q2 2026 — Differentiation (P1)
  ├── P1.1 Predictive hazard AI (ProactiveAgent)
  ├── P1.2 Route analysis & Go/No-Go
  ├── P1.3 Audio situational awareness
  └── P1.4 D-ATIS integration

Q3 2026 — Scale (P2 + P3 begins)
  ├── P2.1 User accounts
  ├── P1.6 Collaborative dispatch mode
  ├── P3.1 Crowdsourced PIREP network (beta)
  └── P0.5 Coverage expansion (Alaska, Canada)

Q4 2026 — Platform (P2 + P3)
  ├── P2.2 Developer API & embeddable widget
  ├── P3.4 Regulatory compliance engine
  ├── P2.3 Mobile native app (iOS beta)
  └── P3.2 Predictive delay intelligence
```

---

*Document generated: 2026-03-26*
*Version: 1.0*
*Next review: Q2 2026*
