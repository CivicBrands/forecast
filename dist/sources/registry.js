"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOTAM_SOURCE_NAME = exports.registry = void 0;
exports.sourceNames = sourceNames;
exports.knownSourceNames = knownSourceNames;
exports.findSource = findSource;
const metar_1 = require("./metar");
const airnow_1 = require("./airnow");
const firms_1 = require("./firms");
const hrrr_smoke_1 = require("./hrrr_smoke");
const nexrad_1 = require("./nexrad");
const nldn_1 = require("./nldn");
const events_1 = require("./events");
/**
 * NOTAM is intentionally absent: it arrives via SWIM JMS (push) through the
 * out-of-process relay in `relay/notam/`, not by polling. The Worker still
 * stores NOTAM snapshots; ingest happens through POST /ingest/notam.
 */
exports.registry = [
    metar_1.metarSource,
    airnow_1.airnowSource,
    firms_1.firmsSource,
    hrrr_smoke_1.hrrrSmokeSource,
    nexrad_1.nexradSource,
    nldn_1.nldnSource,
    events_1.eventsSource,
];
exports.NOTAM_SOURCE_NAME = "NOTAM";
function sourceNames() {
    return exports.registry.map((s) => s.name);
}
/**
 * Names of sources that have stored snapshots, including push-only sources
 * (NOTAM) that are not in the polling registry but DO appear under
 * /snapshots/{SOURCE}.
 */
function knownSourceNames() {
    return [...sourceNames(), exports.NOTAM_SOURCE_NAME];
}
function findSource(name) {
    return exports.registry.find((s) => s.name === name);
}
//# sourceMappingURL=registry.js.map