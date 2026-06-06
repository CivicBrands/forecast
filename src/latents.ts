import { Collation, latestSnapshot } from "./store";

export type DerivedLatent = {
  name: string;
  value: number;
  inputs: Record<string, unknown>;
  confidence?: number;
};

type SnapshotLookup = (source: string) => { data: unknown[] } | null;

/**
 * Derive cross-source latent signals from a collation.
 *
 * A latent is computed only when every source it depends on is present in the
 * collation. Absence MUST NOT be interpolated.
 */
export function deriveLatents(c: Collation, lookup: SnapshotLookup = (s) => latestSnapshot(s)): DerivedLatent[] {
  const out: DerivedLatent[] = [];
  const has = (name: string) => Boolean(c.sources[name]);

  if (has("AIRNOW")) {
    const snap = lookup("AIRNOW");
    if (snap) {
      const aqis = snap.data
        .map((d) => (d as { AQI?: number }).AQI)
        .filter((n): n is number => typeof n === "number");
      if (aqis.length > 0) {
        out.push({
          name: "aqi_max",
          value: Math.max(...aqis),
          inputs: { source: "AIRNOW", samples: aqis.length },
        });
      }
    }
  }

  if (has("METAR")) {
    const snap = lookup("METAR");
    if (snap) {
      const visib = snap.data
        .map((d) => {
          const v = (d as { visib?: number | string }).visib;
          if (typeof v === "number") return v;
          const n = Number(v);
          return Number.isFinite(n) ? n : undefined;
        })
        .filter((n): n is number => typeof n === "number");
      if (visib.length > 0) {
        out.push({
          name: "visibility_min_sm",
          value: Math.min(...visib),
          inputs: { source: "METAR", samples: visib.length },
        });
      }
    }
  }

  if (has("FIRMS")) {
    const snap = lookup("FIRMS");
    if (snap) {
      out.push({
        name: "fire_detection_count",
        value: snap.data.length,
        inputs: { source: "FIRMS" },
      });
    }
  }

  if (has("AIRNOW") && has("FIRMS")) {
    const aq = lookup("AIRNOW");
    const fire = lookup("FIRMS");
    if (aq && fire) {
      const pm = aq.data
        .filter((d) => /PM2\.5|PM10/.test((d as { ParameterName?: string }).ParameterName ?? ""))
        .map((d) => (d as { AQI?: number }).AQI)
        .filter((n): n is number => typeof n === "number");
      const pmMax = pm.length > 0 ? Math.max(...pm) : 0;
      const fires = fire.data.length;
      out.push({
        name: "smoke_impacted_aq",
        value: fires > 0 ? pmMax : 0,
        inputs: { pm_aqi_max: pmMax, fire_count: fires },
        confidence: fires > 0 ? Math.min(1, fires / 10) : 0,
      });
    }
  }

  return out;
}
