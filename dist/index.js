"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const store_1 = require("./store");
const collate_1 = require("./collate");
const latents_1 = require("./latents");
const server_1 = require("./server");
const config_1 = require("./config");
const registry_1 = require("./sources/registry");
const lastFetched = new Map();
function buildContext() {
    return {
        lat: config_1.config.user.lat,
        lon: config_1.config.user.lon,
        radiusMiles: config_1.config.user.radiusMiles,
        env: process.env,
    };
}
async function runSource(src, ctx, now) {
    const last = lastFetched.get(src.name) ?? 0;
    if (last !== 0 && now - last < src.cadenceMs)
        return { kind: "skipped" };
    if (!src.isEnabled(ctx))
        return { kind: "disabled" };
    const data = await src.fetch(ctx);
    lastFetched.set(src.name, now);
    if (data.length === 0)
        return { kind: "empty" };
    const { min, max } = src.observedAt(data);
    const snap = {
        source: src.name,
        fetched_at: now,
        observed_at_min: min,
        observed_at_max: max,
        data,
    };
    (0, store_1.appendSnapshot)(snap);
    return { kind: "ok", count: data.length };
}
async function tick() {
    const started = new Date().toISOString();
    console.log(`[${started}] tick`);
    const now = Date.now();
    const ctx = buildContext();
    const results = await Promise.allSettled(registry_1.registry.map((src) => runSource(src, ctx, now)));
    results.forEach((r, i) => {
        const name = registry_1.registry[i].name;
        if (r.status === "rejected") {
            const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
            console.error(`  ${name} failed: ${msg}`);
            return;
        }
        switch (r.value.kind) {
            case "skipped":
                return;
            case "disabled":
                console.log(`  ${name}: disabled (missing env)`);
                return;
            case "empty":
                console.log(`  ${name}: 0 records`);
                return;
            case "ok": {
                const snap = (0, store_1.latestSnapshot)(name);
                console.log(`  ${name}: ${snap?.data.length ?? r.value.count} records persisted`);
                return;
            }
        }
    });
    const c = (0, collate_1.collate)(now);
    if (!c) {
        console.log(`  COLLATED: no fresh sources`);
        return;
    }
    const srcList = Object.keys(c.sources).join(", ");
    console.log(`  COLLATED #${c.id}: [${srcList}] window ${c.observed_at_min}–${c.observed_at_max}`);
    const latents = (0, latents_1.deriveLatents)(c, store_1.latestSnapshot);
    for (const l of latents) {
        (0, store_1.appendLatent)({
            ts: now,
            name: l.name,
            value: l.value,
            collation_id: c.id,
            inputs: l.inputs,
            confidence: l.confidence,
        });
    }
    if (latents.length > 0) {
        console.log(`  LATENTS: ${latents.map((l) => `${l.name}=${l.value}`).join(", ")}`);
    }
}
async function main() {
    await tick();
    if (config_1.config.runOnce)
        return;
    if (config_1.config.serve)
        (0, server_1.startServer)(config_1.config.port);
    console.log(`scheduling next tick every ${config_1.config.tickMs}ms`);
    setInterval(() => {
        tick().catch((err) => console.error("tick error:", err));
    }, config_1.config.tickMs);
}
main().catch((err) => {
    console.error("FATAL:", err.message);
    process.exit(1);
});
//# sourceMappingURL=index.js.map