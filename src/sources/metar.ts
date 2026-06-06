import { z } from "zod";
import { Source, SourceContext, boundsFrom } from "./types";

const MetarCloudLayerSchema = z.object({
  cover: z.string(),
  base: z.number().optional(),
});

const MetarObservationSchema = z.object({
  icaoId: z.string(),
  receiptTime: z.string(),
  obsTime: z.number(),
  reportTime: z.string(),
  temp: z.number(),
  dewp: z.number(),
  wdir: z.number(),
  wspd: z.number(),
  wg: z.number().optional(),
  visib: z.union([z.number(), z.string()]),
  altim: z.number(),
  slp: z.number().optional(),
  qcField: z.number(),
  metarType: z.string(),
  rawOb: z.string(),
  lat: z.number(),
  lon: z.number(),
  elev: z.number(),
  name: z.string(),
  cover: z.string(),
  clouds: z.array(MetarCloudLayerSchema),
  wxString: z.string().optional(),
  fltCat: z.string(),
});

const MetarResponseSchema = z.array(MetarObservationSchema);

export type MetarObservation = z.infer<typeof MetarObservationSchema>;

function bboxFromPoint(lat: number, lon: number, radiusMiles: number) {
  const latDelta = radiusMiles / 69;
  const lonDelta = radiusMiles / (69 * Math.cos((lat * Math.PI) / 180));
  return {
    south: lat - latDelta,
    west: lon - lonDelta,
    north: lat + latDelta,
    east: lon + lonDelta,
  };
}

export const metarSource: Source<MetarObservation> = {
  name: "METAR",
  cadenceMs: 5 * 60 * 1000,
  schema: MetarResponseSchema,
  isEnabled() {
    return true;
  },
  async fetch(ctx: SourceContext) {
    const { south, west, north, east } = bboxFromPoint(ctx.lat, ctx.lon, ctx.radiusMiles);
    const url = `https://aviationweather.gov/api/data/metar?bbox=${south},${west},${north},${east}&format=json`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`METAR fetch failed: ${res.status} ${res.statusText}`);
    }
    const raw = await res.json();
    const parsed = MetarResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(JSON.stringify(parsed.error.format(), null, 2));
    }
    return parsed.data;
  },
  observedAt(data) {
    return boundsFrom(data, (o) => o.obsTime);
  },
};
