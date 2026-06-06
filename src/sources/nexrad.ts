import { z } from "zod";
import { Source, SourceContext } from "./types";

const NexradObservationSchema = z.object({
  station: z.string(),
  ts: z.number(),
  vcp: z.number().optional(),
  s3_key: z.string(),
});

const NexradResponseSchema = z.array(NexradObservationSchema);

export type NexradObservation = z.infer<typeof NexradObservationSchema>;

export const nexradSource: Source<NexradObservation> = {
  name: "NEXRAD",
  cadenceMs: 10 * 60 * 1000,
  schema: NexradResponseSchema,
  isEnabled(ctx: SourceContext) {
    return Boolean(ctx.env.NEXRAD_STATIONS);
  },
  async fetch(ctx: SourceContext) {
    const stations = (ctx.env.NEXRAD_STATIONS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const results: NexradObservation[] = [];
    for (const station of stations) {
      const url = `https://unidata-nexrad-level2.s3.amazonaws.com/?list-type=2&prefix=${encodeURIComponent(latestPrefix(station))}&max-keys=1`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const xml = await res.text();
      const keyMatch = xml.match(/<Key>([^<]+)<\/Key>/);
      const lastModMatch = xml.match(/<LastModified>([^<]+)<\/LastModified>/);
      if (!keyMatch || !lastModMatch) continue;
      results.push({
        station,
        ts: Math.floor(new Date(lastModMatch[1]).getTime() / 1000),
        s3_key: keyMatch[1],
      });
    }
    const parsed = NexradResponseSchema.safeParse(results);
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

function latestPrefix(station: string): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${d}/${station}/`;
}
