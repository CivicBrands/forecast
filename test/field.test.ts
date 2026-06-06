import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTransientField, parseFieldLocation } from "../src/field";
import { AnySource, SourceContext } from "../src/sources/types";

function fakeSource(name: string, data: unknown[], enabled = true): AnySource {
  return {
    name,
    cadenceMs: 0,
    schema: {} as AnySource["schema"],
    isEnabled() {
      return enabled;
    },
    async fetch(_ctx: SourceContext) {
      return data;
    },
    observedAt() {
      return { min: 100, max: 200 };
    },
  };
}

test("parseFieldLocation defaults to Kansas City area", () => {
  const loc = parseFieldLocation(new URLSearchParams());
  assert.equal(loc.label, "Kansas City area");
  assert.equal(loc.source, "default");
  assert.equal(loc.radiusMiles, 30);
});

test("parseFieldLocation rejects partial or invalid coordinates", () => {
  assert.throws(() => parseFieldLocation(new URLSearchParams("lat=39")), /lat_lon_required/);
  assert.throws(() => parseFieldLocation(new URLSearchParams("lat=999&lon=-94")), /invalid_lat/);
  assert.throws(() => parseFieldLocation(new URLSearchParams("lat=39&lon=-94&radius=0")), /invalid_radius/);
});

test("buildTransientField derives location label and plain observations", async () => {
  const loc = parseFieldLocation(new URLSearchParams("lat=39.1&lon=-94.5&location_source=browser"));
  const field = await buildTransientField(
    loc,
    { AIRNOW_API_KEY: "test" },
    [
      fakeSource("AIRNOW", [
        {
          ReportingArea: "Kansas City",
          StateCode: "MO",
          ParameterName: "PM2.5",
          AQI: 42,
          Category: { Name: "Good", Number: 1 },
        },
      ]),
      fakeSource("NEXRAD", [], false),
    ],
    1_000,
  );

  assert.equal(field.location.label, "Kansas City, MO");
  assert.equal(field.sources.find((s) => s.name === "AIRNOW")?.status, "ok");
  assert.equal(field.sources.find((s) => s.name === "NEXRAD")?.status, "disabled");
  assert.equal(field.observations[0].summary, "AQI 42 (Good).");
  assert.equal(field.latents.find((l) => l.name === "aqi_max")?.value, 42);
});
