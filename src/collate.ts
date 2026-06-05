import { appendCollation, Collation, latestSnapshot, SourceKey } from "./store";
import { config } from "./config";

const ALL_SOURCES: SourceKey[] = ["METAR", "AIRNOW"];

export function collate(now: number = Date.now()): Collation | null {
  const sources: Collation["sources"] = {};
  let observedMin = Infinity;
  let observedMax = -Infinity;

  for (const src of ALL_SOURCES) {
    const snap = latestSnapshot(src);
    if (!snap || snap.id === undefined) continue;
    if (now - snap.fetched_at > config.collationMaxAgeMs) continue;

    sources[src] = {
      snapshot_id: snap.id,
      fetched_at: snap.fetched_at,
      record_count: snap.data.length,
    };
    if (snap.observed_at_min < observedMin) observedMin = snap.observed_at_min;
    if (snap.observed_at_max > observedMax) observedMax = snap.observed_at_max;
  }

  if (Object.keys(sources).length === 0) return null;

  const c: Collation = {
    collated_at: now,
    observed_at_min: observedMin,
    observed_at_max: observedMax,
    sources,
  };
  c.id = appendCollation(c);
  return c;
}
