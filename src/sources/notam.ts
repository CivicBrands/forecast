import { z } from "zod";
import { Source, SourceContext } from "./types";

const NotamObservationSchema = z.object({
  id: z.string(),
  location: z.string(),
  effectiveStart: z.string(),
  effectiveEnd: z.string().optional(),
  text: z.string(),
  classification: z.string().optional(),
});

const NotamResponseSchema = z.array(NotamObservationSchema);

export type NotamObservation = z.infer<typeof NotamObservationSchema>;

type RawNotam = {
  properties?: {
    coreNOTAMData?: {
      notam?: {
        id?: string;
        location?: string;
        effectiveStart?: string;
        effectiveEnd?: string;
        text?: string;
        classification?: string;
      };
    };
  };
};

export const notamSource: Source<NotamObservation> = {
  name: "NOTAM",
  cadenceMs: 15 * 60 * 1000,
  schema: NotamResponseSchema,
  isEnabled(ctx: SourceContext) {
    return Boolean(ctx.env.FAA_CLIENT_ID && ctx.env.FAA_CLIENT_SECRET);
  },
  async fetch(ctx: SourceContext) {
    const url = new URL("https://external-api.faa.gov/notamapi/v1/notams");
    url.searchParams.set("locationLatitude", String(ctx.lat));
    url.searchParams.set("locationLongitude", String(ctx.lon));
    url.searchParams.set("locationRadius", String(ctx.radiusMiles));
    const res = await fetch(url.toString(), {
      headers: {
        client_id: ctx.env.FAA_CLIENT_ID!,
        client_secret: ctx.env.FAA_CLIENT_SECRET!,
      },
    });
    if (!res.ok) {
      throw new Error(`NOTAM fetch failed: ${res.status} ${res.statusText}`);
    }
    const raw = (await res.json()) as { items?: RawNotam[] };
    const flattened = (raw.items ?? []).map((item) => {
      const n = item.properties?.coreNOTAMData?.notam ?? {};
      return {
        id: n.id ?? "",
        location: n.location ?? "",
        effectiveStart: n.effectiveStart ?? "",
        effectiveEnd: n.effectiveEnd,
        text: n.text ?? "",
        classification: n.classification,
      };
    });
    const parsed = NotamResponseSchema.safeParse(flattened);
    if (!parsed.success) {
      throw new Error(JSON.stringify(parsed.error.format(), null, 2));
    }
    return parsed.data;
  },
  observedAt(data) {
    if (data.length === 0) return { min: 0, max: 0 };
    const times = data
      .map((o) => Math.floor(new Date(o.effectiveStart).getTime() / 1000))
      .filter((t) => !Number.isNaN(t) && t > 0);
    if (times.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...times), max: Math.max(...times) };
  },
};
