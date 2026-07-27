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

test("raises an active NWS extreme heat warning as a fourth-order alert", () => {
  const now = Date.parse("2026-07-27T16:00:00-05:00");
  const c = fakeCollation(["NWS_ALERTS"]);
  c.collated_at = now;
  const latents = deriveLatents(
    c,
    () => ({
      data: [{
        id: "urn:example",
        event: "Extreme Heat Warning",
        description: "* WHAT...Dangerously hot conditions with heat index values up to 110.",
        onset: "2026-07-27T14:33:00-05:00",
        ends: "2026-07-28T07:00:00-05:00",
        severity: "Severe",
        urgency: "Expected",
        certainty: "Likely",
      }],
    }),
    { now },
  );
  const heat = latents.find((l) => l.name === "declared_weather_hazard");
  assert.ok(heat);
  assert.equal(heat.label, "Extreme Heat Warning");
  assert.equal(heat.severity, "alert");
  assert.equal(heat.order, 4);
  assert.match(heat.summary, /heat index values up to 110/);
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
  assert.equal(sia.order, 2);
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

test("derives third order smoke transport from particles fires and modeled smoke", () => {
  const c = fakeCollation(["AIRNOW", "FIRMS", "HRRR_SMOKE"]);
  const latents = deriveLatents(c, (s) => {
    if (s === "AIRNOW") return { data: [{ AQI: 135, ParameterName: "PM2.5" }] };
    if (s === "FIRMS") return { data: [{ frp: 15 }, { frp: 80 }, { frp: 20 }, { frp: 12 }] };
    if (s === "HRRR_SMOKE") return { data: [{ near_surface_smoke: 35 }, { near_surface_smoke: 12 }] };
    return null;
  });

  const smoke = latents.find((l) => l.name === "smoke_transport_pressure");
  assert.ok(smoke);
  assert.equal(smoke.order, 3);
  assert.equal(smoke.severity, "alert");
  assert.equal(smoke.inputs.hrrr_smoke_max, 35);
  assert.ok(smoke.value > 50);
});

test("advective_smoke_provenance implicates an upwind Flint Hills fire under SW wind", () => {
  const now = Date.parse("2026-04-10T14:00:00-05:00"); // April = burn season
  const c = fakeCollation(["FIRMS", "METAR", "AIRNOW", "HRRR_SMOKE"]);
  c.collated_at = now;
  const latents = deriveLatents(
    c,
    (s) => {
      // Station at KC; wind FROM 225 (SW).
      if (s === "METAR") return { data: [{ lat: 39.1, lon: -94.6, wdir: 225, wspd: 12, visib: 8, fltCat: "VFR" }] };
      // Fire to the SW of the field (lower lat, more-negative lon) → bearing ~SW, upwind.
      if (s === "FIRMS") return { data: [{ latitude: 38.4, longitude: -95.6, frp: 90 }] };
      if (s === "AIRNOW") return { data: [{ AQI: 130, ParameterName: "PM2.5" }] };
      if (s === "HRRR_SMOKE") return { data: [{ near_surface_smoke: 30 }] };
      return null;
    },
    { now, locationLabel: "Kansas City area" },
  );

  const adv = latents.find((l) => l.name === "advective_smoke_provenance");
  assert.ok(adv);
  assert.equal(adv.order, 3);
  assert.equal(adv.family, "smoke");
  assert.equal(adv.inputs.upwind_fire_count, 1);
  assert.equal(adv.severity, "alert");
  assert.ok(adv.value >= 60);
  assert.match(String(adv.inputs.source_region), /Flint Hills/);
});

test("advective_smoke_provenance ignores a downwind fire", () => {
  const now = Date.parse("2026-04-10T14:00:00-05:00");
  const c = fakeCollation(["FIRMS", "METAR"]);
  c.collated_at = now;
  const latents = deriveLatents(
    c,
    (s) => {
      if (s === "METAR") return { data: [{ lat: 39.1, lon: -94.6, wdir: 225, wspd: 12, visib: 8, fltCat: "VFR" }] };
      // Fire to the NE (downwind of a SW wind) → not implicated.
      if (s === "FIRMS") return { data: [{ latitude: 39.8, longitude: -93.9, frp: 90 }] };
      return null;
    },
    { now },
  );
  const adv = latents.find((l) => l.name === "advective_smoke_provenance");
  assert.ok(adv);
  assert.equal(adv.inputs.upwind_fire_count, 0);
  assert.equal(adv.value, 0);
  assert.equal(adv.severity, "ok");
});

test("advective_smoke_provenance reports calm when winds are near zero", () => {
  const c = fakeCollation(["FIRMS", "METAR"]);
  const latents = deriveLatents(c, (s) => {
    if (s === "METAR") return { data: [{ lat: 39.1, lon: -94.6, wdir: 0, wspd: 0, visib: 10, fltCat: "VFR" }] };
    if (s === "FIRMS") return { data: [{ latitude: 38.4, longitude: -95.6, frp: 90 }] };
    return null;
  });
  const adv = latents.find((l) => l.name === "advective_smoke_provenance");
  assert.ok(adv);
  assert.equal(adv.inputs.calm, true);
  assert.equal(adv.value, 0);
});

test("derives compound field stress from multiple independent latent families", () => {
  const c = fakeCollation(["AIRNOW", "METAR", "FIRMS", "HRRR_SMOKE", "NEXRAD", "NLDN"]);
  const latents = deriveLatents(c, (s) => {
    if (s === "AIRNOW") return { data: [{ AQI: 125, ParameterName: "PM2.5" }, { AQI: 90, ParameterName: "O3" }] };
    if (s === "METAR") return { data: [{ visib: 2, fltCat: "IFR", wg: 32 }] };
    if (s === "FIRMS") return { data: [{ frp: 20 }, { frp: 40 }, { frp: 60 }] };
    if (s === "HRRR_SMOKE") return { data: [{ near_surface_smoke: 40 }] };
    if (s === "NEXRAD") return { data: [{ station: "KEAX" }] };
    if (s === "NLDN") return { data: [{ peak_kA: -18 }, { peak_kA: 24 }] };
    return null;
  });

  const compound = latents.find((l) => l.name === "compound_field_stress");
  assert.ok(compound);
  assert.equal(compound.order, 4);
  assert.equal(compound.family, "field");
  assert.ok(Array.isArray(compound.inputs.latent_names));
  assert.ok(compound.value > 50);
});

test("derives declared constraints and collision from NOTAM plus local rhythm", () => {
  const now = Date.parse("2026-06-08T13:30:00-05:00");
  const c = fakeCollation(["NOTAM", "METAR", "NEXRAD", "NLDN"]);
  c.collated_at = now;
  const latents = deriveLatents(
    c,
    (s) => {
      if (s === "NOTAM") {
        return {
          data: [
            {
              effective_start: "2026-06-08T12:00:00-05:00",
              effective_end: "2026-06-08T15:00:00-05:00",
              classification: "AIRSPACE",
              text: "AIRSPACE RESTRICTED DUE TO HAZARD",
            },
            {
              effective_start: "2026-06-09T12:00:00-05:00",
              effective_end: "2026-06-09T15:00:00-05:00",
              classification: "FUTURE",
              text: "FUTURE NOTICE",
            },
          ],
        };
      }
      if (s === "METAR") return { data: [{ visib: 2, fltCat: "IFR", wg: 35 }] };
      if (s === "NEXRAD") return { data: [{ station: "KEAX" }] };
      if (s === "NLDN") return { data: [{ peak_kA: 20 }, { peak_kA: -18 }] };
      return null;
    },
    {
      now,
      locationLabel: "Kansas City area",
      events: [
        {
          name: "Downtown match ingress",
          starts_at: Date.parse("2026-06-08T12:30:00-05:00"),
          ends_at: Date.parse("2026-06-08T14:30:00-05:00"),
          expected_presence: 30,
          tags: ["event", "ingress"],
        },
      ],
    },
  );

  const rhythm = latents.find((l) => l.name === "civic_temporal_rhythm");
  assert.ok(rhythm);
  assert.equal(rhythm.inputs.active_events instanceof Array, true);
  assert.equal(rhythm.inputs.location, "Kansas City area");

  const declared = latents.find((l) => l.name === "declared_operational_constraint");
  assert.ok(declared);
  assert.equal(declared.inputs.active_notam_count, 1);
  assert.equal(declared.severity, "watch");

  const collision = latents.find((l) => l.name === "constraint_collision");
  assert.ok(collision);
  assert.equal(collision.order, 4);
  assert.equal(collision.family, "operations");
  assert.equal(collision.severity, "watch");
  assert.ok(collision.value >= 60);
});

test("derives holiday rhythm without pretending live events exist", () => {
  const now = Date.parse("2026-07-04T12:00:00-05:00");
  const c = fakeCollation(["METAR"]);
  c.collated_at = now;
  const latents = deriveLatents(c, (s) => (s === "METAR" ? { data: [{ visib: 10, fltCat: "VFR" }] } : null), {
    now,
    locationLabel: "Kansas City area",
  });

  const rhythm = latents.find((l) => l.name === "civic_temporal_rhythm");
  assert.ok(rhythm);
  assert.equal(rhythm.inputs.day_type, "holiday");
  assert.deepEqual(rhythm.inputs.active_events, []);
});

test("uses EVENTS snapshots as civic temporal context", () => {
  const now = Date.parse("2026-06-08T13:30:00-05:00");
  const c = fakeCollation(["EVENTS"]);
  c.collated_at = now;
  const latents = deriveLatents(
    c,
    (s) =>
      s === "EVENTS"
        ? {
            data: [
              {
                name: "KC Street Festival",
                starts_at: "2026-06-08T12:00:00-05:00",
                ends_at: "2026-06-08T18:00:00-05:00",
                category: "festivals",
                expected_presence: 35,
              },
            ],
          }
        : null,
    { now, locationLabel: "Kansas City area" },
  );

  const rhythm = latents.find((l) => l.name === "civic_temporal_rhythm");
  assert.ok(rhythm);
  assert.deepEqual(rhythm.inputs.active_events, ["KC Street Festival"]);
  assert.ok(rhythm.value >= 90);
});
