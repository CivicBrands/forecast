"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTick = runTick;
const ingest_1 = require("../ingest");
const store_1 = require("./store");
const collate_1 = require("./collate");
const KNOWN_SOURCES = ["METAR", "AIRNOW"];
function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
function getUser(env) {
    return {
        lat: Number(env.USER_LAT ?? 39.0997),
        lon: Number(env.USER_LON ?? -94.5786),
        radiusMiles: Number(env.RADIUS_MILES ?? 30),
    };
}
async function persistMetar(db, obs) {
    const times = obs.map((o) => o.obsTime);
    await (0, store_1.appendSnapshot)(db, {
        source: "METAR",
        fetched_at: Date.now(),
        observed_at_min: Math.min(...times),
        observed_at_max: Math.max(...times),
        data: obs,
    });
}
async function persistAirNow(db, obs) {
    const toEpoch = (o) => {
        const d = new Date(`${o.DateObserved}T${String(o.HourObserved).padStart(2, "0")}:00:00`);
        return Math.floor(d.getTime() / 1000);
    };
    const times = obs.map(toEpoch);
    await (0, store_1.appendSnapshot)(db, {
        source: "AIRNOW",
        fetched_at: Date.now(),
        observed_at_min: Math.min(...times),
        observed_at_max: Math.max(...times),
        data: obs,
    });
}
async function runTick(env) {
    const { lat, lon, radiusMiles } = getUser(env);
    const results = await Promise.allSettled([
        (0, ingest_1.ingestMetar)(lat, lon, radiusMiles).then((o) => persistMetar(env.DB, o)),
        (0, ingest_1.ingestAirNow)(lat, lon, radiusMiles, env.AIRNOW_API_KEY).then((o) => persistAirNow(env.DB, o)),
    ]);
    results.forEach((r, i) => {
        if (r.status === "rejected") {
            console.error(`${KNOWN_SOURCES[i]} failed:`, r.reason instanceof Error ? r.reason.message : r.reason);
        }
    });
    const maxAgeMs = Number(env.COLLATION_MAX_AGE_MS ?? 60 * 60 * 1000);
    await (0, collate_1.collate)(env.DB, maxAgeMs);
}
exports.default = {
    async fetch(req, env) {
        const url = new URL(req.url);
        if (req.method !== "GET")
            return json({ error: "method_not_allowed" }, 405);
        if (url.pathname === "/healthz")
            return json({ ok: true });
        if (url.pathname === "/collations/latest") {
            const c = await (0, store_1.latestCollation)(env.DB);
            return c ? json(c) : json({ error: "no_collation" }, 404);
        }
        const m = url.pathname.match(/^\/snapshots\/([A-Z]+)$/);
        if (m) {
            const source = m[1];
            if (!KNOWN_SOURCES.includes(source))
                return json({ error: "unknown_source" }, 404);
            const snap = await (0, store_1.latestSnapshot)(env.DB, source);
            return snap ? json(snap) : json({ error: "no_snapshot" }, 404);
        }
        if (url.pathname === "/") {
            return json({
                endpoints: ["/healthz", "/snapshots/METAR", "/snapshots/AIRNOW", "/collations/latest"],
            });
        }
        return json({ error: "not_found" }, 404);
    },
    async scheduled(_event, env, ctx) {
        ctx.waitUntil(runTick(env));
    },
};
//# sourceMappingURL=index.js.map