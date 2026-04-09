import { z } from "zod";

// --- METAR schema (matches real aviationweather.gov response) ---

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

// --- Geo helpers ---

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

// --- Ingestion ---

export async function ingestMetar(lat: number, lon: number, radiusMiles = 30) {
  const { south, west, north, east } = bboxFromPoint(lat, lon, radiusMiles);
  const url = `https://aviationweather.gov/api/data/metar?bbox=${south},${west},${north},${east}&format=json`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`METAR fetch failed: ${res.status} ${res.statusText}`);
  }

  const raw = await res.json();
  return validateMetar(raw);
}

// --- Validation ---

export function validateMetar(input: unknown): MetarObservation[] {
  const result = MetarResponseSchema.safeParse(input);

  if (!result.success) {
    throw new Error(JSON.stringify(result.error.format(), null, 2));
  }

  return result.data;
}

// --- AirNow schema (matches real airnowapi.org response) ---

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

// --- AirNow Ingestion ---

export async function ingestAirNow(lat: number, lon: number, distanceMiles = 30, apiKey: string) {
  const url = `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=${lat}&longitude=${lon}&distance=${distanceMiles}&API_KEY=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`AirNow fetch failed: ${res.status} ${res.statusText}`);
  }

  const raw = await res.json();
  return validateAirNow(raw);
}

export function validateAirNow(input: unknown): AirNowObservation[] {
  const result = AirNowResponseSchema.safeParse(input);

  if (!result.success) {
    throw new Error(JSON.stringify(result.error.format(), null, 2));
  }

  return result.data;
}
