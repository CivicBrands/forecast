import { z } from "zod";
import { Source, SourceContext, boundsFrom } from "./types";

export const EventObservationSchema = z.object({
  id: z.string(),
  provider: z.string(),
  provider_id: z.string(),
  name: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  timezone: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  venue_name: z.string().optional(),
  category: z.string().optional(),
  labels: z.array(z.string()).optional(),
  expected_presence: z.number().optional(),
  rank: z.number().optional(),
  local_rank: z.number().optional(),
  confidence: z.number(),
  url: z.string().optional(),
});

const EventResponseSchema = z.array(EventObservationSchema);

export type EventObservation = z.infer<typeof EventObservationSchema>;

const PredictHqEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().optional(),
  labels: z.array(z.string()).optional(),
  rank: z.number().optional(),
  local_rank: z.number().optional(),
  phq_attendance: z.number().optional(),
  start: z.string(),
  end: z.string().optional(),
  predicted_end: z.string().optional(),
  timezone: z.string().optional(),
  location: z.tuple([z.number(), z.number()]).optional(),
  geo: z
    .object({
      address: z
        .object({
          formatted_address: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  entities: z
    .array(
      z.object({
        name: z.string().optional(),
        type: z.string().optional(),
      }),
    )
    .optional(),
});

const PredictHqResponseSchema = z.object({
  results: z.array(PredictHqEventSchema),
});

type PredictHqEvent = z.infer<typeof PredictHqEventSchema>;

export const eventsSource: Source<EventObservation> = {
  name: "EVENTS",
  cadenceMs: 30 * 60 * 1000,
  schema: EventResponseSchema,
  isEnabled(ctx: SourceContext) {
    return Boolean(ctx.env.PREDICTHQ_API_KEY);
  },
  async fetch(ctx: SourceContext) {
    const data = await fetchPredictHq(ctx);
    const parsed = EventResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(JSON.stringify(parsed.error.format(), null, 2));
    }
    return parsed.data;
  },
  observedAt(data) {
    return boundsFrom(data, (o) => epochSeconds(o.starts_at));
  },
};

async function fetchPredictHq(ctx: SourceContext): Promise<EventObservation[]> {
  const now = new Date();
  const lookaheadHours = Number(ctx.env.EVENTS_LOOKAHEAD_HOURS ?? 24);
  const until = new Date(now.getTime() + lookaheadHours * 60 * 60 * 1000);
  const categories =
    ctx.env.PREDICTHQ_CATEGORIES ?? "conferences,expos,concerts,festivals,performing-arts,community,sports";
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

function toEventObservation(e: PredictHqEvent): EventObservation {
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

function epochSeconds(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : Math.floor(t / 1000);
}
