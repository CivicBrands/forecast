"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTick = runTick;
const store_1 = require("./store");
const collate_1 = require("./collate");
const registry_1 = require("../sources/registry");
const latents_1 = require("../latents");
const registry_2 = require("../sources/registry");
const notam_schema_1 = require("../notam-schema");
const frontend_1 = require("../frontend");
const field_1 = require("../field");
function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
function html(body) {
    return new Response(body, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}
function wantsHtml(req) {
    const accept = req.headers.get("accept") ?? "";
    return accept.includes("text/html") && !accept.includes("application/json");
}
function endpointIndex() {
    const snapshotRoutes = (0, registry_1.knownSourceNames)().map((s) => `/snapshots/${s}`);
    return {
        endpoints: ["/healthz", "/field/current", ...snapshotRoutes, "/collations/latest", "/latents/latest", "/latents?name="],
    };
}
function buildContext(env) {
    return {
        lat: Number(env.USER_LAT ?? 39.0997),
        lon: Number(env.USER_LON ?? -94.5786),
        radiusMiles: Number(env.RADIUS_MILES ?? 30),
        env: env,
    };
}
async function runSource(db, src, ctx, now) {
    if (!src.isEnabled(ctx))
        return `${src.name}: disabled`;
    try {
        const data = await src.fetch(ctx);
        if (data.length === 0)
            return `${src.name}: 0`;
        const { min, max } = src.observedAt(data);
        const snap = {
            source: src.name,
            fetched_at: now,
            observed_at_min: min,
            observed_at_max: max,
            data,
        };
        await (0, store_1.appendSnapshot)(db, snap);
        return `${src.name}: ${data.length}`;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `${src.name}: error ${msg}`;
    }
}
async function runTick(env) {
    const ctx = buildContext(env);
    const now = Date.now();
    const reports = await Promise.all(registry_1.registry.map((src) => runSource(env.DB, src, ctx, now)));
    for (const r of reports)
        console.log(r);
    const maxAgeMs = Number(env.COLLATION_MAX_AGE_MS ?? 60 * 60 * 1000);
    const c = await (0, collate_1.collate)(env.DB, maxAgeMs, now);
    if (!c || c.id === undefined)
        return;
    const lookups = await Promise.all(Object.keys(c.sources).map(async (name) => [name, await (0, store_1.latestSnapshot)(env.DB, name)]));
    const snapshotCache = new Map(lookups);
    const latents = (0, latents_1.deriveLatents)(c, (name) => snapshotCache.get(name) ?? null);
    for (const l of latents) {
        await (0, store_1.appendLatent)(env.DB, {
            ts: now,
            name: l.name,
            value: l.value,
            collation_id: c.id,
            inputs: l.inputs,
            confidence: l.confidence,
        });
    }
}
async function handleNotamIngest(req, env) {
    if (!env.INGEST_TOKEN)
        return json({ error: "ingest_disabled" }, 503);
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${env.INGEST_TOKEN}`)
        return json({ error: "unauthorized" }, 401);
    let payload;
    try {
        payload = await req.json();
    }
    catch {
        return json({ error: "invalid_json" }, 400);
    }
    const parsed = notam_schema_1.NotamIngestRequestSchema.safeParse(payload);
    if (!parsed.success)
        return json({ error: "invalid_payload", details: parsed.error.format() }, 400);
    const records = parsed.data.records;
    if (records.length === 0)
        return json({ accepted: 0 });
    const issuedTimes = records.map((r) => (0, notam_schema_1.epochSeconds)(r.issued)).filter((t) => t > 0);
    const now = Date.now();
    const observedMin = issuedTimes.length > 0 ? Math.min(...issuedTimes) : Math.floor(now / 1000);
    const observedMax = issuedTimes.length > 0 ? Math.max(...issuedTimes) : Math.floor(now / 1000);
    await (0, store_1.appendSnapshot)(env.DB, {
        source: registry_2.NOTAM_SOURCE_NAME,
        fetched_at: now,
        observed_at_min: observedMin,
        observed_at_max: observedMax,
        data: records,
    });
    return json({ accepted: records.length });
}
exports.default = {
    async fetch(req, env) {
        const url = new URL(req.url);
        if (req.method === "POST" && url.pathname === "/ingest/notam") {
            return handleNotamIngest(req, env);
        }
        if (req.method !== "GET")
            return json({ error: "method_not_allowed" }, 405);
        if (url.pathname === "/healthz")
            return json({ ok: true });
        if (url.pathname === "/field/current") {
            try {
                const location = (0, field_1.parseFieldLocation)(url.searchParams, {
                    ...field_1.KC_DEFAULTS,
                    lat: Number(env.USER_LAT ?? field_1.KC_DEFAULTS.lat),
                    lon: Number(env.USER_LON ?? field_1.KC_DEFAULTS.lon),
                    radiusMiles: Number(env.RADIUS_MILES ?? field_1.KC_DEFAULTS.radiusMiles),
                });
                return json(await (0, field_1.buildTransientField)(location, env));
            }
            catch (err) {
                return json({ error: err instanceof Error ? err.message : "invalid_location" }, 400);
            }
        }
        if (url.pathname === "/collations/latest") {
            const c = await (0, store_1.latestCollation)(env.DB);
            return c ? json(c) : json({ error: "no_collation" }, 404);
        }
        if (url.pathname === "/latents/latest") {
            const rows = await (0, store_1.latestLatents)(env.DB);
            return rows.length > 0 ? json(rows) : json({ error: "no_latents" }, 404);
        }
        if (url.pathname === "/latents") {
            const name = url.searchParams.get("name");
            if (!name)
                return json({ error: "name_required" }, 400);
            const limit = Number(url.searchParams.get("limit") ?? 100);
            return json(await (0, store_1.latentsByName)(env.DB, name, limit));
        }
        const m = url.pathname.match(/^\/snapshots\/([A-Z0-9_]+)$/);
        if (m) {
            const source = m[1];
            if (!(0, registry_1.knownSourceNames)().includes(source))
                return json({ error: "unknown_source" }, 404);
            const snap = await (0, store_1.latestSnapshot)(env.DB, source);
            return snap ? json(snap) : json({ error: "no_snapshot" }, 404);
        }
        if (url.pathname === "/") {
            return wantsHtml(req) ? html((0, frontend_1.renderFrontendHtml)()) : json(endpointIndex());
        }
        return json({ error: "not_found" }, 404);
    },
    async scheduled(_event, env, ctx) {
        ctx.waitUntil(runTick(env));
    },
};
//# sourceMappingURL=index.js.map