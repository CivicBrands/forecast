> The system maintains parallel interpretation paths derived from shared observations.  
> These paths are updated iteratively and may diverge or converge over time, rather than being reduced to a single resolved state prematurely.  
> 
> Authoritative outputs and directives are produced as a time-bound coalescence of these paths, weighted according to their state at that point, and shall be acted upon within that context.

# API Reference

This document specifies the HTTP surface of `forecast-v2`. The surface returns stored material without transformation. It **DOES NOT** resolve uncertainty, adjudicate between sources, or compute derived signals.

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

Enumerates available endpoints.

```json
{ "endpoints": ["/healthz", "/snapshots/METAR", "/snapshots/AIRNOW", "/collations/latest"] }
```

---

## `GET /healthz`

Liveness probe. Returns `{ "ok": true }` when the surface is reachable. The endpoint **DOES NOT** report ingestion health, collation freshness, or upstream availability.

---

## `GET /snapshots/{SOURCE}`

Returns the most recent stored snapshot for the named source. `{SOURCE}` **MUST** be a value present in `KNOWN_SOURCES` (currently `METAR`, `AIRNOW`).

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

Returns the most recent collation row. A collation indexes the most recent snapshot per source whose `fetched_at` falls within `COLLATION_MAX_AGE_MS` of the collation time. Sources outside that window are omitted, **NOT** interpolated.

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

## Reserved

The path prefix `/latents/*` is reserved for the latent variables surface introduced in a subsequent phase. Its shape is **NOT** specified by this document.
