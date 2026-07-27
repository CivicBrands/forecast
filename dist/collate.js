"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collate = collate;
const store_1 = require("./store");
const config_1 = require("./config");
const registry_1 = require("./sources/registry");
function collate(now = Date.now()) {
    const sources = {};
    let observedMin = Infinity;
    let observedMax = -Infinity;
    for (const sourceName of (0, registry_1.knownSourceNames)()) {
        const snap = (0, store_1.latestSnapshot)(sourceName);
        if (!snap || snap.id === undefined)
            continue;
        if (now - snap.fetched_at > config_1.config.collationMaxAgeMs)
            continue;
        sources[sourceName] = {
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
    c.id = (0, store_1.appendCollation)(c);
    return c;
}
//# sourceMappingURL=collate.js.map