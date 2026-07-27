#!/usr/bin/env node
/**
 * regenerate-places — promote the place registry from seed estimates to
 * MEASURED values, using only free, keyless public data.
 *
 *   geometry / name / amenities  ← OpenStreetMap via Overpass API
 *   water features               ← OSM (natural=water, swimming_pool, fountain)
 *   noise proxy                  ← OSM distance to nearest motorway/trunk/primary
 *   holc_grade                   ← Mapping Inequality (U. Richmond) point-in-polygon
 *   canopy_index                 ← NLCD Tree Canopy Cover 2021 (MRLC WMS)
 *   impervious / heat proxy      ← NLCD Impervious Surface 2021 (MRLC WMS)
 *
 * Honest substitution: we do NOT have free keyless Landsat land-surface
 * temperature, so `lst_summer_index` is DERIVED from NLCD impervious + canopy —
 * the two dominant drivers of urban heat island. It is labeled as a proxy in
 * `provenance`, not passed off as a thermal measurement.
 *
 * Raster sampling: each park is probed at up to 5 points (centroid + four points
 * at 35% of the bbox half-extent) and averaged, which smooths single-pixel noise
 * without requiring full polygon geometry.
 *
 * Usage:
 *   node scripts/regenerate-places.mjs                 # KC metro (default)
 *   node scripts/regenerate-places.mjs --out src/places.generated.json
 *   node scripts/regenerate-places.mjs --bbox 39.5,-105.2,39.9,-104.8 --city Denver
 *
 * The --bbox/--city flags are how this ports to another metro: swap the box,
 * swap the HOLC city filter, and the archetypes/scoring code never changes.
 */

import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// ---------------------------------------------------------------- config

const args = process.argv.slice(2);
const argVal = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const CONFIG = {
  // south,west,north,east — KC metro (KCMO + KCK + northern Johnson Co.)
  bbox: argVal("--bbox", "38.86,-94.95,39.35,-94.35"),
  cityMatch: argVal("--city", "Kansas City"),
  out: argVal("--out", "src/places.generated.json"),
  minAcres: Number(argVal("--min-acres", "8")),
  maxParks: Number(argVal("--max", "40")),
  samplesPerPark: 5,
  concurrency: 6,
  holcCache: "/tmp/mappinginequality.json",
  tccLayer: "nlcd_tcc_conus_2021_v2021-4",
  impLayer: "NLCD_2021_Impervious_L48",
  overpassHosts: [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ],
  ua: "forecast-v2/1.0 (civicbrands.org; park crowd-cast registry)",
  noCache: args.includes("--no-cache"),
  overpassTimeoutMs: Number(argVal("--overpass-timeout-ms", "50000")),
  skipExtras: args.includes("--skip-extras"),
};

const log = (...m) => console.log(...m);

// ---------------------------------------------------------------- helpers

const R_MILES = 3958.8;
const toRad = (d) => (d * Math.PI) / 180;
function haversineMiles(aLat, aLon, bLat, bLon) {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.min(1, Math.sqrt(s)));
}
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round1 = (n) => Math.round(n * 10) / 10;

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

async function withRetry(fn, { tries = 3, label = "request" } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw new Error(`${label} failed after ${tries} tries: ${lastErr?.message ?? lastErr}`);
}

/** Run tasks with bounded concurrency. */
async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let idx = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      out[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return out;
}

// ---------------------------------------------------------------- overpass

/**
 * Overpass with a disk cache. Public Overpass instances rate-limit and queue
 * aggressively; caching by query label makes re-runs instant and keeps us a
 * polite consumer of a free community resource. Delete /tmp/overpass-*.json to
 * force a refetch.
 */
async function overpass(query, label) {
  const cacheFile = `/tmp/overpass-${label.replace(/[^a-z0-9]+/gi, "_")}.json`;
  if (!CONFIG.noCache && existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, "utf8"));
      if (cached?.elements) {
        log(`  (cache) ${label}: ${cached.elements.length} elements`);
        return cached;
      }
    } catch {
      /* fall through to network */
    }
  }
  const data = await overpassFetch(query, label);
  try {
    writeFileSync(cacheFile, JSON.stringify(data));
  } catch {
    /* cache is best-effort */
  }
  return data;
}

async function overpassFetch(query, label) {
  // Public Overpass instances queue requests when busy. Keep the per-host budget
  // tight so an optional enrichment step degrades in seconds rather than tying
  // the run up for minutes; required steps are cached and retried by the caller.
  for (const host of CONFIG.overpassHosts) {
    try {
      return await withRetry(
        async () => {
          const res = await fetch(host, {
            method: "POST",
            headers: { "User-Agent": CONFIG.ua, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ data: query }),
            signal: AbortSignal.timeout(CONFIG.overpassTimeoutMs),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.json();
        },
        { tries: 1, label: `${label} @ ${host}` },
      );
    } catch (err) {
      log(`  ! ${label} failed on ${host}: ${err.message}`);
    }
  }
  throw new Error(`${label}: all Overpass hosts failed`);
}

function bboxParts() {
  const [s, w, n, e] = CONFIG.bbox.split(",").map(Number);
  return { s, w, n, e };
}

/** Planar-approx polygon area in acres (shoelace, lat-corrected). */
function polygonAcres(geom) {
  if (!geom || geom.length < 3) return 0;
  const lat0 = geom.reduce((s, p) => s + p.lat, 0) / geom.length;
  const k = Math.cos(toRad(lat0));
  const FT_PER_DEG = 364000;
  let sum = 0;
  for (let i = 0; i < geom.length; i++) {
    const a = geom[i];
    const b = geom[(i + 1) % geom.length];
    sum += a.lon * FT_PER_DEG * k * (b.lat * FT_PER_DEG) - b.lon * FT_PER_DEG * k * (a.lat * FT_PER_DEG);
  }
  return Math.abs(sum) / 2 / 43560;
}

function boundsOf(geom) {
  return geom.reduce(
    (b, p) => ({
      minlat: Math.min(b.minlat, p.lat),
      maxlat: Math.max(b.maxlat, p.lat),
      minlon: Math.min(b.minlon, p.lon),
      maxlon: Math.max(b.maxlon, p.lon),
    }),
    { minlat: 90, maxlat: -90, minlon: 180, maxlon: -180 },
  );
}

function centroidOf(geom) {
  return {
    lat: geom.reduce((s, p) => s + p.lat, 0) / geom.length,
    lon: geom.reduce((s, p) => s + p.lon, 0) / geom.length,
  };
}

/**
 * Parks come back as closed ways with full geometry. Relations (multipolygon
 * parks) are deliberately excluded: they make the Overpass query an order of
 * magnitude slower for a small yield. The `["name"]` filter keeps the payload
 * to ~1.4MB metro-wide.
 */
async function fetchParks() {
  const { s, w, n, e } = bboxParts();
  const q = `[out:json][timeout:120];
way["leisure"="park"]["name"](${s},${w},${n},${e});
out geom;`;
  const data = await overpass(q, "parks");
  const seen = new Set();
  const parks = [];
  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};
    const name = tags.name;
    const geom = el.geometry;
    if (!name || !geom || geom.length < 3) continue;

    const acres = polygonAcres(geom);
    if (acres < CONFIG.minAcres) continue;

    const id = slug(name);
    if (seen.has(id)) continue;
    seen.add(id);

    const center = centroidOf(geom);
    parks.push({
      id,
      name,
      osm: `${el.type}/${el.id}`,
      lat: center.lat,
      lon: center.lon,
      bounds: boundsOf(geom),
      geometry: geom,
      area_acres: Math.round(acres),
      tags,
    });
  }
  parks.sort((a, b) => b.area_acres - a.area_acres);
  return parks.slice(0, CONFIG.maxParks);
}

async function fetchWaterAndAmenities() {
  const { s, w, n, e } = bboxParts();
  const q = `[out:json][timeout:180];
(
  way["natural"="water"]["name"](${s},${w},${n},${e});
  way["leisure"="swimming_pool"](${s},${w},${n},${e});
  node["leisure"="swimming_pool"](${s},${w},${n},${e});
  way["leisure"="water_park"](${s},${w},${n},${e});
  node["amenity"="fountain"](${s},${w},${n},${e});
  node["leisure"="playground"](${s},${w},${n},${e});
  way["leisure"="playground"](${s},${w},${n},${e});
  way["leisure"="pitch"](${s},${w},${n},${e});
);
out tags center;`;
  const data = await overpass(q, "water+amenities");
  const feats = [];
  for (const el of data.elements ?? []) {
    const c = el.center ?? (el.lat && el.lon ? { lat: el.lat, lon: el.lon } : null);
    if (!c) continue;
    const t = el.tags ?? {};
    let kind = null;
    if (t.natural === "water" || t.leisure === "swimming_pool" || t.leisure === "water_park" || t.amenity === "fountain") kind = "water";
    else if (t.leisure === "playground") kind = "playground";
    else if (t.leisure === "pitch") kind = "sports";
    if (!kind) continue;
    feats.push({ kind, lat: c.lat, lon: c.lon, sub: t.leisure || t.natural || t.amenity });
  }
  return feats;
}

async function fetchMajorRoads() {
  const { s, w, n, e } = bboxParts();
  const q = `[out:json][timeout:180];
way["highway"~"^(motorway|trunk|primary)$"](${s},${w},${n},${e});
out geom;`;
  const data = await overpass(q, "roads");
  const roads = [];
  for (const el of data.elements ?? []) {
    if (!el.geometry) continue;
    roads.push({ cls: el.tags?.highway ?? "primary", pts: el.geometry });
  }
  return roads;
}

// ---------------------------------------------------------------- HOLC

async function loadHolc() {
  if (!existsSync(CONFIG.holcCache)) {
    log("  downloading Mapping Inequality GeoJSON (~10MB)…");
    const res = await fetch("https://dsl.richmond.edu/panorama/redlining/static/mappinginequality.json", {
      headers: { "User-Agent": CONFIG.ua },
      signal: AbortSignal.timeout(180000),
    });
    if (!res.ok) throw new Error(`HOLC download HTTP ${res.status}`);
    writeFileSync(CONFIG.holcCache, Buffer.from(await res.arrayBuffer()));
  }
  const gj = JSON.parse(readFileSync(CONFIG.holcCache, "utf8"));
  const feats = (gj.features ?? []).filter(
    (f) => String(f.properties?.city ?? "").includes(CONFIG.cityMatch) && f.properties?.grade,
  );
  return feats;
}

function pointInRing(lat, lon, ring) {
  // ring: [[lon,lat], ...] — ray casting
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInGeometry(lat, lon, geom) {
  if (!geom) return false;
  const polys = geom.type === "MultiPolygon" ? geom.coordinates : geom.type === "Polygon" ? [geom.coordinates] : [];
  for (const poly of polys) {
    if (poly.length === 0) continue;
    if (pointInRing(lat, lon, poly[0])) {
      let inHole = false;
      for (let h = 1; h < poly.length; h++) if (pointInRing(lat, lon, poly[h])) inHole = true;
      if (!inHole) return true;
    }
  }
  return false;
}

/** Grade at a point; if not inside any polygon, fall back to nearest within 0.6 mi. */
function holcGradeAt(lat, lon, feats) {
  for (const f of feats) {
    if (pointInGeometry(lat, lon, f.geometry)) {
      return { grade: f.properties.grade, method: "point-in-polygon", label: f.properties.label ?? null };
    }
  }
  let best = null;
  for (const f of feats) {
    const polys = f.geometry?.type === "MultiPolygon" ? f.geometry.coordinates : f.geometry?.type === "Polygon" ? [f.geometry.coordinates] : [];
    for (const poly of polys) {
      for (const [plon, plat] of poly[0] ?? []) {
        const d = haversineMiles(lat, lon, plat, plon);
        if (!best || d < best.d) best = { d, grade: f.properties.grade, label: f.properties.label ?? null };
      }
    }
  }
  if (best && best.d <= 0.6) {
    return { grade: best.grade, method: `nearest-polygon (${round1(best.d)} mi)`, label: best.label };
  }
  return { grade: null, method: "unmapped (outside HOLC survey)", label: null };
}

// ---------------------------------------------------------------- MRLC raster

async function sampleRaster(layer, lat, lon) {
  const d = 0.0009;
  const bbox = `${lon - d},${lat - d},${lon + d},${lat + d}`;
  const url =
    `https://www.mrlc.gov/geoserver/mrlc_display/wms?service=WMS&version=1.1.1&request=GetFeatureInfo` +
    `&layers=${encodeURIComponent(layer)}&query_layers=${encodeURIComponent(layer)}` +
    `&srs=EPSG:4326&bbox=${bbox}&width=3&height=3&x=1&y=1&info_format=application%2Fjson`;
  const res = await fetch(url, { headers: { "User-Agent": CONFIG.ua }, signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`MRLC HTTP ${res.status}`);
  const j = await res.json();
  const props = j?.features?.[0]?.properties;
  if (!props) return null;
  const v = props.PALETTE_INDEX ?? props.GRAY_INDEX ?? Object.values(props)[0];
  return typeof v === "number" ? v : null;
}

/** Ray-cast against a park's own OSM way geometry ([{lat,lon}, …]). */
function pointInWay(lat, lon, geom) {
  let inside = false;
  for (let i = 0, j = geom.length - 1; i < geom.length; j = i++) {
    const xi = geom[i].lon, yi = geom[i].lat;
    const xj = geom[j].lon, yj = geom[j].lat;
    const hit = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

/**
 * Sample points that actually fall INSIDE the park polygon — a 5×5 grid over the
 * bounding box, filtered by point-in-polygon, spread out by striding. Falls back
 * to the centroid for slivers where nothing qualifies.
 */
function samplePoints(park) {
  const b = park.bounds;
  const inside = [];
  const N = 5;
  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= N; j++) {
      const lat = b.minlat + ((b.maxlat - b.minlat) * i) / (N + 1);
      const lon = b.minlon + ((b.maxlon - b.minlon) * j) / (N + 1);
      if (pointInWay(lat, lon, park.geometry)) inside.push({ lat, lon });
    }
  }
  if (inside.length === 0) return [{ lat: park.lat, lon: park.lon }];
  const stride = Math.max(1, Math.floor(inside.length / CONFIG.samplesPerPark));
  const picked = [];
  for (let i = 0; i < inside.length && picked.length < CONFIG.samplesPerPark; i += stride) picked.push(inside[i]);
  return picked;
}

async function measurePark(park) {
  const pts = samplePoints(park);
  const canopy = [];
  const imperv = [];
  for (const p of pts) {
    try {
      const [c, i] = await Promise.all([
        sampleRaster(CONFIG.tccLayer, p.lat, p.lon),
        sampleRaster(CONFIG.impLayer, p.lat, p.lon),
      ]);
      if (typeof c === "number") canopy.push(c);
      if (typeof i === "number") imperv.push(i);
    } catch {
      /* skip this point; averaging over the rest */
    }
  }
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  return { canopy: mean(canopy), impervious: mean(imperv), samples: Math.max(canopy.length, imperv.length) };
}

// ---------------------------------------------------------------- assembly

function nearestRoadNoise(park, roads) {
  let best = null;
  for (const r of roads) {
    const weight = r.cls === "motorway" ? 1 : r.cls === "trunk" ? 0.8 : 0.6;
    for (const pt of r.pts) {
      const d = haversineMiles(park.lat, park.lon, pt.lat, pt.lon);
      if (!best || d < best.d) best = { d, cls: r.cls, weight };
    }
  }
  if (!best) return { noise_index: null, detail: null };
  // ~0.05 mi ⇒ loud (95·w); ~1.5 mi ⇒ quiet. Log-ish falloff.
  const falloff = clamp(1 - Math.log10(Math.max(best.d, 0.03) / 0.03) / Math.log10(50), 0, 1);
  return {
    noise_index: Math.round(clamp(falloff * 95 * best.weight, 5, 95)),
    detail: `${round1(best.d)} mi to nearest ${best.cls}`,
  };
}

function amenitiesFor(park, feats) {
  const b = park.bounds;
  const inside = feats.filter(
    (f) => f.lat >= b.minlat && f.lat <= b.maxlat && f.lon >= b.minlon && f.lon <= b.maxlon,
  );
  const kinds = new Set(inside.map((f) => f.kind));
  const subs = new Set(inside.map((f) => f.sub).filter(Boolean));
  const list = [];
  if (kinds.has("water")) list.push("water");
  if (kinds.has("playground")) list.push("playground");
  if (kinds.has("sports")) list.push("sports");
  for (const t of ["swimming_pool", "water_park", "fountain"]) if (subs.has(t)) list.push(t);
  const tags = park.tags ?? {};
  if (tags.dog === "yes" || tags.leisure === "dog_park") list.push("dog_park");
  if (park.area_acres > 200) list.push("large");
  return { amenities: [...new Set(list)], water_feature: kinds.has("water") };
}

async function main() {
  log("regenerate-places — measured registry from free public data");
  log(`  bbox=${CONFIG.bbox}  city~"${CONFIG.cityMatch}"  min=${CONFIG.minAcres}ac  max=${CONFIG.maxParks}`);

  log("\n[1/5] OSM parks…");
  const parks = await fetchParks();
  log(`  ${parks.length} parks (>= ${CONFIG.minAcres} acres)`);

  // Steps 2–3 are ENRICHMENT: nice to have, but the run is still valuable
  // without them (canopy/impervious/HOLC are the load-bearing measurements).
  // --skip-extras lets a run complete when public Overpass is throttling; the
  // enrichment can be backfilled later without redoing the raster sampling.
  let feats = [];
  let roads = [];
  if (CONFIG.skipExtras) {
    log("[2/5] OSM water + amenities… SKIPPED (--skip-extras)");
    log("[3/5] OSM major roads… SKIPPED (--skip-extras)");
  } else {
    log("[2/5] OSM water + amenities…");
    try {
      feats = await fetchWaterAndAmenities();
      log(`  ${feats.length} amenity features`);
    } catch (e) {
      log(`  ! skipped: ${e.message}`);
    }

    log("[3/5] OSM major roads (noise proxy)…");
    try {
      roads = await fetchMajorRoads();
      log(`  ${roads.length} motorway/trunk/primary ways`);
    } catch (e) {
      log(`  ! skipped: ${e.message}`);
    }
  }

  log("[4/5] HOLC redlining polygons…");
  const holc = await loadHolc();
  log(`  ${holc.length} graded polygons matching "${CONFIG.cityMatch}"`);

  log(`[5/5] NLCD canopy + impervious (${parks.length} parks × ${CONFIG.samplesPerPark} pts)…`);
  const measured = await pool(parks, CONFIG.concurrency, async (park) => {
    const m = await measurePark(park);
    process.stdout.write(".");
    return { park, m };
  });
  process.stdout.write("\n");

  const places = [];
  for (const { park, m } of measured) {
    const grade = holcGradeAt(park.lat, park.lon, holc);
    const { amenities, water_feature } = amenitiesFor(park, feats);
    const noise = roads.length ? nearestRoadNoise(park, roads) : { noise_index: null, detail: null };

    const canopy = m.canopy === null ? null : round1(m.canopy);
    const impervious = m.impervious === null ? null : round1(m.impervious);
    // Heat proxy: impervious dominates urban heat island; canopy deficit adds.
    const heat =
      impervious === null && canopy === null
        ? null
        : round1(clamp(0.7 * (impervious ?? 50) + 0.3 * (100 - (canopy ?? 50)), 0, 100));

    places.push({
      id: park.id,
      name: park.name,
      category: "park",
      lat: round1(park.lat * 1e4) / 1e4,
      lon: round1(park.lon * 1e4) / 1e4,
      area_acres: park.area_acres,
      holc_grade: grade.grade,
      canopy_index: canopy,
      impervious_index: impervious,
      lst_summer_index: heat,
      noise_index: noise.noise_index,
      water_feature,
      amenities,
      access_points: [],
      provenance: {
        geometry: `OpenStreetMap ${park.osm} (Overpass); area from bbox, approximate`,
        holc_grade: `Mapping Inequality (U. Richmond), ${grade.method}${grade.label ? `, area ${grade.label}` : ""}`,
        canopy_index: `NLCD Tree Canopy Cover 2021 (MRLC WMS), mean of ${m.samples} samples`,
        impervious_index: `NLCD Impervious Surface 2021 (MRLC WMS), mean of ${m.samples} samples`,
        lst_summer_index:
          "DERIVED PROXY (not a thermal measurement): 0.7×impervious + 0.3×(100−canopy). " +
          "Substitutes for Landsat LST, which has no free keyless endpoint.",
        noise_index: noise.detail
          ? `OSM road proximity proxy: ${noise.detail}`
          : "unavailable (road query failed)",
        amenities: "OpenStreetMap features within park bounding box",
      },
    });
  }

  places.sort((a, b) => (b.area_acres ?? 0) - (a.area_acres ?? 0));

  const payload = {
    generated_at: new Date().toISOString(),
    generator: "scripts/regenerate-places.mjs",
    region: { bbox: CONFIG.bbox, city_match: CONFIG.cityMatch },
    sources: {
      geometry: "OpenStreetMap via Overpass API (ODbL)",
      holc: "Mapping Inequality, Digital Scholarship Lab, University of Richmond",
      canopy: `MRLC NLCD Tree Canopy Cover (${CONFIG.tccLayer})`,
      impervious: `MRLC NLCD Impervious Surface (${CONFIG.impLayer})`,
      noise: "OSM major-road proximity proxy",
    },
    count: places.length,
    places,
  };

  mkdirSync(dirname(CONFIG.out), { recursive: true });
  writeFileSync(CONFIG.out, JSON.stringify(payload, null, 2));

  const withGrade = places.filter((p) => p.holc_grade).length;
  const withCanopy = places.filter((p) => p.canopy_index !== null).length;
  log(`\nwrote ${CONFIG.out}`);
  log(`  ${places.length} places · ${withGrade} HOLC-graded · ${withCanopy} canopy-measured`);
  log("\n  top by area:");
  for (const p of places.slice(0, 12)) {
    log(
      `   ${String(p.area_acres).padStart(5)}ac  ${(p.holc_grade ?? "-").padEnd(2)}  ` +
        `canopy ${String(p.canopy_index ?? "-").padStart(5)}  imperv ${String(p.impervious_index ?? "-").padStart(5)}  ` +
        `noise ${String(p.noise_index ?? "-").padStart(3)}  ${p.water_feature ? "💧" : "  "} ${p.name}`,
    );
  }
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
