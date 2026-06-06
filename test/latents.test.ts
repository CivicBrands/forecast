import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveLatents } from "../src/latents";
import { Collation } from "../src/store";

function fakeCollation(sources: string[]): Collation {
  const map: Collation["sources"] = {};
  for (const s of sources) {
    map[s] = { snapshot_id: 1, fetched_at: 1000, record_count: 1 };
  }
  return {
    id: 1,
    collated_at: 1000,
    observed_at_min: 0,
    observed_at_max: 100,
    sources: map,
  };
}

test("derives aqi_max when AIRNOW present", () => {
  const c = fakeCollation(["AIRNOW"]);
  const latents = deriveLatents(c, (s) =>
    s === "AIRNOW" ? { data: [{ AQI: 42, ParameterName: "PM2.5" }, { AQI: 80, ParameterName: "O3" }] } : null,
  );
  const aqi = latents.find((l) => l.name === "aqi_max");
  assert.ok(aqi);
  assert.equal(aqi.value, 80);
});

test("omits latents whose required sources are missing", () => {
  const c = fakeCollation(["METAR"]);
  const latents = deriveLatents(c, () => null);
  assert.equal(latents.find((l) => l.name === "aqi_max"), undefined);
  assert.equal(latents.find((l) => l.name === "smoke_impacted_aq"), undefined);
});

test("smoke_impacted_aq combines AIRNOW PM and FIRMS detections", () => {
  const c = fakeCollation(["AIRNOW", "FIRMS"]);
  const latents = deriveLatents(c, (s) => {
    if (s === "AIRNOW") return { data: [{ AQI: 120, ParameterName: "PM2.5" }] };
    if (s === "FIRMS") return { data: [{ frp: 1 }, { frp: 2 }, { frp: 3 }] };
    return null;
  });
  const sia = latents.find((l) => l.name === "smoke_impacted_aq");
  assert.ok(sia);
  assert.equal(sia.value, 120);
  assert.equal(sia.inputs.fire_count, 3);
  assert.ok(sia.confidence && sia.confidence > 0);
});

test("smoke_impacted_aq is zero when no fires detected", () => {
  const c = fakeCollation(["AIRNOW", "FIRMS"]);
  const latents = deriveLatents(c, (s) => {
    if (s === "AIRNOW") return { data: [{ AQI: 50, ParameterName: "PM2.5" }] };
    if (s === "FIRMS") return { data: [] };
    return null;
  });
  const sia = latents.find((l) => l.name === "smoke_impacted_aq");
  assert.ok(sia);
  assert.equal(sia.value, 0);
  assert.equal(sia.confidence, 0);
});
