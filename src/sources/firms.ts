import { z } from "zod";
import { Source, SourceContext, boundsFrom } from "./types";

const FirmsObservationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  bright_ti4: z.number().optional(),
  bright_ti5: z.number().optional(),
  scan: z.number().optional(),
  track: z.number().optional(),
  acq_date: z.string(),
  acq_time: z.string(),
  satellite: z.string().optional(),
  instrument: z.string().optional(),
  confidence: z.union([z.string(), z.number()]).optional(),
  version: z.string().optional(),
  frp: z.number().optional(),
  daynight: z.string().optional(),
});

const FirmsResponseSchema = z.array(FirmsObservationSchema);

export type FirmsObservation = z.infer<typeof FirmsObservationSchema>;

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

function epochSeconds(o: FirmsObservation): number {
  const hh = o.acq_time.padStart(4, "0").slice(0, 2);
  const mm = o.acq_time.padStart(4, "0").slice(2, 4);
  const d = new Date(`${o.acq_date}T${hh}:${mm}:00Z`);
  return Math.floor(d.getTime() / 1000);
}

function parseCsv(text: string): unknown[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim());
  const numeric = new Set([
    "latitude",
    "longitude",
    "bright_ti4",
    "bright_ti5",
    "scan",
    "track",
    "frp",
  ]);
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, unknown> = {};
    header.forEach((key, i) => {
      const v = cells[i]?.trim();
      if (v === undefined || v === "") return;
      row[key] = numeric.has(key) ? Number(v) : v;
    });
    return row;
  });
}

export const firmsSource: Source<FirmsObservation> = {
  name: "FIRMS",
  cadenceMs: 60 * 60 * 1000,
  schema: FirmsResponseSchema,
  isEnabled(ctx: SourceContext) {
    return Boolean(ctx.env.FIRMS_MAP_KEY);
  },
  async fetch(ctx: SourceContext) {
    const key = ctx.env.FIRMS_MAP_KEY!;
    const { south, west, north, east } = bboxFromPoint(ctx.lat, ctx.lon, ctx.radiusMiles);
    const area = `${west},${south},${east},${north}`;
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/${area}/1`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`FIRMS fetch failed: ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    const rows = parseCsv(text);
    const parsed = FirmsResponseSchema.safeParse(rows);
    if (!parsed.success) {
      throw new Error(JSON.stringify(parsed.error.format(), null, 2));
    }
    return parsed.data;
  },
  observedAt(data) {
    if (data.length === 0) return { min: 0, max: 0 };
    return boundsFrom(data, epochSeconds);
  },
};
