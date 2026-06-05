import "dotenv/config";
import { ingestMetar, MetarObservation, ingestAirNow, AirNowObservation } from "./ingest";
import { appendSnapshot, latestSnapshot, SourceKey } from "./store";
import { collate } from "./collate";

// --- Config ---

const USER_LAT = 39.0997;
const USER_LON = -94.5786;
const RADIUS_MILES = 30;

const AIRNOW_API_KEY = process.env.AIRNOW_API_KEY ?? "";
if (!AIRNOW_API_KEY) {
  throw new Error("AIRNOW_API_KEY not set in .env");
}

const TICK_MS = Number(process.env.TICK_MS ?? 5 * 60 * 1000);
const RUN_ONCE = process.env.RUN_ONCE === "1";

// --- Persist ---

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
  // AirNow gives DateObserved + HourObserved, not epoch — derive epoch
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

// --- Tick ---

async function tick() {
  const started = new Date().toISOString();
  console.log(`[${started}] tick`);

  const results = await Promise.allSettled([
    ingestMetar(USER_LAT, USER_LON, RADIUS_MILES).then(persistMetar),
    ingestAirNow(USER_LAT, USER_LON, RADIUS_MILES, AIRNOW_API_KEY).then(persistAirNow),
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

// --- Run ---

async function main() {
  await tick();
  if (RUN_ONCE) return;

  console.log(`scheduling next tick every ${TICK_MS}ms`);
  setInterval(() => {
    tick().catch((err) => console.error("tick error:", err));
  }, TICK_MS);
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
