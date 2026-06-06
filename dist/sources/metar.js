"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metarSource = void 0;
const zod_1 = require("zod");
const types_1 = require("./types");
const MetarCloudLayerSchema = zod_1.z.object({
    cover: zod_1.z.string(),
    base: zod_1.z.number().optional(),
});
const MetarObservationSchema = zod_1.z.object({
    icaoId: zod_1.z.string(),
    receiptTime: zod_1.z.string(),
    obsTime: zod_1.z.number(),
    reportTime: zod_1.z.string(),
    temp: zod_1.z.number(),
    dewp: zod_1.z.number(),
    wdir: zod_1.z.number(),
    wspd: zod_1.z.number(),
    wg: zod_1.z.number().optional(),
    visib: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]),
    altim: zod_1.z.number(),
    slp: zod_1.z.number().optional(),
    qcField: zod_1.z.number(),
    metarType: zod_1.z.string(),
    rawOb: zod_1.z.string(),
    lat: zod_1.z.number(),
    lon: zod_1.z.number(),
    elev: zod_1.z.number(),
    name: zod_1.z.string(),
    cover: zod_1.z.string(),
    clouds: zod_1.z.array(MetarCloudLayerSchema),
    wxString: zod_1.z.string().optional(),
    fltCat: zod_1.z.string(),
});
const MetarResponseSchema = zod_1.z.array(MetarObservationSchema);
function bboxFromPoint(lat, lon, radiusMiles) {
    const latDelta = radiusMiles / 69;
    const lonDelta = radiusMiles / (69 * Math.cos((lat * Math.PI) / 180));
    return {
        south: lat - latDelta,
        west: lon - lonDelta,
        north: lat + latDelta,
        east: lon + lonDelta,
    };
}
exports.metarSource = {
    name: "METAR",
    cadenceMs: 5 * 60 * 1000,
    schema: MetarResponseSchema,
    isEnabled() {
        return true;
    },
    async fetch(ctx) {
        const { south, west, north, east } = bboxFromPoint(ctx.lat, ctx.lon, ctx.radiusMiles);
        const url = `https://aviationweather.gov/api/data/metar?bbox=${south},${west},${north},${east}&format=json`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`METAR fetch failed: ${res.status} ${res.statusText}`);
        }
        const raw = await res.json();
        const parsed = MetarResponseSchema.safeParse(raw);
        if (!parsed.success) {
            throw new Error(JSON.stringify(parsed.error.format(), null, 2));
        }
        return parsed.data;
    },
    observedAt(data) {
        return (0, types_1.boundsFrom)(data, (o) => o.obsTime);
    },
};
//# sourceMappingURL=metar.js.map