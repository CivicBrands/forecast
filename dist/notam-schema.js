"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotamIngestRequestSchema = exports.NotamRecordSchema = void 0;
exports.epochSeconds = epochSeconds;
const zod_1 = require("zod");
/**
 * Canonical NOTAM record produced by the SWIM relay from an FNS AIXM message
 * and validated by the Worker on ingest. Field names favor readability over
 * upstream fidelity; the original AIXM XML is intentionally not preserved.
 */
exports.NotamRecordSchema = zod_1.z.object({
    id: zod_1.z.string(),
    fns_uuid: zod_1.z.string(),
    number: zod_1.z.string(),
    year: zod_1.z.string(),
    type: zod_1.z.string(),
    interpretation: zod_1.z.string(),
    issued: zod_1.z.string(),
    effective_start: zod_1.z.string(),
    effective_end: zod_1.z.string().optional(),
    location: zod_1.z.string(),
    icao_location: zod_1.z.string().optional(),
    airport_name: zod_1.z.string().optional(),
    affected_fir: zod_1.z.string().optional(),
    selection_code: zod_1.z.string().optional(),
    qline: zod_1.z.string().optional(),
    min_fl: zod_1.z.number().optional(),
    max_fl: zod_1.z.number().optional(),
    coordinates: zod_1.z.string().optional(),
    lat: zod_1.z.number().optional(),
    lon: zod_1.z.number().optional(),
    radius_nm: zod_1.z.number().optional(),
    classification: zod_1.z.string().optional(),
    text: zod_1.z.string(),
    local_format: zod_1.z.string().optional(),
    icao_format: zod_1.z.string().optional(),
});
exports.NotamIngestRequestSchema = zod_1.z.object({
    records: zod_1.z.array(exports.NotamRecordSchema),
});
/** Epoch seconds derived from `issued` for time-bounding the snapshot. */
function epochSeconds(iso) {
    const t = Date.parse(iso);
    if (Number.isNaN(t))
        return 0;
    return Math.floor(t / 1000);
}
//# sourceMappingURL=notam-schema.js.map