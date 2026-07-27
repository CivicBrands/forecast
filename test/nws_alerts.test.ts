import { test } from "node:test";
import assert from "node:assert/strict";
import { activeHeatAlert, alertWhat, NwsAlert } from "../src/sources/nws_alerts";

const warning: NwsAlert = {
  id: "urn:example",
  event: "Extreme Heat Warning",
  description: "* WHAT...Dangerously hot conditions with heat index values up to 110.\n\n* WHERE...Kansas City.",
  onset: "2026-07-27T14:33:00-05:00",
  ends: "2026-07-28T07:00:00-05:00",
  severity: "Severe",
  urgency: "Expected",
  certainty: "Likely",
};

test("identifies an active NWS heat warning", () => {
  const now = Date.parse("2026-07-27T16:00:00-05:00");
  assert.equal(activeHeatAlert([warning], now)?.event, "Extreme Heat Warning");
  assert.equal(activeHeatAlert([warning], Date.parse("2026-07-28T08:00:00-05:00")), undefined);
});

test("extracts the NWS WHAT line for public display", () => {
  assert.equal(
    alertWhat(warning),
    "Extreme Heat Warning is in effect. Dangerously hot conditions with heat index values up to 110.",
  );
});
