> The system maintains parallel interpretation paths derived from shared observations.  
> These paths are updated iteratively and may diverge or converge over time, rather than being reduced to a single resolved state prematurely.  
> 
> Authoritative outputs and directives are produced as a time-bound coalescence of these paths, weighted according to their state at that point, and shall be acted upon within that context.

# Sources

This document specifies the `Source` interface, the procedure for onboarding a new source, and per-source detail for every source currently in the registry. Source fidelity is preserved; source authority is not asserted.

---

## The `Source` Interface

Every source is a value implementing `Source<T>` from `src/sources/types.ts`:

```ts
interface Source<T> {
  name: string;                                 // stable identifier (UPPER_SNAKE)
  cadenceMs: number;                            // minimum interval between fetches (Node)
  schema: z.ZodType<T[]>;                       // validated response shape
  isEnabled(ctx: SourceContext): boolean;       // false when env is missing
  fetch(ctx: SourceContext): Promise<T[]>;      // returns validated observations
  observedAt(data: T[]): { min: number; max: number };  // epoch-seconds bounds
}
```

Sources are listed in `src/sources/registry.ts`. The runtime iterates the registry and:

- **SHALL** skip a source whose `isEnabled` returns false. Disabled sources are not error states.
- **MAY** skip a source whose `cadenceMs` has not elapsed since its previous fetch.
- **MUST NOT** persist an empty observation array.
- **MUST NOT** transform, normalize, or rename upstream fields.

---

## Onboarding Procedure

1. Add a new module `src/sources/<name>.ts` exporting a `Source` value.
2. Define the Zod schema. Field names **MUST** match the upstream response exactly.
3. Implement `isEnabled` to check for the credentials or configuration the source requires. A source with no preconditions returns `true`.
4. Implement `fetch` to obtain raw data, validate it with the schema, and return the array. Validation failure **MUST** throw.
5. Implement `observedAt` to extract epoch-seconds bounds from the validated payload. If the source carries no per-observation timestamp, return the fetch time for both bounds.
6. Register the source in `src/sources/registry.ts`.

> [!CAUTION]
> A source whose response shape is unstable **MUST NOT** be added without explicit handling of the variation in its Zod schema. Silent coercion is a structural failure.

No further edits to `store`, `collate`, `server`, or the Worker entry are required. The registry is the single point of truth.

---

## Active Sources

### METAR — `src/sources/metar.ts`

Surface aviation weather observations.

- **Endpoint**: `https://aviationweather.gov/api/data/metar?bbox={S,W,N,E}&format=json`
- **Authentication**: none
- **Geographic resolution**: bounding box from `USER_LAT`, `USER_LON`, `RADIUS_MILES`
- **Cadence**: 5 minutes
- **Always enabled**

### AIRNOW — `src/sources/airnow.ts`

Surface air quality observations (O3, PM2.5, PM10).

- **Endpoint**: `https://www.airnowapi.org/aq/observation/latLong/current/...`
- **Authentication**: `AIRNOW_API_KEY` (free)
- **Cadence**: 5 minutes
- **Enabled when**: `AIRNOW_API_KEY` is set

### FIRMS — `src/sources/firms.ts`

Active fire detections from VIIRS (NASA FIRMS).

- **Endpoint**: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{KEY}/VIIRS_SNPP_NRT/{bbox}/1`
- **Authentication**: `FIRMS_MAP_KEY`
- **Format**: CSV; parsed in-source
- **Cadence**: 60 minutes
- **Enabled when**: `FIRMS_MAP_KEY` is set

### HRRR_SMOKE — `src/sources/hrrr_smoke.ts`

Surface and column smoke from HRRR-Smoke, expected via a JSON proxy (the upstream native format is GRIB2 and is **NOT** decoded in-process).

- **Endpoint**: configured via `HRRR_SMOKE_ENDPOINT`
- **Authentication**: none beyond the endpoint URL
- **Cadence**: 60 minutes
- **Enabled when**: `HRRR_SMOKE_ENDPOINT` is set

### NEXRAD — `src/sources/nexrad.ts`

Latest Level-2 radar scan metadata from `s3://unidata-nexrad-level2`. This source records *the existence and key of* the most recent scan per station. It **DOES NOT** decode the radar volume.

- **Endpoint**: `https://unidata-nexrad-level2.s3.amazonaws.com/?list-type=2&prefix=...`
- **Authentication**: none
- **Cadence**: 10 minutes
- **Enabled when**: `NEXRAD_STATIONS` is set (comma-separated station IDs)

### NLDN — `src/sources/nldn.ts`

Lightning detections from the National Lightning Detection Network. Subscription-gated.

- **Endpoint**: configured via `NLDN_ENDPOINT`
- **Authentication**: `Bearer NLDN_TOKEN`
- **Cadence**: 5 minutes
- **Enabled when**: both `NLDN_TOKEN` and `NLDN_ENDPOINT` are set

### EVENTS — `src/sources/events.ts`

Local event context. This is a canonical event-context adapter rather than a single upstream-native shape, so each record carries `provider` and `provider_id`. PredictHQ is the first provider; Ticketmaster, KCMO/Socrata, Eventbrite, and other adapters can be added later without changing downstream latent inputs.

- **Endpoint**: `https://api.predicthq.com/v1/events/`
- **Authentication**: `Bearer PREDICTHQ_API_KEY`
- **Geographic resolution**: `within={RADIUS_MILES}mi@{USER_LAT},{USER_LON}`
- **Window**: `EVENTS_LOOKAHEAD_HOURS` from fetch time, default 24
- **Timezone**: `EVENTS_TIMEZONE`, default `America/Chicago`
- **Cadence**: 30 minutes
- **Enabled when**: `PREDICTHQ_API_KEY` is set
- **Notes**: Event completeness is subscription and provider dependent. Absence of event rows is not proof that no events exist.

### NOTAM — `relay/notam/` (push)

Airspace notices from the FAA via **SWIM JMS**, not REST. The Worker cannot open the outbound TLS connection (`tcps://ems1.swim.faa.gov:55443`) that the Solace broker requires, so NOTAM ingestion runs out-of-process in `relay/notam/` — a Node systemd unit on a home server.

- **Upstream**: FAA SWIM, message VPN `AIM_FNS`, AIXM 5.1 Basic Messages with FNS Event extensions
- **Authentication (upstream)**: Solace username + password + queue, provisioned through the SWIM portal
- **Authentication (downstream)**: relay POSTs to the Worker at `/ingest/notam` with bearer `INGEST_TOKEN`
- **Schema**: canonical `NotamRecord` declared in `src/notam-schema.ts`; the AIXM XML is **NOT** preserved
- **Filtering**: relay drops records outside `USER_LAT/LON + RADIUS_MILES` before forwarding (set `GEO_FILTER=0` to forward the national firehose)
- **Cadence**: continuous — no polling; messages arrive as the FAA publishes them
