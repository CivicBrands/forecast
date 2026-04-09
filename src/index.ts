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

// --- Run ---

async function main() {
  const [metarObs, airNowObs] = await Promise.all([
    ingestMetar(USER_LAT, USER_LON, RADIUS_MILES),
    ingestAirNow(USER_LAT, USER_LON, RADIUS_MILES, AIRNOW_API_KEY),
  ]);

  storeMetar(metarObs);
  storeAirNow(airNowObs);

  // --- Summary ---
  console.log(`METAR: ${metarObs.length} stations`);
  for (const obs of metarObs) {
    console.log(`  ${obs.icaoId} (${obs.name}) — ${obs.temp}°C, wind ${obs.wdir}°/${obs.wspd}kt, ${obs.fltCat}`);
  }

  console.log(`\nAIRNOW: ${airNowObs.length} observations`);
  for (const obs of airNowObs) {
    console.log(`  ${obs.ReportingArea}, ${obs.StateCode} — ${obs.ParameterName}: AQI ${obs.AQI} (${obs.Category.Name})`);
  }

  console.log("\nSTORE:");
  console.log(JSON.stringify(STORE, null, 2));
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
