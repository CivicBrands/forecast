import { z } from "zod";
import { Source, SourceContext, boundsFrom } from "./types";

const AirNowCategorySchema = z.object({
  Number: z.number(),
  Name: z.string(),
});

const AirNowObservationSchema = z.object({
  DateObserved: z.string(),
  HourObserved: z.number(),
  LocalTimeZone: z.string(),
  ReportingArea: z.string(),
  StateCode: z.string(),
  Latitude: z.number(),
  Longitude: z.number(),
  ParameterName: z.string(),
  AQI: z.number(),
  Category: AirNowCategorySchema,
});

const AirNowResponseSchema = z.array(AirNowObservationSchema);

export type AirNowObservation = z.infer<typeof AirNowObservationSchema>;

function epochSeconds(o: AirNowObservation): number {
  const d = new Date(`${o.DateObserved}T${String(o.HourObserved).padStart(2, "0")}:00:00`);
  return Math.floor(d.getTime() / 1000);
}

export const airnowSource: Source<AirNowObservation> = {
  name: "AIRNOW",
  cadenceMs: 5 * 60 * 1000,
  schema: AirNowResponseSchema,
  isEnabled(ctx: SourceContext) {
    return Boolean(ctx.env.AIRNOW_API_KEY);
  },
  async fetch(ctx: SourceContext) {
    const key = ctx.env.AIRNOW_API_KEY!;
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
    return boundsFrom(data, epochSeconds);
  },
};
