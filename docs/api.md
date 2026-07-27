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

---

## Location privacy

Two endpoints accept caller coordinates: `GET /field/current` and `GET /nearby.json`.

Coordinates are used **only** to build the single response they accompany — selecting which
weather stations, air-quality monitors and parks to read, and computing distance. They are
**NOT** written to any table, **NOT** logged, **NOT** associated with any identifier or
session, and **NOT** shared with third parties. Neither path performs a database write.

`GET /nearby.json` restates this in its own payload under `privacy`, so the guarantee
travels with the data rather than living only in this document.

---

## `GET /crowdcast`

The public Park Crowd-Cast board, as HTML. Reads `/crowdcast.json` client-side and refreshes
on the cron cadence. Requires no location.

---

## `GET /crowdcast.json`

Ranked park crowding for the most recent tick, enriched from the runtime place registry.

```json
{
  "generated_at": 1785126903558,
  "location": "Kansas City area",
  "calibrated": false,
  "parks": [
    {
      "id": "swope-park",
      "name": "Swope Park",
      "holc_grade": "D",
      "canopy_index": 53,
      "neighborhood_canopy_index": 22.1,
      "water_feature": true,
      "rank": 1,
      "crowding": 79,
      "tier": "packed",
      "pull": 61.2,
      "friction": 0,
      "narrative": "...",
      "confidence": 0.7
    }
  ]
}
```

- `crowding` is **relative** predicted concentration (0–100), **NOT** a headcount.
- `tier` ∈ `packed | busy | moderate | quiet`.
- `calibrated` is `true` only when observed foot traffic was supplied; absent that, values
  are predictions and `confidence` reflects registry provenance (0.7 measured, 0.55 seed).
- `neighborhood_canopy_index` is the canopy of the surrounding HOLC polygon, **NOT** the
  park interior. It is the field carrying the redlining signal; see
  `docs/compendium/parks.md` for the measurement and the retraction it corrected.

**`404`** is never returned; an empty `parks` array means no tick has been persisted yet.

---

## `GET /crowdcast/history?place={ID}&limit={N}`

Hourly rollup for one place, newest first. `limit` defaults to 168 (one week), capped at 720.

```json
{
  "place_id": "swope-park",
  "hours": [
    { "place_id": "swope-park", "hour_ts": 1785124800000, "avg_value": 41.2, "max_value": 44.0, "min_value": 38.6, "samples": 12 }
  ]
}
```

**`400`** — `{ "error": "place_required" }` if `place` is omitted.

---

## `GET /nearby.json?lat={LAT}&lon={LON}&limit={N}`

Ranks the registry against a caller position. `limit` defaults to 8, capped at 25.

```json
{
  "covered": true,
  "coverage": "Kansas City metro",
  "generated_at": 1785126903558,
  "privacy": "Coordinates are used only to build this response. Not stored, not logged, not shared.",
  "origin": { "lat": 39.0997, "lon": -94.5786 },
  "picks": { "closest": {}, "least_crowded": {}, "coolest": {} },
  "parks": []
}
```

- `coolness` (0–100) is derived from measured canopy, the impervious-based heat proxy and a
  water bonus. It is **weather-independent** — a relative property of the place, not a
  forecast.
- Outside the covered metro the response is `{ "covered": false, ... }` with an empty
  `parks` array and `nearest_covered_area_mi`. The service **DOES NOT** guess beyond its
  measured registry.

**`400`** — `{ "error": "lat_lon_required" }` if either is missing or non-numeric;
`{ "error": "lat_lon_out_of_range" }` if outside valid bounds.
