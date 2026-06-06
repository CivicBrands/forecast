"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.airnowSource = void 0;
const zod_1 = require("zod");
const types_1 = require("./types");
const AirNowCategorySchema = zod_1.z.object({
    Number: zod_1.z.number(),
    Name: zod_1.z.string(),
});
const AirNowObservationSchema = zod_1.z.object({
    DateObserved: zod_1.z.string(),
    HourObserved: zod_1.z.number(),
    LocalTimeZone: zod_1.z.string(),
    ReportingArea: zod_1.z.string(),
    StateCode: zod_1.z.string(),
    Latitude: zod_1.z.number(),
    Longitude: zod_1.z.number(),
    ParameterName: zod_1.z.string(),
    AQI: zod_1.z.number(),
    Category: AirNowCategorySchema,
});
const AirNowResponseSchema = zod_1.z.array(AirNowObservationSchema);
function epochSeconds(o) {
    const d = new Date(`${o.DateObserved}T${String(o.HourObserved).padStart(2, "0")}:00:00`);
    return Math.floor(d.getTime() / 1000);
}
exports.airnowSource = {
    name: "AIRNOW",
    cadenceMs: 5 * 60 * 1000,
    schema: AirNowResponseSchema,
    isEnabled(ctx) {
        return Boolean(ctx.env.AIRNOW_API_KEY);
    },
    async fetch(ctx) {
        const key = ctx.env.AIRNOW_API_KEY;
        const url = `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=${ctx.lat}&longitude=${ctx.lon}&distance=${ctx.radiusMiles}&API_KEY=${key}`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`AirNow fetch failed: ${res.status} ${res.statusText}`);
        }
        const raw = await res.json();
        const parsed = AirNowResponseSchema.safeParse(raw);
        if (!parsed.success) {
            throw new Error(JSON.stringify(parsed.error.format(), null, 2));
        }
        return parsed.data;
    },
    observedAt(data) {
        return (0, types_1.boundsFrom)(data, epochSeconds);
    },
};
//# sourceMappingURL=airnow.js.map