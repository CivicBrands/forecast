import { z } from "zod";
import { Source, SourceContext } from "./types";

const HrrrSmokeObservationSchema = z.object({
  runTs: z.number(),
  validTs: z.number(),
  lat: z.number(),
  lon: z.number(),
  near_surface_smoke: z.number(),
});

const HrrrSmokeResponseSchema = z.array(HrrrSmokeObservationSchema);

export type HrrrSmokeObservation = z.infer<typeof HrrrSmokeObservationSchema>;

export const hrrrSmokeSource: Source<HrrrSmokeObservation> = {
  name: "HRRR_SMOKE",
  cadenceMs: 60 * 60 * 1000,
  schema: HrrrSmokeResponseSchema,
  isEnabled(ctx: SourceContext) {
    return Boolean(ctx.env.HRRR_SMOKE_ENDPOINT);
  },
  async fetch(ctx: SourceContext) {
    const url = new URL(ctx.env.HRRR_SMOKE_ENDPOINT!);
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
    if (data.length === 0) return { min: 0, max: 0 };
    const times = data.map((o) => o.validTs);
    return { min: Math.min(...times), max: Math.max(...times) };
  },
};
