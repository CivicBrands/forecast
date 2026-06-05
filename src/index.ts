import "dotenv/config";
import { ingestMetar, MetarObservation, ingestAirNow, AirNowObservation } from "./ingest";
import { appendSnapshot, latestSnapshot, SourceKey } from "./store";
import { collate } from "./collate";
import { startServer } from "./server";
import { config } from "./config";

if (!config.airnowApiKey) {
  throw new Error("AIRNOW_API_KEY not set in .env");
}

function persistMetar(observations: MetarObservation[]) {
  const obsTimes = observations.map((o) => o.obsTime);
  appendSnapshot({
    source: "METAR",
    fetched_at: Date.now(),
    observed_at_min: Math.min(...obsTimes),
    observed_at_max: Math.max(...obsTimes),
    data: observations,
  });
}

function persistAirNow(observations: AirNowObservation[]) {
  const toEpoch = (o: AirNowObservation) => {
    const d = new Date(`${o.DateObserved}T${String(o.HourObserved).padStart(2, "0")}:00:00`);
    return Math.floor(d.getTime() / 1000);
  };
  const obsTimes = observations.map(toEpoch);
  appendSnapshot({
    source: "AIRNOW",
    fetched_at: Date.now(),
    observed_at_min: Math.min(...obsTimes),
    observed_at_max: Math.max(...obsTimes),
    data: observations,
  });
}

async function tick() {
  const started = new Date().toISOString();
  console.log(`[${started}] tick`);

  const { lat, lon, radiusMiles } = config.user;
  const results = await Promise.allSettled([
    ingestMetar(lat, lon, radiusMiles).then(persistMetar),
    ingestAirNow(lat, lon, radiusMiles, config.airnowApiKey).then(persistAirNow),
  ]);

  const sources: SourceKey[] = ["METAR", "AIRNOW"];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`  ${sources[i]} failed:`, r.reason instanceof Error ? r.reason.message : r.reason);
    } else {
      const entry = latestSnapshot(sources[i]);
      console.log(`  ${sources[i]}: ${entry?.data.length ?? 0} records persisted`);
    }
  });

  const c = collate();
  if (c) {
    const srcList = Object.keys(c.sources).join(", ");
    console.log(`  COLLATED #${c.id}: [${srcList}] window ${c.observed_at_min}–${c.observed_at_max}`);
  } else {
    console.log(`  COLLATED: no fresh sources`);
  }
}

async function main() {
  await tick();
  if (config.runOnce) return;

  if (config.serve) startServer(config.port);

  console.log(`scheduling next tick every ${config.tickMs}ms`);
  setInterval(() => {
    tick().catch((err) => console.error("tick error:", err));
  }, config.tickMs);
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
