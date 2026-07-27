"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventsSource = exports.EventObservationSchema = void 0;
const zod_1 = require("zod");
const types_1 = require("./types");
exports.EventObservationSchema = zod_1.z.object({
    id: zod_1.z.string(),
    provider: zod_1.z.string(),
    provider_id: zod_1.z.string(),
    name: zod_1.z.string(),
    starts_at: zod_1.z.string(),
    ends_at: zod_1.z.string(),
    timezone: zod_1.z.string().optional(),
    lat: zod_1.z.number().optional(),
    lon: zod_1.z.number().optional(),
    venue_name: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
    labels: zod_1.z.array(zod_1.z.string()).optional(),
    expected_presence: zod_1.z.number().optional(),
    rank: zod_1.z.number().optional(),
    local_rank: zod_1.z.number().optional(),
    confidence: zod_1.z.number(),
    url: zod_1.z.string().optional(),
});
const EventResponseSchema = zod_1.z.array(exports.EventObservationSchema);
const PredictHqEventSchema = zod_1.z.object({
    id: zod_1.z.string(),
    title: zod_1.z.string(),
    category: zod_1.z.string().optional(),
    labels: zod_1.z.array(zod_1.z.string()).optional(),
    rank: zod_1.z.number().optional(),
    local_rank: zod_1.z.number().optional(),
    phq_attendance: zod_1.z.number().optional(),
    start: zod_1.z.string(),
    end: zod_1.z.string().optional(),
    predicted_end: zod_1.z.string().optional(),
    timezone: zod_1.z.string().optional(),
    location: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number()]).optional(),
    geo: zod_1.z
        .object({
        address: zod_1.z
            .object({
            formatted_address: zod_1.z.string().optional(),
        })
            .optional(),
    })
        .optional(),
    entities: zod_1.z
        .array(zod_1.z.object({
        name: zod_1.z.string().optional(),
        type: zod_1.z.string().optional(),
    }))
        .optional(),
});
const PredictHqResponseSchema = zod_1.z.object({
    results: zod_1.z.array(PredictHqEventSchema),
});
exports.eventsSource = {
    name: "EVENTS",
    cadenceMs: 30 * 60 * 1000,
    schema: EventResponseSchema,
    isEnabled(ctx) {
        return Boolean(ctx.env.PREDICTHQ_API_KEY);
    },
    async fetch(ctx) {
        const data = await fetchPredictHq(ctx);
        const parsed = EventResponseSchema.safeParse(data);
        if (!parsed.success) {
            throw new Error(JSON.stringify(parsed.error.format(), null, 2));
        }
        return parsed.data;
    },
    observedAt(data) {
        return (0, types_1.boundsFrom)(data, (o) => epochSeconds(o.starts_at));
    },
};
async function fetchPredictHq(ctx) {
    const now = new Date();
    const lookaheadHours = Number(ctx.env.EVENTS_LOOKAHEAD_HOURS ?? 24);
    const until = new Date(now.getTime() + lookaheadHours * 60 * 60 * 1000);
    const categories = ctx.env.PREDICTHQ_CATEGORIES ?? "conferences,expos,concerts,festivals,performing-arts,community,sports";
    const limit = Math.min(100, Math.max(1, Number(ctx.env.PREDICTHQ_LIMIT ?? 50)));
    const url = new URL("https://api.predicthq.com/v1/events/");
    url.searchParams.set("active.gte", now.toISOString());
    url.searchParams.set("active.lte", until.toISOString());
    url.searchParams.set("active.tz", ctx.env.EVENTS_TIMEZONE ?? "America/Chicago");
    url.searchParams.set("category", categories);
    url.searchParams.set("country", "US");
    url.searchParams.set("within", `${ctx.radiusMiles}mi@${ctx.lat},${ctx.lon}`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("sort", "-local_rank,-rank,start");
    const res = await fetch(url.toString(), {
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${ctx.env.PREDICTHQ_API_KEY}`,
        },
    });
    if (!res.ok) {
        throw new Error(`PredictHQ events fetch failed: ${res.status} ${res.statusText}`);
    }
    const raw = await res.json();
    const parsed = PredictHqResponseSchema.safeParse(raw);
    if (!parsed.success) {
        throw new Error(JSON.stringify(parsed.error.format(), null, 2));
    }
    return parsed.data.results.map(toEventObservation);
}
function toEventObservation(e) {
    const venue = e.entities?.find((entity) => entity.type === "venue" && entity.name)?.name;
    const [lon, lat] = e.location ?? [];
    const expectedPresence = e.phq_attendance ?? e.local_rank ?? e.rank;
    const confidenceParts = [e.location ? 0.25 : 0, e.phq_attendance ? 0.25 : 0, e.local_rank ? 0.25 : 0, e.end || e.predicted_end ? 0.25 : 0];
    return {
        id: `PREDICTHQ:${e.id}`,
        provider: "PREDICTHQ",
        provider_id: e.id,
        name: e.title,
        starts_at: e.start,
        ends_at: e.predicted_end ?? e.end ?? e.start,
        timezone: e.timezone,
        lat,
        lon,
        venue_name: venue ?? e.geo?.address?.formatted_address,
        category: e.category,
        labels: e.labels,
        expected_presence: expectedPresence,
        rank: e.rank,
        local_rank: e.local_rank,
        confidence: Math.round(confidenceParts.reduce((sum, n) => sum + n, 0) * 100) / 100,
    };
}
function epochSeconds(iso) {
    const t = Date.parse(iso);
    return Number.isNaN(t) ? 0 : Math.floor(t / 1000);
}
//# sourceMappingURL=events.js.map