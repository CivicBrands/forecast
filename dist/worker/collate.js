"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collate = collate;
const store_1 = require("./store");
const registry_1 = require("../sources/registry");
async function collate(db, maxAgeMs, now = Date.now()) {
    const sources = {};
    let observedMin = Infinity;
    let observedMax = -Infinity;
    for (const src of registry_1.registry) {
        const snap = await (0, store_1.latestSnapshot)(db, src.name);
        if (!snap || snap.id === undefined)
            continue;
        if (now - snap.fetched_at > maxAgeMs)
            continue;
        sources[src.name] = {
            snapshot_id: snap.id,
            fetched_at: snap.fetched_at,
            record_count: snap.data.length,
        };
        if (snap.observed_at_min < observedMin)
            observedMin = snap.observed_at_min;
        if (snap.observed_at_max > observedMax)
            observedMax = snap.observed_at_max;
    }
    if (Object.keys(sources).length === 0)
        return null;
    const c = {
        collated_at: now,
        observed_at_min: observedMin,
        observed_at_max: observedMax,
        sources,
    };
    c.id = await (0, store_1.appendCollation)(db, c);
    return c;
}
//# sourceMappingURL=collate.js.map