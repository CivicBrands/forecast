# CLAUDE.md

Internal map of the `forecast-v2` repo for future contributors (human or agent).

## What this is

A time-resolved, multi-source observational field generator. Sources are fetched on a cadence, validated with Zod, persisted as atomic snapshots, and collated into time-windowed cross-source indexes. Runs both as a long-lived Node process (local dev) and as a Cloudflare Worker with a cron trigger (production). See `docs/architecture.md` for the data flow and `docs/api.md` for endpoints.

## Repo map

```
src/
  config.ts            env-driven config for the Node entry
  sources/
    types.ts           Source interface (name, cadenceMs, schema, isEnabled, fetch, observedAt)
    registry.ts        the registry of Sources, consumed by both runtimes
    metar.ts           METAR fetcher + Zod schema
    airnow.ts          AirNow fetcher + Zod schema
    firms.ts           NASA FIRMS active-fire detections (env-gated)
    hrrr_smoke.ts      HRRR Smoke proxy fetcher (env-gated)
    nexrad.ts          NEXRAD L2 metadata via S3 (env-gated)
    nldn.ts            NLDN lightning (env-gated, subscription)
    events.ts          canonical local event context, initially PredictHQ (env-gated)
  notam-schema.ts      Canonical NOTAM Zod schema (shared by Worker + relay)
  store.ts             better-sqlite3 store (Node only)
  collate.ts           cross-source collation (Node)
  latents.ts           derived signals from a collation
  places.ts            place registry: prefers measured places.generated.json, falls back to seed
  places.generated.json  MEASURED registry (OSM geometry + NLCD canopy/impervious + HOLC grade)
  parks.ts             Park Crowd-Cast deriver (per-place correlation + public voice)
  crowdcast_page.ts    live /crowdcast HTML served by the Worker
  server.ts            Node HTTP server
  index.ts             Node entry: tick loop + setInterval + HTTP
  worker/
    store.ts           D1 store (async mirror of store.ts)
    collate.ts         D1 collation (async mirror)
    index.ts           Worker entry: fetch() + scheduled() cron
migrations/
  0001_init.sql        snapshots + collations tables
  0002_latents.sql     latents table
  0003_places.sql      places (static registry) + place_signals (crowd-cast, foot_traffic seam)
  0004_rollup.sql      place_signals_hourly rollup + maintenance_state
scripts/
  regenerate-places.mjs  OSM parks + NLCD canopy/impervious + HOLC grade (free, keyless)
  holc-canopy-audit.mjs  NEIGHBORHOOD canopy per HOLC polygon — where the redlining signal lives
  build-registry.mjs     merges the above into src/places.generated.json
relay/
  notam/               out-of-process SWIM JMS consumer (systemd, home server)
test/
  collate.test.ts      node:test
  server.test.ts       node:test
  latents.test.ts      node:test
wrangler.toml          Worker + D1 bindings + 5-min cron + civicbrands route
```

Sources are shared between Node and Worker via `src/sources/`. The two storage modules differ because `better-sqlite3` is synchronous and D1 is async; the schema and JSON encoding match exactly so migrations are shared.

## Dev commands

```bash
npm install
npm run build           # tsc -> dist/
npm run dev             # ts-node src/index.ts (Node tick loop)
npm test                # node --test on test/*.test.ts
npx wrangler dev        # Worker locally against D1
npx wrangler deploy     # deploy Worker
npx wrangler d1 migrations apply forecast   # apply pending migrations
```

## Required env

| Var | Used by | Notes |
|---|---|---|
| `AIRNOW_API_KEY` | both | required to enable AirNow; free key at https://docs.airnowapi.org/account/request/ |
| `USER_LAT` | both | default 39.0997 (KC) |
| `USER_LON` | both | default -94.5786 |
| `RADIUS_MILES` | both | default 30 |
| `COLLATION_MAX_AGE_MS` | both | default 3_600_000 (snapshot freshness cutoff for collation) |
| `FIRMS_MAP_KEY` | both | optional; enables FIRMS — https://firms.modaps.eosdis.nasa.gov/api/area/ |
| `HRRR_SMOKE_ENDPOINT` | both | optional; HTTP proxy returning JSON HRRR-Smoke samples |
| `NEXRAD_STATIONS` | both | optional; comma-separated station IDs (e.g. `KEAX,KTWX`) |
| `NLDN_TOKEN`, `NLDN_ENDPOINT` | both | optional; subscription-gated lightning |
| `PREDICTHQ_API_KEY` | both | optional; enables EVENTS source |
| `EVENTS_TIMEZONE` | both | default `America/Chicago` |
| `EVENTS_LOOKAHEAD_HOURS` | both | default `24` |
| `PREDICTHQ_CATEGORIES`, `PREDICTHQ_LIMIT` | both | optional event query tuning |
| `INGEST_TOKEN` | Worker | bearer token required by `POST /ingest/notam`; must match the relay's `INGEST_TOKEN` |
| `PLACE_SIGNALS_RETENTION_DAYS` | Worker | optional; days of raw `place_signals` to keep. **Unset/0 = never prune** (hourly rollup still runs, additive only). Set to a positive number to enable destructive pruning. |
| `TICK_MS` | Node only | default 300_000 (Worker uses cron) |
| `RUN_ONCE` | Node only | `1` = one tick, then exit |
| `PORT` | Node only | default 3000 |
| `SERVE` | Node only | `0` to skip HTTP server |
| `DB_PATH` | Node only | default `./data/forecast.db` |

Node env comes from `.env` via dotenv. Worker env comes from `[vars]` in `wrangler.toml` and `wrangler secret put` for secrets.

## Deployed resources (Cloudflare)

- **Worker**: `forecast` (id `d04c332378e5482280a38872a7f5ecef`), route `forecast.civicbrands.org/*`
- **D1**: `forecast` (uuid `f38eae1e-efe7-41d3-980a-aeb73480a76a`)
- **Cron**: `*/5 * * * *` triggers `scheduled()` which calls `runTick()`

## D1 schema

See `migrations/0001_init.sql`.

- `snapshots(id, source, fetched_at, observed_at_min, observed_at_max, data)` — `data` is JSON of the observation array.
- `collations(id, collated_at, observed_at_min, observed_at_max, sources)` — `sources` is JSON of `{ [SourceName]: { snapshot_id, fetched_at, record_count } }`.
- `latents(id, ts, name, value, collation_id, inputs, confidence)` — derived signals from a collation; `inputs` is JSON.

## NOTAM ingestion (push, not poll)

NOTAM is the one source that does not live in `src/sources/registry.ts`. The FAA delivers FNS NOTAMs over SWIM JMS (Solace, `tcps://ems1.swim.faa.gov:55443`), which the Worker cannot speak. The relay in `relay/notam/` runs as a long-lived systemd unit on a home box: it consumes the queue, parses the AIXM payload into the canonical shape declared in `src/notam-schema.ts`, geo-filters to `USER_LAT/LON + RADIUS_MILES`, batches records, and POSTs them to the Worker at `/ingest/notam` with a bearer `INGEST_TOKEN`. The Worker validates and writes one `snapshots` row per batch with `source = 'NOTAM'`. Downstream (`/snapshots/NOTAM`, collation, latents) treats NOTAM identically to every other source.

## Tick semantics

One tick = invoke every source in the registry in parallel (`Promise.allSettled`). Each source:
1. Is skipped if its `cadenceMs` has not elapsed (Node only — the Worker runs all enabled sources every cron firing).
2. Is skipped if `isEnabled(ctx)` returns false (missing env/credentials).
3. Fetches, validates against its Zod schema, and appends one row to `snapshots`. An empty observation array is **NOT** persisted.

After ingestion, `collate()` reads the latest snapshot per registered source, drops any older than `COLLATION_MAX_AGE_MS`, and writes one collation row if at least one fresh source exists. `deriveLatents(c)` then produces zero or more `latents` rows from the collation.

## Roadmap

See `/root/.claude/plans/plan-remaining-build-out-crystalline-scroll.md` for the v1 plan. README has the public roadmap.
