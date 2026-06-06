"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.firmsSource = void 0;
const zod_1 = require("zod");
const types_1 = require("./types");
const FirmsObservationSchema = zod_1.z.object({
    latitude: zod_1.z.number(),
    longitude: zod_1.z.number(),
    bright_ti4: zod_1.z.number().optional(),
    bright_ti5: zod_1.z.number().optional(),
    scan: zod_1.z.number().optional(),
    track: zod_1.z.number().optional(),
    acq_date: zod_1.z.string(),
    acq_time: zod_1.z.string(),
    satellite: zod_1.z.string().optional(),
    instrument: zod_1.z.string().optional(),
    confidence: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    version: zod_1.z.string().optional(),
    frp: zod_1.z.number().optional(),
    daynight: zod_1.z.string().optional(),
});
const FirmsResponseSchema = zod_1.z.array(FirmsObservationSchema);
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
function epochSeconds(o) {
    const hh = o.acq_time.padStart(4, "0").slice(0, 2);
    const mm = o.acq_time.padStart(4, "0").slice(2, 4);
    const d = new Date(`${o.acq_date}T${hh}:${mm}:00Z`);
    return Math.floor(d.getTime() / 1000);
}
function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2)
        return [];
    const header = lines[0].split(",").map((h) => h.trim());
    const numeric = new Set([
        "latitude",
        "longitude",
        "bright_ti4",
        "bright_ti5",
        "scan",
        "track",
        "frp",
    ]);
    return lines.slice(1).map((line) => {
        const cells = line.split(",");
        const row = {};
        header.forEach((key, i) => {
            const v = cells[i]?.trim();
            if (v === undefined || v === "")
                return;
            row[key] = numeric.has(key) ? Number(v) : v;
        });
        return row;
    });
}
exports.firmsSource = {
    name: "FIRMS",
    cadenceMs: 60 * 60 * 1000,
    schema: FirmsResponseSchema,
    isEnabled(ctx) {
        return Boolean(ctx.env.FIRMS_MAP_KEY);
    },
    async fetch(ctx) {
        const key = ctx.env.FIRMS_MAP_KEY;
        const { south, west, north, east } = bboxFromPoint(ctx.lat, ctx.lon, ctx.radiusMiles);
        const area = `${west},${south},${east},${north}`;
        const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/${area}/1`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`FIRMS fetch failed: ${res.status} ${res.statusText}`);
        }
        const text = await res.text();
        const rows = parseCsv(text);
        const parsed = FirmsResponseSchema.safeParse(rows);
        if (!parsed.success) {
            throw new Error(JSON.stringify(parsed.error.format(), null, 2));
        }
        return parsed.data;
    },
    observedAt(data) {
        if (data.length === 0)
            return { min: 0, max: 0 };
        return (0, types_1.boundsFrom)(data, epochSeconds);
    },
};
//# sourceMappingURL=firms.js.map