# forecast-v2

Time-resolved, multi-source observational field generator.

## What This Is

An ingestion and validation engine that pulls heterogeneous real-world data streams, preserves atomic observations (pre-aggregation), and maintains temporal and spatial fidelity for downstream latent variable construction.

## Current State

- **METAR** — live aviation weather from aviationweather.gov, geo-resolved via bbox from user coordinates (~6 stations within 30mi of KC)
- **AirNow** — live air quality (O3, PM2.5, PM10) from airnowapi.org, geo-resolved by lat/lon + radius
- **STORE** — in-memory per-source store with `fetched_at`, `observed_at_min`, `observed_at_max`, and validated observation arrays
- **Zod validation** — schemas match real API response shapes, not invented fields
- **Parallel ingestion** — sources fetched concurrently via `Promise.all`

## Architecture

```
[API Sources]
     |
[Fetchers] -----> geo-resolve stations from user lat/lon
     |
[Raw Responses]
     |
[Zod Validation]
     |
[Observation Arrays]
     |
[STORE] (per-source, time-bounded)
     |
[Collation] (not yet implemented)
     |
[Output / API] (not yet implemented)
```

## Design Principles

1. **Atomic observations** — one observation, one location, one timestamp, no aggregation
2. **Source fidelity** — preserve upstream field names; no renaming unless required
3. **Separation of concerns** — ingestion, validation, store, collation, and latent variable layers never collapse into each other
4. **No early aggregation** — no deduplication, weighting, or summarization at ingestion
5. **Geo-resolved, not hardcoded** — station/location IDs derived from user coordinates, never hardcoded

## Setup

```bash
npm install
```

Create a `.env` file:

```
AIRNOW_API_KEY=your_key_here
```

AirNow API keys are free: https://docs.airnowapi.org/account/request/

## Build and Run

```bash
npm run build
node dist/index.js
```

## Project Structure

```
src/
  index.ts    — entry point, STORE, run cycle
  ingest.ts   — per-source fetchers + Zod schemas
.env          — API keys (gitignored)
```

## Sources

### Active
| Source | API | Data |
|--------|-----|------|
| METAR | aviationweather.gov | temp, dewpoint, wind, visibility, clouds, flight category |
| AirNow | airnowapi.org | O3, PM2.5, PM10 AQI by reporting area |

### Planned
| Source | Data |
|--------|------|
| NEXRAD | radar reflectivity, echo tops, storm motion |
| NLDN | lightning events (subscription required) |
| HRRR Smoke | surface/column smoke, wind vectors |
| FIRMS | satellite fire detections |
| NOTAM | airspace restrictions |
| Transport | travel time, delay, incidents |
| Reddit | local subreddit posts |
| News (RSS) | per-source atomic articles |
| Socioeconomic | fuel prices, economic indicators |

## Roadmap

```
Phase  0  [done]   Mock pipeline (TypeScript + Zod baseline)
Phase  1  [done]   Real API fetch (METAR, geo-resolved)
Phase  2  [done]   Multi-observation arrays (came free with bbox query)
Phase  3  [done]   STORE (per-source, time-bounded)
Phase  4  [done]   Multi-source ingestion (METAR + AirNow, parallel)
Phase  5  [ ]      Cadence model (per-source intervals via setInterval)
Phase  6  [ ]      Collation (snapshot of STORE at fixed intervals)
Phase  7  [ ]      Output surface (HTTP endpoint serving snapshots)
Phase  8  [ ]      Domain + edge (forecast.bjl13.org via Cloudflare)
Phase  9  [ ]      Persistence (append snapshots to disk or DB)
Phase 10  [ ]      Latent variable layer (cross-source derived signals)
```

### Constraints

- No new infrastructure before ingestion shape stabilizes
- No UI before collation exists
- No external deployment before multi-source ingestion works
- No schema expansion during structural transitions
