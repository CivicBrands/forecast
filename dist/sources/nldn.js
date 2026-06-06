"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nldnSource = void 0;
const zod_1 = require("zod");
const NldnObservationSchema = zod_1.z.object({
    ts: zod_1.z.number(),
    lat: zod_1.z.number(),
    lon: zod_1.z.number(),
    peak_kA: zod_1.z.number(),
    type: zod_1.z.string(),
});
const NldnResponseSchema = zod_1.z.array(NldnObservationSchema);
exports.nldnSource = {
    name: "NLDN",
    cadenceMs: 5 * 60 * 1000,
    schema: NldnResponseSchema,
    isEnabled(ctx) {
        return Boolean(ctx.env.NLDN_TOKEN && ctx.env.NLDN_ENDPOINT);
    },
    async fetch(ctx) {
        const url = new URL(ctx.env.NLDN_ENDPOINT);
        url.searchParams.set("lat", String(ctx.lat));
        url.searchParams.set("lon", String(ctx.lon));
        url.searchParams.set("radius_miles", String(ctx.radiusMiles));
        const res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${ctx.env.NLDN_TOKEN}` },
        });
        if (!res.ok) {
            throw new Error(`NLDN fetch failed: ${res.status} ${res.statusText}`);
        }
        const raw = await res.json();
        const parsed = NldnResponseSchema.safeParse(raw);
        if (!parsed.success) {
            throw new Error(JSON.stringify(parsed.error.format(), null, 2));
        }
        return parsed.data;
    },
    observedAt(data) {
        if (data.length === 0)
            return { min: 0, max: 0 };
        const times = data.map((o) => o.ts);
        return { min: Math.min(...times), max: Math.max(...times) };
    },
};
//# sourceMappingURL=nldn.js.map