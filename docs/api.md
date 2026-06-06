> The system maintains parallel interpretation paths derived from shared observations.  
> These paths are updated iteratively and may diverge or converge over time, rather than being reduced to a single resolved state prematurely.  
> 
> Authoritative outputs and directives are produced as a time-bound coalescence of these paths, weighted according to their state at that point, and shall be acted upon within that context.

# API Reference

This document specifies the HTTP surface of `forecast-v2`. The surface returns stored material without transformation. It **DOES NOT** resolve uncertainty, adjudicate between sources, or recompute derived signals on demand.

> [!WARNING]
> Outputs are representations of observed data. They are **NOT** self-validating. See `ETHICS.md` before consuming this surface in safety-relevant contexts.

---

## General

- All endpoints are `GET`. Any other method returns `405` with body `{ "error": "method_not_allowed" }`.
- Responses are `application/json`.
- Both runtimes expose identical routes:
  - **Node**: `http://localhost:${PORT}` (default `:3000`)
  - **Worker**: `https://forecast.civicbrands.org`

---

## `GET /`

Enumerates available endpoints. The `snapshots/*` entries reflect the current source registry.

```json
{
  "endpoints": [
    "/healthz",
    "/snapshots/METAR",
    "/snapshots/AIRNOW",
    "/snapshots/FIRMS",
    "/snapshots/HRRR_SMOKE",
    "/snapshots/NEXRAD",
    "/snapshots/NLDN",
    "/snapshots/NOTAM",
    "/collations/latest",
    "/latents/latest",
    "/latents?name="
  ]
}
```

---

## `GET /healthz`

Liveness probe. Returns `{ "ok": true }` when the surface is reachable. The endpoint **DOES NOT** report ingestion health, collation freshness, or upstream availability.

---

## `GET /snapshots/{SOURCE}`

Returns the most recent stored snapshot for the named source. `{SOURCE}` **MUST** be a value present in the registry; see `docs/sources.md`.

**`200`**

```json
{
  "id": 123,
  "source": "METAR",
  "fetched_at": 1717689600000,
  "observed_at_min": 1717689000,
  "observed_at_max": 1717689540,
  "data": []
}
```

`data` is the validated observation array, preserved in its upstream shape. See `docs/sources.md` for per-source field definitions.

**`404`**

- `{ "error": "unknown_source" }` if the source identifier is not recognized
- `{ "error": "no_snapshot" }` if no snapshot has yet been stored for that source

---

## `GET /collations/latest`

Returns the most recent collation row. A collation indexes the most recent snapshot per registered source whose `fetched_at` falls within `COLLATION_MAX_AGE_MS` of the collation time. Sources outside that window are omitted, **NOT** interpolated.

**`200`**

```json
{
  "id": 45,
  "collated_at": 1717689600000,
  "observed_at_min": 1717689000,
  "observed_at_max": 1717689540,
  "sources": {
    "METAR":  { "snapshot_id": 123, "fetched_at": 1717689600000, "record_count": 6 },
    "AIRNOW": { "snapshot_id": 124, "fetched_at": 1717689600000, "record_count": 3 }
  }
}
```

> [!NOTE]
> The absence of a source from `sources` is meaningful. It indicates that no fresh snapshot existed at collation time and **MUST NOT** be treated as zero, missing, or interpolatable.

**`404`** — `{ "error": "no_collation" }` if no collation has yet been written.

---

## `GET /latents/latest`

Returns every latent row sharing the most recent `ts`. A latent is a derived signal computed from a single collation; the set returned by this endpoint corresponds to one collation event.

**`200`**

```json
[
  {
    "id": 1,
    "ts": 1717689600000,
    "name": "aqi_max",
    "value": 80,
    "collation_id": 45,
    "inputs": { "source": "AIRNOW", "samples": 3 }
  },
  {
    "id": 2,
    "ts": 1717689600000,
    "name": "smoke_impacted_aq",
    "value": 120,
    "collation_id": 45,
    "inputs": { "pm_aqi_max": 120, "fire_count": 4 },
    "confidence": 0.4
  }
]
```

**`404`** — `{ "error": "no_latents" }` if no latent has yet been written.

> [!NOTE]
> A latent is computed only when every source it depends on is present in the underlying collation. The absence of an expected latent **MUST NOT** be interpreted as a value of zero.

---

## `GET /latents?name={NAME}&limit={N}`

Returns the most recent `N` (default `100`) rows for the named latent, ordered by `ts` descending.

**`200`** — JSON array, same row shape as `/latents/latest`.

**`400`** — `{ "error": "name_required" }` if `name` is not provided.

---

## `POST /ingest/notam`

Receives a batch of canonical NOTAM records from the SWIM relay (`relay/notam/`). This endpoint is internal and **MUST** be called only by the relay; it is **NOT** part of the public read surface.

- **Authentication**: `Authorization: Bearer ${INGEST_TOKEN}`. `INGEST_TOKEN` is provisioned as a Worker secret and **MUST** match the value held by the relay.
- **Content-Type**: `application/json`
- **Body**: `{ "records": NotamRecord[] }` — see `src/notam-schema.ts` for the field-level schema.

**`200`** — `{ "accepted": <count> }`. One row is appended to `snapshots` with `source = "NOTAM"` and `data` equal to the submitted batch.

**`400`** — `{ "error": "invalid_json" }` or `{ "error": "invalid_payload", "details": <zod-error> }`.

**`401`** — `{ "error": "unauthorized" }` when the bearer token is missing or wrong.

**`503`** — `{ "error": "ingest_disabled" }` when no `INGEST_TOKEN` is configured on the Worker.
