import { test } from "node:test";
import assert from "node:assert/strict";
import { eventsSource } from "../src/sources/events";

test("EVENTS is disabled without PredictHQ credentials", () => {
  assert.equal(
    eventsSource.isEnabled({
      lat: 39.0997,
      lon: -94.5786,
      radiusMiles: 30,
      env: {},
    }),
    false,
  );
});

test("EVENTS derives observed bounds from event starts", () => {
  const bounds = eventsSource.observedAt([
    {
      id: "PREDICTHQ:a",
      provider: "PREDICTHQ",
      provider_id: "a",
      name: "Morning event",
      starts_at: "2026-06-08T08:00:00-05:00",
      ends_at: "2026-06-08T10:00:00-05:00",
      confidence: 1,
    },
    {
      id: "PREDICTHQ:b",
      provider: "PREDICTHQ",
      provider_id: "b",
      name: "Evening event",
      starts_at: "2026-06-08T18:00:00-05:00",
      ends_at: "2026-06-08T20:00:00-05:00",
      confidence: 1,
    },
  ]);

  assert.equal(bounds.min, Date.parse("2026-06-08T08:00:00-05:00") / 1000);
  assert.equal(bounds.max, Date.parse("2026-06-08T18:00:00-05:00") / 1000);
});
