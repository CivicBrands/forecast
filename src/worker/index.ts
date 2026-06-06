import { appendLatent, appendSnapshot, latentsByName, latestCollation, latestLatents, latestSnapshot, Snapshot } from "./store";
import { collate } from "./collate";
import { knownSourceNames, registry, sourceNames } from "../sources/registry";
import { AnySource, SourceContext } from "../sources/types";
import { deriveLatents } from "../latents";
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
  /** Bearer token presented by the NOTAM SWIM relay on POST /ingest/notam. */
  INGEST_TOKEN?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function html(body: string): Response {
  return new Response(body, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function wantsHtml(req: Request): boolean {
  const accept = req.headers.get("accept") ?? "";
  return accept.includes("text/html") && !accept.includes("application/json");
}

function endpointIndex() {
  const snapshotRoutes = knownSourceNames().map((s) => `/snapshots/${s}`);
  return {
    endpoints: ["/healthz", "/field/current", ...snapshotRoutes, "/collations/latest", "/latents/latest", "/latents?name="],
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

    if (url.pathname === "/") {
      return wantsHtml(req) ? html(renderFrontendHtml()) : json(endpointIndex());
    }

    return json({ error: "not_found" }, 404);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runTick(env));
  },
};
