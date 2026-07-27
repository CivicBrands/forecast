import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveParkCrowding, hottestTempF } from "../src/parks";
import { loadKcParks, registryIsMeasured } from "../src/places";
import type { Place } from "../src/places";

/**
 * These tests use explicit fixtures rather than the live registry: the registry
 * is regenerated from upstream data (OSM/NLCD/HOLC) and its contents legitimately
 * change, which must never silently break the scoring contract. Registry-shape
 * assertions are kept separate and deliberately loose.
 */
function park(over: Partial<Place> & { id: string; name: string }): Place {
  return {
    category: "park",
    lat: 39.05,
    lon: -94.58,
    canopy_index: 40,
    lst_summer_index: 50,
    noise_index: 40,
    water_feature: false,
    amenities: [],
    access_points: [{ name: "Main", lat: 39.05, lon: -94.58, road: "Main St" }],
    provenance: {},
    ...over,
  };
}

// Shaded + wet + quiet: should dominate on a hot day.
const OASIS = park({
  id: "oasis",
  name: "Oasis Park",
  holc_grade: "A",
  canopy_index: 85,
  lst_summer_index: 30,
  noise_index: 15,
  water_feature: true,
  amenities: ["pond", "trails", "playground"],
  area_acres: 100,
  access_points: [
    { name: "North", lat: 39.05, lon: -94.58, road: "Wornall Rd" },
    { name: "South", lat: 39.04, lon: -94.58, road: "Summit St" },
  ],
});

// Treeless, hot, in a low-canopy redlined neighborhood: the refuge case.
const GRIDDLE = park({
  id: "griddle",
  name: "Griddle Park",
  holc_grade: "D",
  canopy_index: 12,
  neighborhood_canopy_index: 18,
  neighborhood_impervious_index: 62,
  lst_summer_index: 85,
  noise_index: 55,
  water_feature: false,
  area_acres: 30,
});

const MIDDLING = park({ id: "middling", name: "Middling Park", canopy_index: 45, lst_summer_index: 52, area_acres: 40 });

const FIXTURES = [OASIS, GRIDDLE, MIDDLING];
const HOT_SAT_PM = Date.parse("2026-07-18T16:00:00-05:00"); // Saturday 4pm CDT

test("hot afternoon concentrates crowds on the shaded, wet park", () => {
  const cast = deriveParkCrowding(FIXTURES, { now: HOT_SAT_PM, temperatureF: 98 });
  assert.equal(cast.parks[0].id, "oasis");
  assert.equal(cast.parks[0].tier, "packed");
  const griddle = cast.parks.find((p) => p.id === "griddle")!;
  assert.ok(griddle.rank > cast.parks.find((p) => p.id === "oasis")!.rank);
  assert.equal(griddle.tier, "quiet");
});

test("shade matters less on a mild day than a hot one", () => {
  const hot = deriveParkCrowding(FIXTURES, { now: HOT_SAT_PM, temperatureF: 98 });
  const mild = deriveParkCrowding(FIXTURES, { now: HOT_SAT_PM, temperatureF: 72 });
  const spread = (c: ReturnType<typeof deriveParkCrowding>) =>
    Math.max(...c.parks.map((p) => p.crowding)) - Math.min(...c.parks.map((p) => p.crowding));
  assert.ok(spread(hot) > spread(mild), "hot days should concentrate crowds more than mild days");
});

test("an active heat alert suppresses overall park demand", () => {
  const normal = deriveParkCrowding(FIXTURES, { now: HOT_SAT_PM, temperatureF: 98 });
  const alert = deriveParkCrowding(FIXTURES, { now: HOT_SAT_PM, temperatureF: 98, heatAlert: true });
  assert.equal(normal.heatAlert, false);
  assert.equal(alert.heatAlert, true);
  assert.ok(alert.demandMult < normal.demandMult);
});

test("a road closure suppresses an otherwise-top park", () => {
  const clean = deriveParkCrowding(FIXTURES, { now: HOT_SAT_PM, temperatureF: 98 });
  const closed = deriveParkCrowding(FIXTURES, {
    now: HOT_SAT_PM,
    temperatureF: 98,
    closures: [{ road: "Wornall", label: "Wornall Rd repaving" }],
  });
  const a = clean.parks.find((p) => p.id === "oasis")!;
  const b = closed.parks.find((p) => p.id === "oasis")!;
  assert.ok(b.friction > 0);
  assert.ok(b.crowding < a.crowding);
});

test("closure produces a 'bounce elsewhere' call when it knocks a park off the top", () => {
  const cast = deriveParkCrowding(FIXTURES, {
    now: Date.parse("2026-07-15T16:00:00-05:00"), // Wednesday, milder demand
    temperatureF: 85,
    closures: [{ road: "Wornall", label: "Wornall Rd repaving" }],
  });
  const oasis = cast.parks.find((p) => p.id === "oasis")!;
  assert.match(oasis.narrative, /torn up|bounce|sleeper/i);
});

test("the redlining line cites the NEIGHBORHOOD canopy, not a false geography", () => {
  const cast = deriveParkCrowding(FIXTURES, { now: HOT_SAT_PM, temperatureF: 99 });
  const g = cast.parks.find((p) => p.id === "griddle")!;
  assert.match(g.narrative, /graded D in 1939/);
  assert.match(g.narrative, /18% tree canopy/);
  // The retired claim asserted a compass direction the data never supported.
  assert.doesNotMatch(g.narrative, /east of/i);
  assert.doesNotMatch(g.narrative, /never planted/i);
});

test("no redlining line when the surrounding neighborhood is well-shaded", () => {
  const leafyRedlined = park({
    id: "leafy-d",
    name: "Leafy D Park",
    holc_grade: "D",
    canopy_index: 15,
    neighborhood_canopy_index: 44, // well above the 25% threshold
    lst_summer_index: 80,
  });
  const cast = deriveParkCrowding([OASIS, leafyRedlined], { now: HOT_SAT_PM, temperatureF: 99 });
  const p = cast.parks.find((x) => x.id === "leafy-d")!;
  assert.doesNotMatch(p.narrative, /1939/);
});

test("observed foot traffic calibrates the score and yields a signed anomaly", () => {
  const cast = deriveParkCrowding(FIXTURES, {
    now: HOT_SAT_PM,
    temperatureF: 99,
    observedFootTraffic: { griddle: 90 },
  });
  assert.equal(cast.calibrated, true);
  const g = cast.parks.find((p) => p.id === "griddle")!;
  assert.equal(g.foot_traffic, 90);
  assert.ok(g.anomaly !== undefined && g.anomaly > 40, "large positive anomaly is the safety hook");
  assert.equal(g.confidence, 0.82);
});

test("event pull lifts an otherwise-baking park", () => {
  const base = deriveParkCrowding(FIXTURES, { now: HOT_SAT_PM, temperatureF: 96 });
  const withEvent = deriveParkCrowding(FIXTURES, {
    now: HOT_SAT_PM,
    temperatureF: 96,
    eventsByPlace: { griddle: 40 },
  });
  const a = base.parks.find((p) => p.id === "griddle")!;
  const b = withEvent.parks.find((p) => p.id === "griddle")!;
  assert.ok(b.crowding > a.crowding);
  assert.ok(b.rank <= a.rank);
});

test("hottestTempF converts Celsius METAR temps to Fahrenheit", () => {
  assert.equal(hottestTempF([{ temp: 37 }, { temp: 20 }]), 99);
  assert.equal(hottestTempF([]), undefined);
});

test("runtime registry is measured, bounded, and internally consistent", () => {
  const parks = loadKcParks();
  assert.ok(registryIsMeasured(), "generated registry should be in use");
  assert.ok(parks.length > 0 && parks.length <= 24, `board size ${parks.length} should be capped`);
  for (const p of parks) {
    assert.ok(p.canopy_index >= 0 && p.canopy_index <= 100, `${p.id} canopy out of range`);
    assert.ok(p.noise_index >= 0 && p.noise_index <= 100, `${p.id} noise out of range`);
    assert.ok(Number.isFinite(p.lat) && Number.isFinite(p.lon), `${p.id} bad coords`);
  }
  // The board must retain the redlining signal, or the story silently dies.
  assert.ok(parks.filter((p) => p.holc_grade).length >= 6, "board should keep HOLC-graded parks");
});

test("measured registry carries neighborhood canopy for graded parks", () => {
  const graded = loadKcParks().filter((p) => p.holc_grade);
  const withHood = graded.filter((p) => typeof p.neighborhood_canopy_index === "number");
  assert.ok(withHood.length > 0, "graded parks should have a neighborhood canopy join");
});

// --- geolocation ("near me") scoring, tested against the runtime registry ---

test("registry supports distance ranking from an arbitrary GPS point", () => {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dist = (aLat: number, aLon: number, bLat: number, bLon: number) => {
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  };
  // Downtown KC.
  const parks = loadKcParks().map((p) => ({ id: p.id, d: dist(39.0997, -94.5786, p.lat, p.lon) }));
  parks.sort((a, b) => a.d - b.d);
  assert.ok(parks[0].d < 45, "nearest KC park should be inside the coverage radius");
  assert.ok(parks[0].d <= parks[parks.length - 1].d);
  // A point in the Atlantic must be far outside coverage.
  const far = loadKcParks().map((p) => dist(25, -40, p.lat, p.lon));
  assert.ok(Math.min(...far) > 45, "out-of-area point should fall outside coverage");
});

test("coolness ordering favours canopy and water over pavement", () => {
  const cool = (p: { canopy_index: number; lst_summer_index: number; water_feature: boolean }) =>
    Math.round(Math.min(100, Math.max(0, p.canopy_index * 0.6 + (100 - p.lst_summer_index) * 0.3 + (p.water_feature ? 12 : 0))));
  const shaded = cool({ canopy_index: 80, lst_summer_index: 25, water_feature: true });
  const paved = cool({ canopy_index: 5, lst_summer_index: 90, water_feature: false });
  assert.ok(shaded > paved, "shaded+wet should outrank hot+paved");
  assert.ok(shaded <= 100 && paved >= 0);
});
