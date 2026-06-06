> The system maintains parallel interpretation paths derived from shared observations.  
> These paths are updated iteratively and may diverge or converge over time, rather than being reduced to a single resolved state prematurely.  
> 
> Authoritative outputs and directives are produced as a time-bound coalescence of these paths, weighted according to their state at that point, and shall be acted upon within that context.

# Sources

This document enumerates the data sources currently ingested by `forecast-v2` and describes the procedure by which a new source is added. It does not characterize source quality. Source fidelity is preserved; source authority is not asserted.

---

## Onboarding Procedure

A new source **MUST**:

- Be reachable over a stable, documented endpoint
- Return responses with a declared, typed shape
- Carry observation timestamps that can be resolved to epoch seconds
- Be expressible without aggregation, smoothing, or destructive transformation at ingestion

The current procedure (pre-framework) is mechanical and repeated across the Node and Worker runtimes. A formal `Source` interface is planned; see the roadmap. Until then:

1. Define a Zod schema for one observation and the array response in `src/ingest.ts`. Field names **MUST** match upstream exactly.
2. Export `ingestXxx(lat, lon, radiusMiles, ...auth)` from `src/ingest.ts`. The function fetches the upstream endpoint, parses the response with `safeParse`, and throws on validation failure.
3. Add `persistXxx` to `src/index.ts` and `src/worker/index.ts`. The helper derives `observed_at_min` and `observed_at_max` from upstream timestamps and calls `appendSnapshot`.
4. Add the new literal to `SourceKey` in both `src/store.ts` and `src/worker/store.ts`. Add the same literal to `ALL_SOURCES` in both `src/collate.ts` and `src/worker/collate.ts`, and to `KNOWN_SOURCES` in both `src/server.ts` and `src/worker/index.ts`.
5. Add fixtures and extend the collation test in `test/collate.test.ts`.

> [!CAUTION]
> A source whose response shape is unstable **MUST NOT** be added without explicit handling of the variation in its Zod schema. Silent coercion is a structural failure.

---

## Active Sources

### METAR

Surface aviation weather observations.

- **Endpoint**: `https://aviationweather.gov/api/data/metar?bbox={S,W,N,E}&format=json`
- **Authentication**: none required
- **Geographic resolution**: bounding box computed from `USER_LAT`, `USER_LON`, `RADIUS_MILES` (`bboxFromPoint` in `src/ingest.ts`)
- **Schema**: `MetarObservationSchema` — `temp`, `dewp`, `wdir`, `wspd`, `wg` (optional), `visib` (number or string; preserved as-received), `altim`, `clouds` (layered, with `cover` and optional `base`), `fltCat`, raw observation string `rawOb`
- **Observation time**: `obsTime`, epoch seconds, as supplied
- **Cadence**: every tick

### AirNow

Surface air quality observations (O3, PM2.5, PM10).

- **Endpoint**: `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude={lat}&longitude={lon}&distance={miles}&API_KEY={key}`
- **Authentication**: `AIRNOW_API_KEY` (issued without cost by the upstream provider)
- **Geographic resolution**: latitude, longitude, and radius in miles passed directly to the endpoint
- **Schema**: `AirNowObservationSchema` — `DateObserved` (string), `HourObserved` (integer), `ReportingArea`, `StateCode`, `Latitude`, `Longitude`, `ParameterName`, `AQI`, `Category`
- **Observation time**: composed from `DateObserved` and `HourObserved`; see `persistAirNow` in `src/index.ts`
- **Cadence**: every tick

---

## Planned Sources

The following sources are under evaluation. Inclusion is contingent on their meeting the structural requirements above.

| Source | Class |
|---|---|
| NEXRAD | Radar reflectivity, echo tops, storm motion |
| NLDN | Lightning events (subscription-gated) |
| HRRR Smoke | Surface and column smoke, wind vectors |
| FIRMS | Satellite fire detections |
| NOTAM | Airspace restrictions |
| Transport | Travel time, delay, incidents |
| News (RSS) | Per-source atomic articles |
| Socioeconomic | Fuel prices, economic indicators |
