import { z } from "zod";

/**
 * Canonical NOTAM record produced by the SWIM relay from an FNS AIXM message
 * and validated by the Worker on ingest. Field names favor readability over
 * upstream fidelity; the original AIXM XML is intentionally not preserved.
 */
export const NotamRecordSchema = z.object({
  id: z.string(),
  fns_uuid: z.string(),
  number: z.string(),
  year: z.string(),
  type: z.string(),
  interpretation: z.string(),
  issued: z.string(),
  effective_start: z.string(),
  effective_end: z.string().optional(),
  location: z.string(),
  icao_location: z.string().optional(),
  airport_name: z.string().optional(),
  affected_fir: z.string().optional(),
  selection_code: z.string().optional(),
  qline: z.string().optional(),
  min_fl: z.number().optional(),
  max_fl: z.number().optional(),
  coordinates: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  radius_nm: z.number().optional(),
  classification: z.string().optional(),
  text: z.string(),
  local_format: z.string().optional(),
  icao_format: z.string().optional(),
});

export type NotamRecord = z.infer<typeof NotamRecordSchema>;

export const NotamIngestRequestSchema = z.object({
  records: z.array(NotamRecordSchema),
});

export type NotamIngestRequest = z.infer<typeof NotamIngestRequestSchema>;

/** Epoch seconds derived from `issued` for time-bounding the snapshot. */
export function epochSeconds(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.floor(t / 1000);
}
