"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const ingest_1 = require("./ingest");
const store_1 = require("./store");
const collate_1 = require("./collate");
const server_1 = require("./server");
const config_1 = require("./config");
if (!config_1.config.airnowApiKey) {
    throw new Error("AIRNOW_API_KEY not set in .env");
}
function persistMetar(observations) {
    const obsTimes = observations.map((o) => o.obsTime);
    (0, store_1.appendSnapshot)({
        source: "METAR",
        fetched_at: Date.now(),
        observed_at_min: Math.min(...obsTimes),
        observed_at_max: Math.max(...obsTimes),
        data: observations,
    });
}
function persistAirNow(observations) {
    const toEpoch = (o) => {
        const d = new Date(`${o.DateObserved}T${String(o.HourObserved).padStart(2, "0")}:00:00`);
        return Math.floor(d.getTime() / 1000);
    };
    const obsTimes = observations.map(toEpoch);
    (0, store_1.appendSnapshot)({
        source: "AIRNOW",
        fetched_at: Date.now(),
        observed_at_min: Math.min(...obsTimes),
        observed_at_max: Math.max(...obsTimes),
        data: observations,
    });
}
async function tick() {
    const started = new Date().toISOString();
    console.log(`[${started}] tick`);
    const { lat, lon, radiusMiles } = config_1.config.user;
    const results = await Promise.allSettled([
        (0, ingest_1.ingestMetar)(lat, lon, radiusMiles).then(persistMetar),
        (0, ingest_1.ingestAirNow)(lat, lon, radiusMiles, config_1.config.airnowApiKey).then(persistAirNow),
    ]);
    const sources = ["METAR", "AIRNOW"];
    results.forEach((r, i) => {
        if (r.status === "rejected") {
            console.error(`  ${sources[i]} failed:`, r.reason instanceof Error ? r.reason.message : r.reason);
        }
        else {
            const entry = (0, store_1.latestSnapshot)(sources[i]);
            console.log(`  ${sources[i]}: ${entry?.data.length ?? 0} records persisted`);
        }
    });
    const c = (0, collate_1.collate)();
    if (c) {
        const srcList = Object.keys(c.sources).join(", ");
        console.log(`  COLLATED #${c.id}: [${srcList}] window ${c.observed_at_min}–${c.observed_at_max}`);
    }
    else {
        console.log(`  COLLATED: no fresh sources`);
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