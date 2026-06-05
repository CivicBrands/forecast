import { ingestMetar, MetarObservation, ingestAirNow, AirNowObservation } from "../ingest";
import { appendSnapshot, latestCollation, latestSnapshot, SourceKey } from "./store";
import { collate } from "./collate";

export interface Env {
  DB: D1Database;
  AIRNOW_API_KEY: string;
  USER_LAT?: string;
  USER_LON?: string;
  RADIUS_MILES?: string;
  COLLATION_MAX_AGE_MS?: string;
}

const KNOWN_SOURCES: SourceKey[] = ["METAR", "AIRNOW"];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getUser(env: Env) {
  return {
    lat: Number(env.USER_LAT ?? 39.0997),
    lon: Number(env.USER_LON ?? -94.5786),
    radiusMiles: Number(env.RADIUS_MILES ?? 30),
  };
}

async function persistMetar(db: D1Database, obs: MetarObservation[]) {
  const times = obs.map((o) => o.obsTime);
  await appendSnapshot(db, {
    source: "METAR",
    fetched_at: Date.now(),
    observed_at_min: Math.min(...times),
    observed_at_max: Math.max(...times),
    data: obs,
  });
}

async function persistAirNow(db: D1Database, obs: AirNowObservation[]) {
  const toEpoch = (o: AirNowObservation) => {
    const d = new Date(`${o.DateObserved}T${String(o.HourObserved).padStart(2, "0")}:00:00`);
    return Math.floor(d.getTime() / 1000);
  };
  const times = obs.map(toEpoch);
  await appendSnapshot(db, {
    source: "AIRNOW",
    fetched_at: Date.now(),
    observed_at_min: Math.min(...times),
    observed_at_max: Math.max(...times),
    data: obs,
  });
}

export async function runTick(env: Env): Promise<void> {
  const { lat, lon, radiusMiles } = getUser(env);

  const results = await Promise.allSettled([
    ingestMetar(lat, lon, radiusMiles).then((o) => persistMetar(env.DB, o)),
    ingestAirNow(lat, lon, radiusMiles, env.AIRNOW_API_KEY).then((o) => persistAirNow(env.DB, o)),
  ]);

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`${KNOWN_SOURCES[i]} failed:`, r.reason instanceof Error ? r.reason.message : r.reason);
    }
  });

  const maxAgeMs = Number(env.COLLATION_MAX_AGE_MS ?? 60 * 60 * 1000);
  await collate(env.DB, maxAgeMs);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

    if (url.pathname === "/healthz") return json({ ok: true });

    if (url.pathname === "/collations/latest") {
      const c = await latestCollation(env.DB);
      return c ? json(c) : json({ error: "no_collation" }, 404);
    }

    const m = url.pathname.match(/^\/snapshots\/([A-Z]+)$/);
    if (m) {
      const source = m[1] as SourceKey;
      if (!KNOWN_SOURCES.includes(source)) return json({ error: "unknown_source" }, 404);
      const snap = await latestSnapshot(env.DB, source);
      return snap ? json(snap) : json({ error: "no_snapshot" }, 404);
    }

    if (url.pathname === "/") {
      return json({
        endpoints: ["/healthz", "/snapshots/METAR", "/snapshots/AIRNOW", "/collations/latest"],
      });
    }

    return json({ error: "not_found" }, 404);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runTick(env));
  },
};
