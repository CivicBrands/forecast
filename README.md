> The system maintains parallel interpretation paths derived from shared observations.  
> These paths are updated iteratively and may diverge or converge over time, rather than being reduced to a single resolved state prematurely.  
> 
> Authoritative outputs and directives are produced as a time-bound coalescence of these paths, weighted according to their state at that point, and shall be acted upon within that context.

# forecast-v2

Time-resolved, multi-source observational field generator.

## What This Is

`forecast-v2` ingests heterogeneous real-world data streams, validates each upstream shape with Zod, persists append-only snapshots, collates fresh cross-source windows, and writes derived latent signals from those collations.

The system has three runtime surfaces:

- **Node local runtime**: polling tick loop, `better-sqlite3` persistence, and HTTP API.
- **Cloudflare Worker**: cron-triggered polling, D1 persistence, public HTTP API, and internal NOTAM ingest endpoint.
- **NOTAM relay**: a separate Node service under `relay/notam/` that holds the FAA SWIM JMS connection and forwards validated NOTAM batches to the Worker.

See `docs/architecture.md`, `docs/api.md`, and `docs/sources.md` for the detailed contracts.

## Current State

- **Polling sources**: METAR, AirNow, FIRMS, HRRR Smoke, NEXRAD, and NLDN through `src/sources/registry.ts`.
- **Push source**: NOTAM through `POST /ingest/notam`, backed by the SWIM relay.
- **Storage**: snapshots, collations, and latents stored in SQLite locally and D1 on Cloudflare.
- **Collation**: latest fresh snapshot per source within `COLLATION_MAX_AGE_MS`; stale sources are omitted, not interpolated.
- **Latents**: derived signals such as `aqi_max`, `visibility_min_sm`, `fire_detection_count`, and `smoke_impacted_aq`.
- **Deployment**: Worker `forecast`, D1 database `forecast`, route `forecast.civicbrands.org/*`, cron `*/5 * * * *`.

## Architecture

```
[Polling APIs]              [FAA SWIM JMS]
     |                            |
[Source Registry]          [relay/notam]
     |                            |
[Zod Validation]           [POST /ingest/notam]
     |                            |
     +-----------> [Snapshot Store] <----------+
                         |
                    [Collation]
                         |
                     [Latents]
                         |
                    [HTTP API]
```

Core invariants:

1. Observations are stored atomically.
2. Upstream field names and response shapes are preserved.
3. Storage is append-only from application code.
4. Stale source absence is meaningful and must not be smoothed or substituted.
5. The public HTTP surface returns stored material; it does not resolve uncertainty.

## Setup

```bash
npm install
```

Create a local `.env` file as needed:

```bash
AIRNOW_API_KEY=your_key_here
FIRMS_MAP_KEY=optional_key_here
HRRR_SMOKE_ENDPOINT=optional_url_here
NEXRAD_STATIONS=optional_station_list
NLDN_TOKEN=optional_token_here
NLDN_ENDPOINT=optional_url_here
```

AirNow API keys are free: https://docs.airnowapi.org/account/request/

Common local configuration:

| Var | Default | Notes |
|---|---:|---|
| `USER_LAT` | `39.0997` | User latitude |
| `USER_LON` | `-94.5786` | User longitude |
| `RADIUS_MILES` | `30` | Source query radius |
| `COLLATION_MAX_AGE_MS` | `3600000` | Freshness cutoff for collation |
| `TICK_MS` | `300000` | Node tick interval |
| `RUN_ONCE` | unset | `1` runs one tick and exits |
| `PORT` | `3000` | Node HTTP port |
| `SERVE` | `1` | `0` skips the Node HTTP server |
| `DB_PATH` | `./data/forecast.db` | Local SQLite path |

Worker configuration comes from `wrangler.toml` `[vars]` and Wrangler secrets. `INGEST_TOKEN` is required for NOTAM relay ingestion.

## Build, Test, Run

```bash
npm run build
npm test
npm run dev
```

Worker commands:

```bash
npx wrangler dev
npx wrangler d1 migrations apply forecast
npx wrangler deploy
```

Relay commands:

```bash
cd relay/notam
npm install
npm run build
npm test
```

## Project Structure

```
src/
  config.ts            Node runtime configuration
  sources/             Source modules and registry
  store.ts             better-sqlite3 snapshots, collations, latents
  collate.ts           Node collation
  latents.ts           Storage-agnostic latent derivation
  server.ts            Node HTTP surface
  index.ts             Node entry: tick loop + optional HTTP server
  worker/
    store.ts           D1 snapshots, collations, latents
    collate.ts         Worker collation
    index.ts           Worker fetch() + scheduled() entry
relay/notam/           FAA SWIM JMS relay
migrations/            D1 schema migrations
test/                  Node test suite
```

## API

Both primary runtimes expose read-only JSON routes:

| Route | Purpose |
|---|---|
| `GET /` | List available endpoints |
| `GET /healthz` | Liveness probe |
| `GET /snapshots/{SOURCE}` | Latest snapshot for a known source |
| `GET /collations/latest` | Latest cross-source collation |
| `GET /latents/latest` | Latest latent rows sharing one timestamp |
| `GET /latents?name={NAME}&limit={N}` | Recent rows for one latent |

The Worker also exposes the internal relay endpoint:

| Route | Purpose |
|---|---|
| `POST /ingest/notam` | Authenticated NOTAM batch ingest from `relay/notam/` |

See `docs/api.md` for response shapes and error semantics.

## Sources

| Source | Mode | Data |
|---|---|---|
| METAR | Polling | Aviation weather observations |
| AIRNOW | Polling | Air quality observations |
| FIRMS | Polling | VIIRS active fire detections |
| HRRR_SMOKE | Polling | Surface and column smoke via configured JSON endpoint |
| NEXRAD | Polling | Latest Level-2 radar scan metadata |
| NLDN | Polling | Subscription-gated lightning detections |
| NOTAM | Push relay | FAA SWIM FNS NOTAM records |

## Roadmap

```
Phase  0  [done]   Mock pipeline (TypeScript + Zod baseline)
Phase  1  [done]   METAR ingestion
Phase  2  [done]   Multi-observation arrays
Phase  3  [done]   Append-only snapshots
Phase  4  [done]   Multi-source ingestion
Phase  5  [done]   Node cadence model
Phase  6  [done]   Collation
Phase  7  [done]   HTTP output surface
Phase  8  [done]   Cloudflare Worker + D1 deployment
Phase  9  [done]   SQLite/D1 persistence
Phase 10  [done]   Source registry
Phase 11  [done]   Additional polling sources
Phase 12  [done]   Latent signal layer
Phase 13  [done]   NOTAM relay + Worker ingest
Phase 14  [ ]      Operational hardening and source quality monitoring
```

See `ETHICS.md` before consuming outputs in safety-relevant contexts.
