import {
  appendLatent,
  appendPlaceSignal,
  appendSnapshot,
  latentsByName,
  latestCollation,
  latestLatents,
  latestPlaceSignals,
  latestSnapshot,
  maintainPlaceSignals,
  placeSignalHistory,
  Snapshot,
} from "./store";
import { collate } from "./collate";
import { knownSourceNames, registry, sourceNames } from "../sources/registry";
import { AnySource, SourceContext } from "../sources/types";
import { deriveLatents } from "../latents";
import { deriveParkCrowding, hottestTempF, tierOf } from "../parks";
import { loadKcParks } from "../places";
import { renderCrowdcastHtml } from "../crowdcast_page";
import { NOTAM_SOURCE_NAME } from "../sources/registry";
import { NotamIngestRequestSchema, epochSeconds as notamEpoch } from "../notam-schema";
import { renderFrontendHtml } from "../frontend";
import { buildTransientField, KC_DEFAULTS, parseFieldLocation } from "../field";

export interface Env {
  DB: D1Database;
  AIRNOW_API_KEY?: string;
  USER_LAT?: string;
  USER_LON?: string;
  RADIUS_MILES?: string;
  COLLATION_MAX_AGE_MS?: string;
  FIRMS_MAP_KEY?: string;
  HRRR_SMOKE_ENDPOINT?: string;
  NEXRAD_STATIONS?: string;
  NLDN_TOKEN?: string;
  NLDN_ENDPOINT?: string;
  PREDICTHQ_API_KEY?: string;
  PREDICTHQ_CATEGORIES?: string;
  PREDICTHQ_LIMIT?: string;
  EVENTS_LOOKAHEAD_HOURS?: string;
  EVENTS_TIMEZONE?: string;
  /** Bearer token presented by the NOTAM SWIM relay on POST /ingest/notam. */
  INGEST_TOKEN?: string;
  /** Days of raw place_signals to keep. Unset/0 = never prune (rollup only). */
  PLACE_SIGNALS_RETENTION_DAYS?: string;
}

// These endpoints all return live field state, so nothing should be served
// stale from the edge. no-cache forces revalidation on every request.
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
  });
}

function html(body: string): Response {
  return new Response(body, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
  });
}

function wantsHtml(req: Request): boolean {
  const accept = req.headers.get("accept") ?? "";
  return accept.includes("text/html") && !accept.includes("application/json");
}

function endpointIndex() {
  const snapshotRoutes = knownSourceNames().map((s) => `/snapshots/${s}`);
  return {
    endpoints: [
      "/healthz",
      "/field/current",
      ...snapshotRoutes,
      "/collations/latest",
      "/latents/latest",
      "/latents?name=",
      "/crowdcast",
      "/crowdcast.json",
      "/crowdcast/history?place=",
      "/nearby.json?lat=&lon=",
    ],
  };
}

/** Enrich the latest place_signals with static registry fields for the page. */
async function buildCrowdcastResponse(env: Env) {
  const rows = await latestPlaceSignals(env.DB);
  // Must read the RUNTIME registry (measured when available), not the seed —
  // otherwise every measured park renders as a bare slug with no HOLC grade.
  const byId = new Map(loadKcParks().map((p) => [p.id, p]));
  const parks = rows.map((r) => {
    const place = byId.get(r.place_id);
    return {
      id: r.place_id,
      name: place?.name ?? r.place_id,
      holc_grade: place?.holc_grade,
      canopy_index: place?.canopy_index,
      neighborhood_canopy_index: place?.neighborhood_canopy_index,
      water_feature: place?.water_feature,
      rank: r.rank,
      crowding: r.value,
      tier: tierOf(r.value),
      pull: r.pull,
      friction: r.friction,
      narrative: r.narrative,
      foot_traffic: r.foot_traffic,
      anomaly: r.anomaly,
      confidence: r.confidence,
    };
  });
  return {
    generated_at: rows.length > 0 ? rows[0].ts : Date.now(),
    location: "Kansas City area",
    calibrated: rows.some((r) => r.foot_traffic !== undefined && r.foot_traffic !== null),
    parks,
  };
}

/**
 * "Near me" — rank the registry against a caller's GPS position.
 *
 * Answers three questions the board can't: what's CLOSEST, what's LEAST CROWDED,
 * and what's LIKELY COOLEST. Coolness is computed from measured canopy and the
 * impervious-derived heat proxy, plus a water bonus, and is weather-independent;
 * crowding comes from the latest persisted tick.
 *
 * Privacy: the caller's coordinates are used to sort an in-memory list and are
 * never logged or persisted. No row is written on this path.
 *
 * Coverage: the bundled registry is Kansas City only. Out-of-area callers get an
 * explicit `covered: false` and an empty list rather than a nonsense nearest
 * park 400 miles away.
 */
const COVERAGE_RADIUS_MI = 45;

function haversineMiles(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** 0..100 relative thermal comfort. Higher = likely cooler underfoot. */
function coolnessScore(p: { canopy_index: number; lst_summer_index: number; water_feature: boolean }): number {
  const shade = p.canopy_index * 0.6;
  const notHot = (100 - p.lst_summer_index) * 0.3;
  const water = p.water_feature ? 12 : 0;
  return Math.round(Math.min(100, Math.max(0, shade + notHot + water)));
}

async function buildNearbyResponse(env: Env, lat: number, lon: number, limit: number) {
  const registry = loadKcParks();
  const signals = await latestPlaceSignals(env.DB);
  const crowdById = new Map(signals.map((s) => [s.place_id, s]));

  const scored = registry
    .map((p) => {
      const s = crowdById.get(p.id);
      const crowding = s?.value ?? null;
      return {
        id: p.id,
        name: p.name,
        distance_mi: Math.round(haversineMiles(lat, lon, p.lat, p.lon) * 10) / 10,
        crowding,
        tier: crowding === null ? null : tierOf(crowding),
        coolness: coolnessScore(p),
        canopy_index: p.canopy_index,
        neighborhood_canopy_index: p.neighborhood_canopy_index,
        water_feature: p.water_feature,
        holc_grade: p.holc_grade,
        narrative: s?.narrative,
      };
    })
    .sort((a, b) => a.distance_mi - b.distance_mi);

  const nearest = scored[0];
  const covered = Boolean(nearest && nearest.distance_mi <= COVERAGE_RADIUS_MI);
  if (!covered) {
    return {
      covered: false,
      coverage: "Kansas City metro",
      message: "No measured park registry for this location yet.",
      nearest_covered_area_mi: nearest?.distance_mi ?? null,
      parks: [],
    };
  }

  const inRange = scored.filter((p) => p.distance_mi <= COVERAGE_RADIUS_MI).slice(0, limit);
  const withCrowd = inRange.filter((p) => p.crowding !== null);
  const pick = <T>(arr: T[], cmp: (a: T, b: T) => number) => (arr.length ? [...arr].sort(cmp)[0] : null);

  return {
    covered: true,
    coverage: "Kansas City metro",
    generated_at: signals.length ? signals[0].ts : Date.now(),
    // Stated in the payload so the guarantee travels with the data, not just
    // with the docs. Echoing the origin is a courtesy for client-side display;
    // it is not retained server-side.
    privacy: "Coordinates are used only to build this response. Not stored, not logged, not shared.",
    origin: { lat, lon },
    picks: {
      closest: inRange[0] ?? null,
      // Prefer somewhere genuinely nearby over an empty park across the metro.
      least_crowded: pick(withCrowd, (a, b) => a.crowding! - b.crowding! || a.distance_mi - b.distance_mi),
      coolest: pick(inRange, (a, b) => b.coolness - a.coolness || a.distance_mi - b.distance_mi),
    },
    parks: inRange,
  };
}

function buildContext(env: Env): SourceContext {
  return {
    lat: Number(env.USER_LAT ?? 39.0997),
    lon: Number(env.USER_LON ?? -94.5786),
    radiusMiles: Number(env.RADIUS_MILES ?? 30),
    env: env as unknown as Record<string, string | undefined>,
  };
}

async function runSource(db: D1Database, src: AnySource, ctx: SourceContext, now: number): Promise<string> {
  if (!src.isEnabled(ctx)) return `${src.name}: disabled`;
  try {
    const data = await src.fetch(ctx);
    if (data.length === 0) return `${src.name}: 0`;
    const { min, max } = src.observedAt(data);
    const snap: Snapshot<unknown> = {
      source: src.name,
      fetched_at: now,
      observed_at_min: min,
      observed_at_max: max,
      data,
    };
    await appendSnapshot(db, snap);
    return `${src.name}: ${data.length}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `${src.name}: error ${msg}`;
  }
}

export async function runTick(env: Env): Promise<void> {
  const ctx = buildContext(env);
  const now = Date.now();

  const reports = await Promise.all(registry.map((src) => runSource(env.DB, src, ctx, now)));
  for (const r of reports) console.log(r);

  // Park Crowd-Cast — a per-place correlation over the static registry, keyed to
  // the live field (temperature from METAR). Runs every tick, independent of
  // collation, and persists one place_signals row per park.
  try {
    const metarSnap = await latestSnapshot(env.DB, "METAR");
    const temperatureF = metarSnap ? hottestTempF(metarSnap.data) : undefined;
    const cast = deriveParkCrowding(loadKcParks(), { now, temperatureF });
    for (const p of cast.parks) {
      await appendPlaceSignal(env.DB, {
        ts: now,
        place_id: p.id,
        signal: "park_crowding",
        value: p.crowding,
        rank: p.rank,
        demand: p.demandMult,
        pull: p.pull,
        friction: p.friction,
        drivers: p.drivers,
        narrative: p.narrative,
        foot_traffic: p.foot_traffic,
        anomaly: p.anomaly,
        confidence: p.confidence,
      });
    }
    console.log(`crowdcast: #1 ${cast.parks[0]?.name} ${cast.parks[0]?.crowding} @ ${cast.temperatureF}F`);

    // Hourly rollup (+ optional prune). Self-throttles to once per hour.
    const report = await maintainPlaceSignals(env.DB, now, Number(env.PLACE_SIGNALS_RETENTION_DAYS ?? 0));
    if (report.ran) {
      console.log(`maintenance: +${report.hourlyRows ?? 0} hourly rows, pruned ${report.pruned ?? 0}`);
    }
  } catch (err) {
    console.log(`crowdcast: error ${err instanceof Error ? err.message : String(err)}`);
  }

  const maxAgeMs = Number(env.COLLATION_MAX_AGE_MS ?? 60 * 60 * 1000);
  const c = await collate(env.DB, maxAgeMs, now);
  if (!c || c.id === undefined) return;

  const lookups = await Promise.all(
    Object.keys(c.sources).map(async (name) => [name, await latestSnapshot(env.DB, name)] as const),
  );
  const snapshotCache = new Map(lookups);
  const latents = deriveLatents(c, (name) => snapshotCache.get(name) ?? null);

  for (const l of latents) {
    await appendLatent(env.DB, {
      ts: now,
      name: l.name,
      value: l.value,
      collation_id: c.id,
      inputs: l.inputs,
      confidence: l.confidence,
    });
  }
}

async function handleNotamIngest(req: Request, env: Env): Promise<Response> {
  if (!env.INGEST_TOKEN) return json({ error: "ingest_disabled" }, 503);
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.INGEST_TOKEN}`) return json({ error: "unauthorized" }, 401);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = NotamIngestRequestSchema.safeParse(payload);
  if (!parsed.success) return json({ error: "invalid_payload", details: parsed.error.format() }, 400);
  const records = parsed.data.records;
  if (records.length === 0) return json({ accepted: 0 });

  const issuedTimes = records.map((r) => notamEpoch(r.issued)).filter((t) => t > 0);
  const now = Date.now();
  const observedMin = issuedTimes.length > 0 ? Math.min(...issuedTimes) : Math.floor(now / 1000);
  const observedMax = issuedTimes.length > 0 ? Math.max(...issuedTimes) : Math.floor(now / 1000);

  await appendSnapshot(env.DB, {
    source: NOTAM_SOURCE_NAME,
    fetched_at: now,
    observed_at_min: observedMin,
    observed_at_max: observedMax,
    data: records,
  });
  return json({ accepted: records.length });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname === "/ingest/notam") {
      return handleNotamIngest(req, env);
    }

    if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

    if (url.pathname === "/healthz") return json({ ok: true });

    if (url.pathname === "/field/current") {
      try {
        const location = parseFieldLocation(url.searchParams, {
          ...KC_DEFAULTS,
          lat: Number(env.USER_LAT ?? KC_DEFAULTS.lat),
          lon: Number(env.USER_LON ?? KC_DEFAULTS.lon),
          radiusMiles: Number(env.RADIUS_MILES ?? KC_DEFAULTS.radiusMiles),
        });
        return json(await buildTransientField(location, env as unknown as Record<string, string | undefined>));
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : "invalid_location" }, 400);
      }
    }

    if (url.pathname === "/collations/latest") {
      const c = await latestCollation(env.DB);
      return c ? json(c) : json({ error: "no_collation" }, 404);
    }

    if (url.pathname === "/latents/latest") {
      const rows = await latestLatents(env.DB);
      return rows.length > 0 ? json(rows) : json({ error: "no_latents" }, 404);
    }

    if (url.pathname === "/latents") {
      const name = url.searchParams.get("name");
      if (!name) return json({ error: "name_required" }, 400);
      const limit = Number(url.searchParams.get("limit") ?? 100);
      return json(await latentsByName(env.DB, name, limit));
    }

    const m = url.pathname.match(/^\/snapshots\/([A-Z0-9_]+)$/);
    if (m) {
      const source = m[1];
      if (!knownSourceNames().includes(source)) return json({ error: "unknown_source" }, 404);
      const snap = await latestSnapshot(env.DB, source);
      return snap ? json(snap) : json({ error: "no_snapshot" }, 404);
    }

    if (url.pathname === "/crowdcast") {
      return html(renderCrowdcastHtml());
    }

    if (url.pathname === "/crowdcast.json") {
      return json(await buildCrowdcastResponse(env));
    }

    if (url.pathname === "/crowdcast/history") {
      const placeId = url.searchParams.get("place");
      if (!placeId) return json({ error: "place_required" }, 400);
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 168), 720);
      return json({ place_id: placeId, hours: await placeSignalHistory(env.DB, placeId, limit) });
    }

    if (url.pathname === "/nearby.json") {
      const lat = Number(url.searchParams.get("lat"));
      const lon = Number(url.searchParams.get("lon"));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return json({ error: "lat_lon_required" }, 400);
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return json({ error: "lat_lon_out_of_range" }, 400);
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 8), 25);
      return json(await buildNearbyResponse(env, lat, lon, limit));
    }

    if (url.pathname === "/") {
      return wantsHtml(req) ? html(renderFrontendHtml()) : json(endpointIndex());
    }

    return json({ error: "not_found" }, 404);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runTick(env));
  },
};
