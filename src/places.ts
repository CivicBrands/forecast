/**
 * Place registry — the STATIC overlay that location-specific correlations bind
 * to. Right now it holds Kansas City parks; the shape generalizes to any named
 * civic referent (trailheads, plazas, transit nodes).
 *
 * The KC_PARKS list below is the SEED: coarse, human-assigned indices, kept only
 * as a FALLBACK. The runtime registry now prefers `places.generated.json`, built
 * by scripts/regenerate-places.mjs + build-registry.mjs from primary sources:
 *
 *   geometry / amenities  ← OpenStreetMap Overpass (leisure=park)
 *   holc_grade            ← Mapping Inequality HOLC polygons (U. Richmond)
 *   canopy_index          ← USFS/NLCD tree canopy or Landsat NDVI
 *   lst_summer_index      ← Landsat/MODIS land-surface temperature (summer mean)
 *   noise_index           ← US DOT BTS National Transportation Noise Map
 *
 * Every attribute in the seed list carries `provenance.method = "seed-estimate"`
 * so nothing here can masquerade as measured. `loadKcParks()` sets `measured` on
 * generated rows, and `registryIsMeasured()` reports which source is live.
 */

export type HolcGrade = "A" | "B" | "C" | "D";

export type AccessPoint = { name: string; lat: number; lon: number; road: string };

export type Place = {
  id: string;
  name: string;
  category: "park";
  lat: number;
  lon: number;
  area_acres?: number;
  holc_grade?: HolcGrade;
  /** 0..100, higher = more tree canopy / shade (inside the park). */
  canopy_index: number;
  /**
   * 0..100 tree canopy of the SURROUNDING neighborhood (the HOLC polygon the
   * park sits in), measured from NLCD. This is the field that carries the
   * redlining signal — park interiors do not (parks are the greenest patch of
   * any neighborhood). A low value means the park is a rare cool island rather
   * than one shaded block among many. Undefined outside the HOLC survey area.
   */
  neighborhood_canopy_index?: number;
  /** 0..100 impervious surface of the surrounding neighborhood (NLCD). */
  neighborhood_impervious_index?: number;
  /** 0..100, higher = hotter summer surface. Anti-correlated with canopy. */
  lst_summer_index: number;
  /** 0..100, higher = louder baseline (highway/rail/flight proximity). */
  noise_index: number;
  /** True when attributes came from the measured pipeline, not the seed list. */
  measured?: boolean;
  /** Enterable/cooling water present (pond, lake, pool, spray). */
  water_feature: boolean;
  amenities: string[];
  access_points: AccessPoint[];
  provenance: Record<string, string>;
};

const SEED = "seed-estimate; regenerate via OSM/HOLC/Landsat/BTS pipeline";

function seedProvenance(note = ""): Record<string, string> {
  return {
    canopy_index: SEED,
    lst_summer_index: SEED,
    noise_index: SEED,
    holc_grade: "Mapping Inequality (U. Richmond), Troost-divide assignment; verify per-polygon",
    amenities: "OSM tags + local knowledge (coarse)",
    note: note || "KC parks first-pass registry",
  };
}

/**
 * Kansas City park registry (seed). The spread is deliberate: historically
 * A/B-graded, high-canopy parks west of Troost and in the suburbs; C/D-graded,
 * lower-canopy, hotter parks in the historically disinvested east side. NOTE:
 * measurement later showed park-INTERIOR canopy varies far less by HOLC grade
 * than this seed assumed — the redlining signal lives in the surrounding
 * NEIGHBORHOOD (see neighborhood_canopy_index and docs/compendium/parks.md).
 * These seed values are retained only as a fallback and should not be cited.
 */
export const KC_PARKS: Place[] = [
  {
    id: "loose-park",
    name: "Loose Park",
    category: "park",
    lat: 39.0347,
    lon: -94.5905,
    area_acres: 75,
    holc_grade: "A",
    canopy_index: 85,
    lst_summer_index: 35,
    noise_index: 20,
    water_feature: true, // duck pond
    amenities: ["pond", "rose_garden", "shade_canopy", "open_lawn", "walking_loop"],
    access_points: [
      { name: "Wornall & 51st", lat: 39.0361, lon: -94.5931, road: "Wornall Rd" },
      { name: "52nd & Summit", lat: 39.0331, lon: -94.5949, road: "Summit St" },
    ],
    provenance: seedProvenance("Country Club District, HOLC A; flagship high-canopy magnet"),
  },
  {
    id: "roanoke-park",
    name: "Roanoke Park",
    category: "park",
    lat: 39.0662,
    lon: -94.5988,
    area_acres: 45,
    holc_grade: "B",
    canopy_index: 80,
    lst_summer_index: 42,
    noise_index: 48, // SW Trafficway on the west edge
    water_feature: false,
    amenities: ["wooded_ravine", "trails", "playground", "shade_canopy"],
    access_points: [
      { name: "Karnes & 36th", lat: 39.0671, lon: -94.6005, road: "Karnes Blvd" },
      { name: "Roanoke Rd", lat: 39.0648, lon: -94.5972, road: "Roanoke Rd" },
    ],
    provenance: seedProvenance("Midtown wooded ravine; noise from SW Trafficway"),
  },
  {
    id: "theis-park",
    name: "Theis Park (Brush Creek)",
    category: "park",
    lat: 39.0387,
    lon: -94.5806,
    area_acres: 26,
    holc_grade: "B",
    canopy_index: 40,
    lst_summer_index: 60,
    noise_index: 38,
    water_feature: true, // Brush Creek + fountains
    amenities: ["brush_creek", "fountains", "event_lawn", "walking", "museum_adjacent"],
    access_points: [
      { name: "Oak & 47th", lat: 39.0399, lon: -94.5822, road: "Oak St" },
      { name: "Brush Creek Blvd", lat: 39.0375, lon: -94.579, road: "Brush Creek Blvd" },
    ],
    provenance: seedProvenance("Open lawn by the Nelson-Atkins; water + prestige, low shade"),
  },
  {
    id: "gillham-park",
    name: "Gillham Park",
    category: "park",
    lat: 39.0755,
    lon: -94.5768,
    area_acres: 42,
    holc_grade: "C",
    canopy_index: 55,
    lst_summer_index: 55,
    noise_index: 42,
    water_feature: true, // pool
    amenities: ["pool", "ballfields", "open_lawn", "playground"],
    access_points: [
      { name: "Gillham Rd & 40th", lat: 39.0768, lon: -94.5781, road: "Gillham Rd" },
      { name: "Oak & 41st", lat: 39.0744, lon: -94.5751, road: "Oak St" },
    ],
    provenance: seedProvenance("Midtown, Troost-adjacent; pool is the hot-day draw"),
  },
  {
    id: "penn-valley-park",
    name: "Penn Valley Park",
    category: "park",
    lat: 39.0793,
    lon: -94.5885,
    area_acres: 176,
    holc_grade: "C",
    canopy_index: 50,
    lst_summer_index: 58,
    noise_index: 72, // ringed by I-35 / I-670
    water_feature: false,
    amenities: ["hills", "memorial_adjacent", "trails", "open_lawn"],
    access_points: [
      { name: "Pershing & Main", lat: 39.0817, lon: -94.5865, road: "Pershing Rd" },
      { name: "31st & Wyandotte", lat: 39.0761, lon: -94.5901, road: "Wyandotte St" },
    ],
    provenance: seedProvenance("Big hilly park choked by highway noise on most edges"),
  },
  {
    id: "berkley-riverfront",
    name: "Berkley Riverfront Park",
    category: "park",
    lat: 39.1136,
    lon: -94.5716,
    area_acres: 45,
    holc_grade: undefined, // former industrial riverfront, unmapped
    canopy_index: 15,
    lst_summer_index: 82,
    noise_index: 55,
    water_feature: false, // river adjacent but not a cooling amenity you enter
    amenities: ["riverfront", "event_venue", "trail", "open_lawn"],
    access_points: [
      { name: "Grand Blvd viaduct", lat: 39.1108, lon: -94.5722, road: "Grand Blvd" },
      { name: "Berkley Pkwy", lat: 39.1141, lon: -94.5698, road: "Berkley Pkwy" },
    ],
    provenance: seedProvenance("Open riverfront event lawn; bakes without shade, but events override"),
  },
  {
    id: "budd-park",
    name: "Budd Park",
    category: "park",
    lat: 39.1162,
    lon: -94.5353,
    area_acres: 32,
    holc_grade: "D",
    canopy_index: 35,
    lst_summer_index: 72,
    noise_index: 45,
    water_feature: true, // historic pool
    amenities: ["pool", "ballfields", "open_lawn", "tennis"],
    access_points: [
      { name: "St John & Brighton", lat: 39.1171, lon: -94.5369, road: "St John Ave" },
      { name: "Anderson Ave", lat: 39.1153, lon: -94.5338, road: "Anderson Ave" },
    ],
    provenance: seedProvenance("Historic Northeast, HOLC D; canopy thinned, heat elevated"),
  },
  {
    id: "parade-park",
    name: "Parade Park",
    category: "park",
    lat: 39.0912,
    lon: -94.5583,
    area_acres: 26,
    holc_grade: "D",
    canopy_index: 20,
    lst_summer_index: 82,
    noise_index: 50,
    water_feature: false,
    amenities: ["open_lawn", "ballfields", "jazz_district_adjacent"],
    access_points: [
      { name: "18th & Vine", lat: 39.0919, lon: -94.5601, road: "Vine St" },
      { name: "Woodland & 17th", lat: 39.0928, lon: -94.5566, road: "Woodland Ave" },
    ],
    provenance: seedProvenance("Historic 18th & Vine, HOLC D; the redlining canopy gap made visible"),
  },
  {
    id: "swope-park",
    name: "Swope Park",
    category: "park",
    lat: 39.0047,
    lon: -94.5082,
    area_acres: 1805,
    holc_grade: "C",
    canopy_index: 60,
    lst_summer_index: 55,
    noise_index: 40, // I-435 / Blue River corridor
    water_feature: true, // Lake of the Woods
    amenities: ["lake", "zoo", "trails", "golf", "starlight_theatre", "forest", "large"],
    access_points: [
      { name: "Swope Pkwy entrance", lat: 39.0119, lon: -94.5188, road: "Swope Pkwy" },
      { name: "Meyer & Elmwood", lat: 39.0181, lon: -94.5323, road: "Meyer Blvd" },
    ],
    provenance: seedProvenance("Huge; forested sections + Lake of the Woods offset the heat"),
  },
  {
    id: "blue-valley-park",
    name: "Blue Valley Park",
    category: "park",
    lat: 39.0777,
    lon: -94.5108,
    area_acres: 90,
    holc_grade: "D",
    canopy_index: 45,
    lst_summer_index: 68,
    noise_index: 40,
    water_feature: false,
    amenities: ["ballfields", "open_lawn", "trails", "river_adjacent"],
    access_points: [
      { name: "Topping & 23rd", lat: 39.0821, lon: -94.5121, road: "Topping Ave" },
      { name: "Blue Valley Rd", lat: 39.0739, lon: -94.5094, road: "Blue Valley Rd" },
    ],
    provenance: seedProvenance("East-side Blue River corridor, HOLC D"),
  },
  {
    id: "shawnee-mission-park",
    name: "Shawnee Mission Park",
    category: "park",
    lat: 38.9603,
    lon: -94.7844,
    area_acres: 1600,
    holc_grade: undefined, // suburban JoCo, outside HOLC mapping
    canopy_index: 80,
    lst_summer_index: 38,
    noise_index: 25,
    water_feature: true, // lake + swim beach + marina
    amenities: ["lake", "swim_beach", "trails", "marina", "dog_park", "large"],
    access_points: [
      { name: "Renner & 79th", lat: 38.9686, lon: -94.7783, road: "Renner Rd" },
      { name: "Midland Dr", lat: 38.9558, lon: -94.79, road: "Midland Dr" },
    ],
    provenance: seedProvenance("Metro's most-visited park; suburban canopy + lake = magnet"),
  },
  {
    id: "case-park",
    name: "Case Park / West Terrace",
    category: "park",
    lat: 39.1075,
    lon: -94.5928,
    area_acres: 12,
    holc_grade: "C",
    canopy_index: 25,
    lst_summer_index: 70,
    noise_index: 65, // I-70 / river bluff
    water_feature: false,
    amenities: ["overlook", "lewis_clark_monument", "open"],
    access_points: [
      { name: "8th & Jefferson", lat: 39.1069, lon: -94.5945, road: "Jefferson St" },
    ],
    provenance: seedProvenance("Downtown bluff overlook; view park, little shade"),
  },
];

// --------------------------------------------------------------- generated

import generated from "./places.generated.json";

type GeneratedPlace = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  area_acres?: number | null;
  holc_grade?: string | null;
  canopy_index?: number | null;
  impervious_index?: number | null;
  neighborhood_canopy_index?: number | null;
  neighborhood_impervious_index?: number | null;
  lst_summer_index?: number | null;
  noise_index?: number | null;
  water_feature?: boolean;
  amenities?: string[];
  provenance?: Record<string, string>;
};

const isGrade = (g: unknown): g is HolcGrade => g === "A" || g === "B" || g === "C" || g === "D";

/**
 * Board size. The pipeline discovers ~220 parks metro-wide, but every park in
 * the registry costs one `place_signals` row per tick (288 ticks/day), so the
 * public board is deliberately capped. Selection favours large parks while
 * guaranteeing the HOLC-graded ones survive — those carry the redlining signal
 * and are the reason the board is interesting.
 */
const BOARD_SIZE = 24;
const MIN_BOARD_ACRES = 15;

function selectForBoard(all: Place[]): Place[] {
  const graded = all.filter((p) => p.holc_grade && (p.area_acres ?? 0) >= MIN_BOARD_ACRES);
  const ungraded = all.filter((p) => !p.holc_grade && (p.area_acres ?? 0) >= MIN_BOARD_ACRES);
  const byArea = (a: Place, b: Place) => (b.area_acres ?? 0) - (a.area_acres ?? 0);
  graded.sort(byArea);
  ungraded.sort(byArea);
  // Guarantee the story parks a seat, then fill with the biggest of the rest.
  const picked = [...graded.slice(0, Math.ceil(BOARD_SIZE * 0.6))];
  for (const p of ungraded) {
    if (picked.length >= BOARD_SIZE) break;
    picked.push(p);
  }
  for (const p of graded.slice(Math.ceil(BOARD_SIZE * 0.6))) {
    if (picked.length >= BOARD_SIZE) break;
    picked.push(p);
  }
  return picked.sort(byArea);
}

function fromGenerated(): Place[] | null {
  const rows = (generated as { places?: GeneratedPlace[] })?.places;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const mapped: Place[] = [];
  for (const g of rows) {
    // Canopy is load-bearing for scoring; skip anything unmeasured.
    if (typeof g.canopy_index !== "number") continue;
    mapped.push({
      id: g.id,
      name: g.name,
      category: "park",
      lat: g.lat,
      lon: g.lon,
      area_acres: g.area_acres ?? undefined,
      holc_grade: isGrade(g.holc_grade) ? g.holc_grade : undefined,
      canopy_index: g.canopy_index,
      neighborhood_canopy_index: g.neighborhood_canopy_index ?? undefined,
      neighborhood_impervious_index: g.neighborhood_impervious_index ?? undefined,
      lst_summer_index: typeof g.lst_summer_index === "number" ? g.lst_summer_index : 50,
      // Noise falls back to a neutral mid value when the OSM road pass is absent,
      // so an unmeasured attribute cannot masquerade as "quiet".
      noise_index: typeof g.noise_index === "number" ? g.noise_index : 45,
      water_feature: Boolean(g.water_feature),
      measured: true,
      amenities: g.amenities ?? [],
      access_points: [],
      provenance: g.provenance ?? {},
    });
  }
  return mapped.length > 0 ? selectForBoard(mapped) : null;
}

let cached: Place[] | null = null;

/**
 * The runtime registry. Prefers the MEASURED registry produced by
 * scripts/regenerate-places.mjs + scripts/build-registry.mjs; falls back to the
 * hand-seeded list above if the generated file is missing or empty.
 */
export function loadKcParks(): Place[] {
  if (cached) return cached;
  cached = fromGenerated() ?? KC_PARKS;
  return cached;
}

/** True when the runtime registry is the measured one, not the seed. */
export function registryIsMeasured(): boolean {
  return loadKcParks() !== KC_PARKS;
}
