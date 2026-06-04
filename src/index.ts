import "dotenv/config";
import { ingestMetar, MetarObservation, ingestAirNow, AirNowObservation } from "./ingest";

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

// --- STORE ---

type SourceKey = "METAR" | "AIRNOW";

type StoreEntry<T> = {
  source: SourceKey;
  fetched_at: number;
  observed_at_min: number;
  observed_at_max: number;
  data: T[];
};

const STORE: Partial<Record<SourceKey, StoreEntry<unknown>>> = {};

function storeMetar(observations: MetarObservation[]) {
  const obsTimes = observations.map((o) => o.obsTime);

  STORE.METAR = {
    source: "METAR",
    fetched_at: Date.now(),
    observed_at_min: Math.min(...obsTimes),
    observed_at_max: Math.max(...obsTimes),
    data: observations,
  };
}

function storeAirNow(observations: AirNowObservation[]) {
  // AirNow gives DateObserved + HourObserved, not epoch — derive epoch
  const toEpoch = (o: AirNowObservation) => {
    const d = new Date(`${o.DateObserved}T${String(o.HourObserved).padStart(2, "0")}:00:00`);
    return Math.floor(d.getTime() / 1000);
  };
  const obsTimes = observations.map(toEpoch);

  STORE.AIRNOW = {
    source: "AIRNOW",
    fetched_at: Date.now(),
    observed_at_min: Math.min(...obsTimes),
    observed_at_max: Math.max(...obsTimes),
    data: observations,
  };
}

// --- Tick ---

async function tick() {
  const started = new Date().toISOString();
  console.log(`[${started}] tick`);

  const results = await Promise.allSettled([
    ingestMetar(USER_LAT, USER_LON, RADIUS_MILES).then(storeMetar),
    ingestAirNow(USER_LAT, USER_LON, RADIUS_MILES, AIRNOW_API_KEY).then(storeAirNow),
  ]);

  const sources: SourceKey[] = ["METAR", "AIRNOW"];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`  ${sources[i]} failed:`, r.reason instanceof Error ? r.reason.message : r.reason);
    } else {
      const entry = STORE[sources[i]];
      console.log(`  ${sources[i]}: ${entry?.data.length ?? 0} records`);
    }
  });
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
