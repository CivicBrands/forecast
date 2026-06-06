"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.boundsFrom = boundsFrom;
/** Helper for the common case: derive an epoch seconds timestamp from each observation. */
function boundsFrom(data, pickEpochSeconds) {
    const times = data.map(pickEpochSeconds);
    return { min: Math.min(...times), max: Math.max(...times) };
}
//# sourceMappingURL=types.js.map