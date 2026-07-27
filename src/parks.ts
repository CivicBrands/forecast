/**
 * Park Crowd-Cast — the location-specific correlation that predicts *relative*
 * crowd concentration across parks from four provenanced layers:
 *
 *   STRUCTURAL   HOLC 1939 grade → the explainer behind canopy + heat + amenity gaps
 *   STATIC PULL  canopy (shade), water, amenities, quiet — precomputed per park
 *   DYNAMIC      access friction from live road/trail closures
 *   DEMAND       temperature, day-type, hour, events
 *
 * Composed: crowding = demand × (pull + event − friction), with shade and water
 * weighted UP as the temperature climbs — because on a 98° Saturday people don't
 * spread out, they pile into the handful of parks that are cool and wet.
 *
 * Voice: this is a public-facing forecast. It talks like the meteorologist who
 * calls the snow day three days out and owns it — bold, specific, a little fun,
 * hedging only when the signal is genuinely split. The ONE exception is the
 * redlining explainer: when a park is a rare cool island in a neighborhood the
 * 1939 map left without shade, that line stays sober and cites only measured
 * numbers. It's a fact, not a bit. (See `narrate()` for what was retracted.)
 *
 * Ground truth is the known weak link. `observedFootTraffic` is the seam for a
 * SafeGraph-class feed: when present it calibrates the score AND yields a signed
 * `anomaly` (observed − predicted) — the hook for downstream safety analysis,
 * which is scored and phrased soberly, never in the crowd-cast voice.
 */

import type { Place, HolcGrade } from "./places";

export type Closure = {
  /** Road name to match against a park's access points (case-insensitive). */
  road?: string;
  /** Optional point + radius to match access points geographically. */
  lat?: number;
  lon?: number;
  radiusMiles?: number;
  label?: string;
};

export type ParkCrowdContext = {
  now: number;
  timezone?: string;
  /** Air temperature, °F. Defaults to a mild-summer 85 if unknown. */
  temperatureF?: number;
  /** NWS heat advisory/warning in effect. */
  heatAlert?: boolean;
  /** Active access barriers (WZDx / KC Scout / 311). */
  closures?: Closure[];
  /** Per-park event pull, 0..40, keyed by place id (festival in the park, etc.). */
  eventsByPlace?: Record<string, number>;
  /** Observed foot traffic, 0..100 normalized, keyed by place id (SafeGraph seam). */
  observedFootTraffic?: Record<string, number>;
};

export type ParkForecast = {
  id: string;
  name: string;
  rank: number;
  crowding: number; // 0..100
  tier: "packed" | "busy" | "moderate" | "quiet";
  pull: number;
  friction: number;
  demandMult: number;
  holc_grade?: HolcGrade;
  drivers: Record<string, number>;
  narrative: string;
  confidence: number;
  foot_traffic?: number;
  /** observed − predicted, signed. Populated only when calibrated. Safety hook. */
  anomaly?: number;
};

export type CrowdCast = {
  generated_at: number;
  location: string;
  temperatureF: number;
  heatAlert: boolean;
  heatMode: number; // 0..1
  demandMult: number;
  calibrated: boolean;
  parks: ParkForecast[];
};

const R_MILES = 3958.8;
const toRad = (d: number) => (d * Math.PI) / 180;
function haversineMiles(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.min(1, Math.sqrt(s)));
}
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function localParts(ts: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
    weekday: "short",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ts));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour"));
  return { hour: hour === 24 ? 0 : hour, weekday: get("weekday") };
}

/** Global day/weather demand multiplier (~0.2 dead night → ~1.4 hot weekend afternoon). */
function demandMultiplier(now: number, timezone: string, temperatureF: number, heatAlert: boolean): number {
  const { hour, weekday } = localParts(now, timezone);
  const weekend = weekday === "Sat" || weekday === "Sun";
  let m = weekend ? 1.12 : 0.72;
  if (hour < 7) m *= 0.28;
  else if (hour < 11) m *= 0.72;
  else if (hour < 15) m *= 1.0;
  else if (hour < 19) m *= 1.18;
  else if (hour < 21) m *= 0.92;
  else m *= 0.5;
  // People come out as it warms — then bail when it turns brutal.
  if (temperatureF >= 72 && temperatureF <= 92) m *= 1.08;
  if (temperatureF > 100 || heatAlert) m *= 0.82;
  if (temperatureF > 105) m *= 0.72;
  return clamp(m, 0.15, 1.5);
}

/** How much the day is "seek shade and water" weather, 0..1. */
function heatModeOf(temperatureF: number): number {
  return clamp((temperatureF - 78) / 20, 0, 1);
}

function frictionFor(park: Place, closures: Closure[]): { friction: number; hits: string[] } {
  const hits: string[] = [];
  for (const c of closures) {
    const roadHit =
      c.road &&
      park.access_points.some((a) => a.road.toLowerCase().includes(c.road!.toLowerCase()) || c.road!.toLowerCase().includes(a.road.toLowerCase()));
    const geoHit =
      typeof c.lat === "number" &&
      typeof c.lon === "number" &&
      park.access_points.some((a) => haversineMiles(a.lat, a.lon, c.lat!, c.lon!) <= (c.radiusMiles ?? 0.3));
    if (roadHit || geoHit) hits.push(c.label ?? c.road ?? "closure");
  }
  // Each blocked access point hurts, but a park with many entrances survives.
  const perHit = 34;
  const cap = park.access_points.length >= 2 ? 70 : 90;
  return { friction: clamp(hits.length * perHit, 0, cap), hits };
}

function pullFor(park: Place, heat: number): { pull: number; drivers: Record<string, number> } {
  // Coefficients tuned so the best park lands ~85 (not pinned to the 100 clamp)
  // and the field spreads out, preserving ranking resolution. Shade and water
  // scale UP with heat; surface heat penalizes treeless parks harder as it warms.
  const shade = park.canopy_index * (0.09 + 0.3 * heat);
  const water = park.water_feature ? 5 + 20 * heat : 0;
  const quiet = (100 - park.noise_index) * 0.07;
  const amenities = Math.min(park.amenities.length, 6) * 1.6;
  const heatPenalty = park.lst_summer_index * (0.06 + 0.4 * heat);
  const base = 8;
  const pull = clamp(base + shade + water + quiet + amenities - heatPenalty, 0, 100);
  return {
    pull,
    drivers: {
      base,
      shade: round1(shade),
      water: round1(water),
      quiet: round1(quiet),
      amenities,
      heat_penalty: -round1(heatPenalty),
    },
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function tierOf(crowding: number): ParkForecast["tier"] {
  if (crowding >= 75) return "packed";
  if (crowding >= 55) return "busy";
  if (crowding >= 35) return "moderate";
  return "quiet";
}

/**
 * The on-air line. Deterministic (no RNG) so it's testable. Bold by default;
 * sober only where it touches the redlining explainer.
 *
 * CORRECTED 2026-07: the previous version claimed low-crowd parks sat "east of
 * the old redline" and blamed a missing park canopy. Measurement killed both
 * halves of that sentence:
 *
 *   1. Geography — HOLC grade is NOT a synonym for "east of Troost". Penn
 *      Valley Park measures grade D and sits WEST of Troost. The page was
 *      asserting a false location.
 *   2. Mechanism — canopy sampled INSIDE park polygons shows only a weak grade
 *      gradient (A+B 34.2% vs C+D 31.7%, n=61). Parks are the greenest patch of
 *      any neighborhood, so "this park has no trees because of redlining" is not
 *      supported.
 *
 * What IS measured (n=120 HOLC polygons, NLCD 2021, scripts/holc-canopy-audit.mjs):
 * the NEIGHBORHOODS differ sharply — grade A 37.6% canopy / 28.0% impervious vs
 * grade C 21.4% / 46.9%. So the honest claim inverts the original: a park in a
 * redlined neighborhood is doing MORE work as heat refuge, not less, because the
 * blocks around it have no shade to fall back on.
 */
function narrate(park: Place, f: { tier: ParkForecast["tier"]; crowding: number; heat: number; closed: string[]; hasWater: boolean }): string {
  const hot = f.heat >= 0.5;
  const lowShade = park.canopy_index < 40;
  const redlined = park.holc_grade === "D" || park.holc_grade === "C";
  const hood = park.neighborhood_canopy_index;

  if (f.closed.length > 0 && f.tier !== "packed") {
    return `Would've been a player, but ${f.closed[0]} is torn up — expect the crowd to bounce elsewhere. Sleeper day at ${park.name}.`;
  }

  if (f.tier === "packed") {
    if (hot && park.canopy_index >= 70 && f.hasWater) {
      return `Lock it in: ${park.name} is going to be a zoo. ${Math.round(park.canopy_index)}% canopy, water on site, and the coolest ground in the city — get there by noon or make peace with the walk.`;
    }
    if (hot && f.hasWater) {
      return `Bank on it — ${park.name} packs out today. When it's this hot, water wins, and this is where the coolers land.`;
    }
    return `${park.name} is the pick. Shade, quiet, and easy in-and-out — it'll be shoulder-to-shoulder by mid-afternoon.`;
  }

  if (f.tier === "busy") {
    if (hot && f.hasWater) return `Steady and full at ${park.name} — the water feature carries it on a day like this.`;
    return `${park.name} draws a solid crowd today. Not a zoo, but you won't have it to yourself.`;
  }

  if (f.tier === "moderate") {
    if (hot && lowShade) return `${park.name} sees a trickle — too much sun, not enough shade to hold anyone past an hour.`;
    return `Middle of the pack for ${park.name}: fine, unremarkable, room to spread out.`;
  }

  // quiet
  if (hot && redlined && typeof hood === "number" && hood < 25) {
    // Sober register. Every number in this sentence is measured, not inferred.
    return `${park.name} runs quiet in this heat — and that costs more here than it would elsewhere. The blocks around it, graded ${park.holc_grade} in 1939, hold about ${Math.round(hood)}% tree canopy today. This park is one of the few cool patches for a long way; there's no shaded backup down the street.`;
  }
  if (hot && lowShade) {
    return `${park.name} bakes today — open, unshaded, and quiet because of it. Load the cooler somewhere with trees.`;
  }
  return `Quiet day at ${park.name}. Nothing pulling a crowd here right now.`;
}

/**
 * Produce a ranked crowd-cast across the registry.
 */
export function deriveParkCrowding(places: Place[], ctx: ParkCrowdContext): CrowdCast {
  const timezone = ctx.timezone ?? "America/Chicago";
  const temperatureF = ctx.temperatureF ?? 85;
  const heat = heatModeOf(temperatureF);
  const demandMult = demandMultiplier(ctx.now, timezone, temperatureF, Boolean(ctx.heatAlert));
  const closures = ctx.closures ?? [];
  const obs = ctx.observedFootTraffic ?? {};
  const calibrated = Object.keys(obs).length > 0;

  const scored = places.map((park) => {
    const { pull, drivers } = pullFor(park, heat);
    const { friction, hits } = frictionFor(park, closures);
    const eventBoost = clamp(ctx.eventsByPlace?.[park.id] ?? 0, 0, 40);
    const predicted = clamp((pull + eventBoost - friction) * demandMult, 0, 100);

    let crowding = predicted;
    let foot_traffic: number | undefined;
    let anomaly: number | undefined;
    // Confidence tracks the provenance of the static attributes: a measured
    // registry (OSM geometry + NLCD rasters + HOLC join) earns more than a
    // hand-seeded estimate, but neither earns as much as observed foot traffic.
    let confidence = park.measured ? 0.7 : 0.55;
    if (park.id in obs) {
      foot_traffic = clamp(obs[park.id], 0, 100);
      anomaly = round1(foot_traffic - predicted);
      crowding = round1(0.5 * predicted + 0.5 * foot_traffic); // calibrate toward truth
      confidence = 0.82;
    }

    const allDrivers = { ...drivers, event: eventBoost, friction: -friction, demand_mult: round1(demandMult) };
    const tier = tierOf(crowding);
    const narrative = narrate(park, { tier, crowding, heat, closed: hits, hasWater: park.water_feature });

    return {
      id: park.id,
      name: park.name,
      rank: 0,
      crowding: round1(crowding),
      tier,
      pull: round1(pull),
      friction,
      demandMult: round1(demandMult),
      holc_grade: park.holc_grade,
      drivers: allDrivers,
      narrative,
      confidence,
      foot_traffic,
      anomaly,
    } satisfies ParkForecast;
  });

  scored.sort((a, b) => b.crowding - a.crowding);
  scored.forEach((p, i) => (p.rank = i + 1));

  return {
    generated_at: ctx.now,
    location: "Kansas City area",
    temperatureF,
    heatAlert: Boolean(ctx.heatAlert),
    heatMode: round1(heat),
    demandMult: round1(demandMult),
    calibrated,
    parks: scored,
  };
}

/** Hottest station temperature in a METAR snapshot, converted C→°F. */
export function hottestTempF(metarRows: unknown[]): number | undefined {
  const temps = metarRows
    .map((r) => Number((r as { temp?: unknown }).temp))
    .filter((n) => Number.isFinite(n));
  if (temps.length === 0) return undefined;
  return Math.round((Math.max(...temps) * 9) / 5 + 32);
}
