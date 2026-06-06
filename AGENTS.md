# AGENTS.md

Internal map of the `forecast-v2` repo for future contributors (human or agent).

## What this is

A time-resolved, multi-source observational field generator. Sources are fetched on a cadence, validated with Zod, persisted as atomic snapshots, and collated into time-windowed cross-source indexes. Runs both as a long-lived Node process (local dev) and as a Cloudflare Worker with a cron trigger (production). See `docs/architecture.md` for the data flow and `docs/api.md` for endpoints.

## Repo map

```
src/
  config.ts        env-driven config for the Node entry
  ingest.ts        METAR + AirNow fetchers and Zod schemas (shared with Worker)
  store.ts         better-sqlite3 store (Node only)
  collate.ts       cross-source collation (Node)
  server.ts        Node HTTP server
  index.ts         Node entry: tick loop + setInterval + HTTP
  worker/
    store.ts       D1 store (async mirror of store.ts)
    collate.ts     D1 collation (async mirror)
    index.ts       Worker entry: fetch() + scheduled() cron
migrations/
  0001_init.sql    snapshots + collations tables
test/
  collate.test.ts  node:test
  server.test.ts   node:test
wrangler.toml      Worker + D1 bindings + 5-min cron + civicbrands route
```

Node and Worker share `src/ingest.ts` (pure fetch + Zod), but each has its own store and collate module because better-sqlite3 is sync and D1 is async.

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
| `AIRNOW_API_KEY` | both | required; free key at https://docs.airnowapi.org/account/request/ |
| `USER_LAT` | both | default 39.0997 (KC) |
| `USER_LON` | both | default -94.5786 |
| `RADIUS_MILES` | both | default 30 |
| `COLLATION_MAX_AGE_MS` | both | default 3_600_000 (snapshot freshness cutoff for collation) |
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
- `collations(id, collated_at, observed_at_min, observed_at_max, sources)` — `sources` is JSON of `{ [SourceKey]: { snapshot_id, fetched_at, record_count } }`.

## Tick semantics

One tick = fetch all sources in parallel (`Promise.allSettled`) → append a snapshot per successful source → `collate()` reads the latest snapshot per source, drops any older than `COLLATION_MAX_AGE_MS`, and writes one collation row if at least one fresh source exists.

## Roadmap

See `/root/.Codex/plans/plan-remaining-build-out-crystalline-scroll.md` for the v1 plan. README has the public roadmap.
