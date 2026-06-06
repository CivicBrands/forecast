import { z } from "zod";
import { Source, SourceContext } from "./types";

const NldnObservationSchema = z.object({
  ts: z.number(),
  lat: z.number(),
  lon: z.number(),
  peak_kA: z.number(),
  type: z.string(),
});

const NldnResponseSchema = z.array(NldnObservationSchema);

export type NldnObservation = z.infer<typeof NldnObservationSchema>;

export const nldnSource: Source<NldnObservation> = {
  name: "NLDN",
  cadenceMs: 5 * 60 * 1000,
  schema: NldnResponseSchema,
  isEnabled(ctx: SourceContext) {
    return Boolean(ctx.env.NLDN_TOKEN && ctx.env.NLDN_ENDPOINT);
  },
  async fetch(ctx: SourceContext) {
    const url = new URL(ctx.env.NLDN_ENDPOINT!);
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
    if (data.length === 0) return { min: 0, max: 0 };
    const times = data.map((o) => o.ts);
    return { min: Math.min(...times), max: Math.max(...times) };
  },
};
