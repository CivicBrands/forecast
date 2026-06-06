> The system maintains parallel interpretation paths derived from shared observations.  
> These paths are updated iteratively and may diverge or converge over time, rather than being reduced to a single resolved state prematurely.  
> 
> Authoritative outputs and directives are produced as a time-bound coalescence of these paths, weighted according to their state at that point, and shall be acted upon within that context.

# Architecture

This document describes the structural composition of `forecast-v2`. It does not describe behavior under failure, nor does it characterize output quality. See `ETHICS.md` for use boundaries.

---

## Layers

The system is composed of strictly separated layers. Each layer **MUST NOT** assume the responsibilities of another.

| Layer | Responsibility | Module(s) |
|---|---|---|
| Ingestion | Acquire raw responses from upstream APIs | `src/ingest.ts` |
| Validation | Reject responses that do not match the declared schema | `src/ingest.ts` (Zod) |
| Storage | Persist atomic observations with provenance and time bounds | `src/store.ts`, `src/worker/store.ts` |
| Collation | Index the most recent snapshot per source within a freshness window | `src/collate.ts`, `src/worker/collate.ts` |
| Surface | Expose stored material over HTTP without transformation | `src/server.ts`, `src/worker/index.ts` |

Interpretation is **NOT** a layer of this system.

---

## Data Flow

```
[ Upstream APIs ]
        |
        v
[ Ingestion ]              src/ingest.ts
        |
        v
[ Validation ]             Zod schemas, response-shape exact
        |
        v
[ Storage ]                snapshots(source, fetched_at, observed_at_min, observed_at_max, data)
        |
        v
[ Collation ]              collations(collated_at, observed_at_*, sources)
        |
        v
[ Surface ]                /healthz, /snapshots/:SOURCE, /collations/latest
```

A snapshot is the atomic unit of storage. It records *what was observed*, *when it was observed*, and *when it was fetched*. It is append-only.

A collation is an index across snapshots. It selects the most recent snapshot for each source whose `fetched_at` falls within `COLLATION_MAX_AGE_MS` of the collation time. Sources outside that window are omitted, **NOT** interpolated.

---

## Runtimes

Two runtimes share `src/ingest.ts` and the on-disk schema. They differ in storage substrate and trigger.

| Concern | Node (`src/index.ts`) | Worker (`src/worker/index.ts`) |
|---|---|---|
| Trigger | `setInterval(tick, TICK_MS)` | `scheduled()` invoked by cron `*/5 * * * *` |
| Store | `better-sqlite3` (synchronous, local) | D1 binding `env.DB` (asynchronous, edge) |
| Surface | `node:http` | Worker `fetch()` handler |
| Configuration | `.env` via `dotenv` | `wrangler.toml [vars]` and Wrangler secrets |

> [!NOTE]
> The two storage modules are intentionally not abstracted behind a shared interface. The synchronous and asynchronous boundaries differ in failure semantics, and conflating them would mask those differences.

---

## Invariants

The following properties **MUST** hold for any change to this architecture:

- Observations are stored atomically. Aggregation **MUST NOT** occur at ingestion or storage.
- Upstream field names are preserved. Renaming, normalization, or unit conversion **MUST NOT** occur in the ingestion or storage layers.
- A stale snapshot is omitted from collation. It **MUST NOT** be substituted, projected, or smoothed.
- Storage is append-only. Snapshot rows **MUST NOT** be mutated or deleted by application code.
- Geographic resolution is derived from `USER_LAT`, `USER_LON`, and `RADIUS_MILES`. Station identifiers **MUST NOT** be hardcoded.

---

## Tracing a Single Observation

1. A trigger fires (cron in the Worker, `setInterval` in the Node runtime).
2. `runTick` invokes the per-source ingestion functions in parallel via `Promise.allSettled`. A failure in one source **DOES NOT** block another.
3. The response is validated against the declared Zod schema. Validation failure throws; the failure is recorded; no snapshot is written for that source on that tick.
4. On success, `observed_at_min` and `observed_at_max` are derived from the upstream timestamps. A row is appended to `snapshots`.
5. `collate` selects the most recent snapshot for each known source. Snapshots older than `COLLATION_MAX_AGE_MS` are excluded. A single `collations` row is written if at least one source qualifies.
6. The surface returns the most recent collation on request. The surface **DOES NOT** compute, derive, or summarize.
