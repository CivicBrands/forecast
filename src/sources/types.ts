import { z, ZodTypeAny } from "zod";

export type Snapshot<T = unknown> = {
  id?: number;
  source: string;
  fetched_at: number;
  observed_at_min: number;
  observed_at_max: number;
  data: T[];
};

export type SourceContext = {
  lat: number;
  lon: number;
  radiusMiles: number;
  env: Record<string, string | undefined>;
};

export interface Source<T = unknown> {
  /** Stable identifier used in snapshots and URLs. Uppercase, no spaces. */
  name: string;
  /** Cadence between fetches in ms. The runtime MAY skip ticks for slower sources. */
  cadenceMs: number;
  /** Zod schema for the upstream response (an array of observations). */
  schema: z.ZodType<T[], z.ZodTypeDef, unknown>;
  /** True when the source's credentials/env are available. Disabled sources are skipped. */
  isEnabled(ctx: SourceContext): boolean;
  /** Fetch and validate upstream observations. */
  fetch(ctx: SourceContext): Promise<T[]>;
  /** Derive observation time bounds (epoch seconds) from the validated payload. */
  observedAt(data: T[]): { min: number; max: number };
}

/** Helper for the common case: derive an epoch seconds timestamp from each observation. */
export function boundsFrom<T>(data: T[], pickEpochSeconds: (t: T) => number) {
  const times = data.map(pickEpochSeconds);
  return { min: Math.min(...times), max: Math.max(...times) };
}

export type AnySource = Source<any>;
export type { ZodTypeAny };
