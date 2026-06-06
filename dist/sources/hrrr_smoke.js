"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hrrrSmokeSource = void 0;
const zod_1 = require("zod");
const HrrrSmokeObservationSchema = zod_1.z.object({
    runTs: zod_1.z.number(),
    validTs: zod_1.z.number(),
    lat: zod_1.z.number(),
    lon: zod_1.z.number(),
    near_surface_smoke: zod_1.z.number(),
});
const HrrrSmokeResponseSchema = zod_1.z.array(HrrrSmokeObservationSchema);
exports.hrrrSmokeSource = {
    name: "HRRR_SMOKE",
    cadenceMs: 60 * 60 * 1000,
    schema: HrrrSmokeResponseSchema,
    isEnabled(ctx) {
        return Boolean(ctx.env.HRRR_SMOKE_ENDPOINT);
    },
    async fetch(ctx) {
        const url = new URL(ctx.env.HRRR_SMOKE_ENDPOINT);
        url.searchParams.set("lat", String(ctx.lat));
        url.searchParams.set("lon", String(ctx.lon));
        url.searchParams.set("radius_miles", String(ctx.radiusMiles));
        const res = await fetch(url.toString());
        if (!res.ok) {
            throw new Error(`HRRR Smoke fetch failed: ${res.status} ${res.statusText}`);
        }
        const raw = await res.json();
        const parsed = HrrrSmokeResponseSchema.safeParse(raw);
        if (!parsed.success) {
            throw new Error(JSON.stringify(parsed.error.format(), null, 2));
        }
        return parsed.data;
    },
    observedAt(data) {
        if (data.length === 0)
            return { min: 0, max: 0 };
        const times = data.map((o) => o.validTs);
        return { min: Math.min(...times), max: Math.max(...times) };
    },
};
//# sourceMappingURL=hrrr_smoke.js.map