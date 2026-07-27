#!/usr/bin/env node
/**
 * build-registry — merge the measured pipeline outputs into the runtime
 * registry consumed by src/places.ts.
 *
 * Inputs (all produced by free/keyless sources):
 *   /tmp/places.full.json    parks + park-interior canopy/impervious + HOLC grade
 *   /tmp/places.extras.json  same, plus OSM water/amenities/noise (optional)
 *   /tmp/holc-audit.json     NEIGHBORHOOD canopy/impervious per HOLC polygon
 *   /tmp/mappinginequality.json  HOLC geometry (to attach a park to its polygon)
 *
 * The neighborhood join is the important one: it is the field that actually
 * carries the redlining signal, and the one the corrected narrative cites.
 *
 * Output: src/places.generated.json
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2] ?? "src/places.generated.json";
const SEED_WATER = new Set([
  // Curated fallbacks: parks known to have enterable/cooling water, used only
  // when the OSM enrichment pass was unavailable. Marked as such in provenance.
  "jacob-l-loose-memorial-park",
  "gillham-park",
  "budd-park",
  "swope-park",
  "shawnee-mission-park",
  "theis-park",
  "penn-valley-park",
]);

function load(p) {
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

function ringsOf(geom) {
  if (!geom) return [];
  return geom.type === "MultiPolygon" ? geom.coordinates : geom.type === "Polygon" ? [geom.coordinates] : [];
}
function pointInRing(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pointInGeom(lat, lon, geom) {
  for (const poly of ringsOf(geom)) {
    if (!poly.length) continue;
    if (pointInRing(lat, lon, poly[0])) {
      let hole = false;
      for (let h = 1; h < poly.length; h++) if (pointInRing(lat, lon, poly[h])) hole = true;
      if (!hole) return true;
    }
  }
  return false;
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const r1 = (n) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);

const R_MILES = 3958.8;
const toRad = (d) => (d * Math.PI) / 180;
function haversineMiles(aLat, aLon, bLat, bLon) {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Join OSM amenity features to parks straight from the raw Overpass cache.
 *
 * Why here instead of in regenerate-places: the amenity query succeeds far more
 * often than the (much heavier) road query, and re-running the full pipeline to
 * pick it up would mean redoing ~2,200 MRLC raster samples. This lets a cached
 * enrichment be folded into an existing measured run with zero network calls.
 *
 * Radius is derived from park area (a circle of equal area, floored at 0.08 mi)
 * because the pipeline output stores centroid + acres, not polygons.
 */
function amenityJoin(places) {
  const raw = load("/tmp/overpass-water_amenities.json");
  if (!raw?.elements) return { joined: false };

  const feats = [];
  for (const el of raw.elements) {
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
  if (!feats.length) return { joined: false };

  let withWater = 0;
  for (const p of places) {
    const acres = p.area_acres ?? 10;
    const radius = Math.max(0.08, Math.sqrt(acres / 640 / Math.PI));
    const near = feats.filter((f) => haversineMiles(p.lat, p.lon, f.lat, f.lon) <= radius);
    const kinds = new Set(near.map((f) => f.kind));
    const subs = new Set(near.map((f) => f.sub).filter(Boolean));
    const list = [];
    if (kinds.has("water")) list.push("water");
    if (kinds.has("playground")) list.push("playground");
    if (kinds.has("sports")) list.push("sports");
    for (const s of ["swimming_pool", "water_park", "fountain"]) if (subs.has(s)) list.push(s);
    if ((p.area_acres ?? 0) > 200) list.push("large");

    p.water_feature = kinds.has("water");
    p.amenities = [...new Set(list)];
    p.provenance = {
      ...p.provenance,
      water_feature: `OpenStreetMap features within ${radius.toFixed(2)} mi of centroid (area-derived radius)`,
      amenities: `OpenStreetMap features within ${radius.toFixed(2)} mi of centroid`,
    };
    if (p.water_feature) withWater++;
  }
  return { joined: true, features: feats.length, withWater };
}

function main() {
  const extras = load("/tmp/places.extras.json");
  const full = load("/tmp/places.full.json");
  const base = extras ?? full;
  if (!base) throw new Error("no pipeline output found — run regenerate-places.mjs first");
  const usedExtras = Boolean(extras);

  const audit = load("/tmp/holc-audit.json");
  const holcGj = load("/tmp/mappinginequality.json");

  // label -> {canopy, impervious} from the neighborhood audit
  const byLabel = new Map();
  for (const r of audit?.results ?? []) {
    if (r.label && r.canopy !== null) byLabel.set(r.label, { canopy: r.canopy, impervious: r.impervious, grade: r.grade });
  }
  // grade -> mean, used when a park's exact polygon has no audit sample
  const byGrade = {};
  for (const r of audit?.results ?? []) {
    if (r.canopy === null) continue;
    (byGrade[r.grade] ??= { c: [], i: [] }).c.push(r.canopy);
    byGrade[r.grade].i.push(r.impervious);
  }

  const holcFeats = (holcGj?.features ?? []).filter(
    (f) => String(f.properties?.city ?? "").includes("Kansas City") && f.properties?.grade,
  );

  const places = [];
  let joined = 0;
  let viaGrade = 0;

  for (const p of base.places) {
    let hoodCanopy = null;
    let hoodImperv = null;
    let joinMethod = null;

    // 1. exact polygon the park centroid falls in
    const feat = holcFeats.find((f) => pointInGeom(p.lat, p.lon, f.geometry));
    if (feat) {
      const a = byLabel.get(feat.properties.label);
      if (a) {
        hoodCanopy = a.canopy;
        hoodImperv = a.impervious;
        joinMethod = `HOLC area ${feat.properties.label} (grade ${feat.properties.grade}), NLCD interior samples`;
        joined++;
      }
    }
    // 2. fall back to the grade-wide mean
    if (hoodCanopy === null && p.holc_grade && byGrade[p.holc_grade]) {
      hoodCanopy = mean(byGrade[p.holc_grade].c);
      hoodImperv = mean(byGrade[p.holc_grade].i);
      joinMethod = `grade-${p.holc_grade} mean across ${byGrade[p.holc_grade].c.length} HOLC areas (no exact polygon sample)`;
      viaGrade++;
    }

    const prov = { ...p.provenance };
    if (joinMethod) prov.neighborhood_canopy_index = joinMethod;

    places.push({
      ...p,
      water_feature: usedExtras ? p.water_feature : SEED_WATER.has(p.id),
      neighborhood_canopy_index: r1(hoodCanopy),
      neighborhood_impervious_index: r1(hoodImperv),
      provenance: prov,
    });
  }

  // Fold in cached OSM amenities if available; overwrites the fallback above.
  const amen = amenityJoin(places);
  if (!amen.joined) {
    for (const p of places) {
      p.provenance = {
        ...p.provenance,
        water_feature: "curated fallback list (OSM enrichment unavailable at build time)",
        amenities: "unavailable — OSM enrichment pass did not run",
      };
    }
  }
  for (const p of places) {
    if (typeof p.noise_index !== "number") {
      p.provenance = { ...p.provenance, noise_index: "unavailable — OSM road proximity pass did not run" };
    }
  }

  const payload = {
    ...base,
    generated_at: new Date().toISOString(),
    generator: "scripts/build-registry.mjs",
    enrichment: {
      osm_extras: usedExtras,
      neighborhood_join: { exact_polygon: joined, grade_fallback: viaGrade, unmapped: places.length - joined - viaGrade },
    },
    neighborhood_audit: audit
      ? Object.fromEntries(
          Object.entries(byGrade).map(([g, v]) => [g, { n: v.c.length, mean_canopy: r1(mean(v.c)), mean_impervious: r1(mean(v.i)) }]),
        )
      : null,
    count: places.length,
    places,
  };

  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`wrote ${OUT}`);
  console.log(`  ${places.length} places · osm_extras=${usedExtras}`);
  console.log(`  neighborhood join: ${joined} exact polygon, ${viaGrade} grade-mean, ${places.length - joined - viaGrade} unmapped`);
  console.log(`  amenities: ${amen.joined ? `${amen.features} OSM features joined, ${amen.withWater} parks with water` : "unavailable"}`);
  if (payload.neighborhood_audit) {
    console.log("  neighborhood canopy by grade:");
    for (const [g, v] of Object.entries(payload.neighborhood_audit).sort())
      console.log(`    ${g}: n=${v.n} canopy ${v.mean_canopy}% impervious ${v.mean_impervious}%`);
  }
}

main();
