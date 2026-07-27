#!/usr/bin/env node
/**
 * holc-canopy-audit — test the redlining↔canopy↔heat claim at the level it is
 * actually made: NEIGHBORHOODS, not park interiors.
 *
 * Why this exists: the crowd-cast measured canopy *inside park polygons* and
 * found only a weak gradient across HOLC grades. That is the wrong test. Parks
 * are by construction the greenest patch of any neighborhood, so park-interior
 * canopy is a poor proxy for the neighborhood tree canopy the literature
 * describes. This script samples inside the 1939 HOLC polygons themselves.
 *
 * Free/keyless sources only: Mapping Inequality GeoJSON + MRLC NLCD WMS.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const argVal = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const CITY = argVal("--city", "Kansas City");
const SAMPLES = Number(argVal("--samples", "6"));
const CONCURRENCY = 6;
const HOLC_CACHE = "/tmp/mappinginequality.json";
const TCC = "nlcd_tcc_conus_2021_v2021-4";
const IMP = "NLCD_2021_Impervious_L48";
const UA = "forecast-v2/1.0 (civicbrands.org; holc canopy audit)";

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = idx++;
        if (i >= items.length) return;
        out[i] = await worker(items[i], i);
      }
    }),
  );
  return out;
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

function ringsOf(geom) {
  if (!geom) return [];
  return geom.type === "MultiPolygon" ? geom.coordinates : geom.type === "Polygon" ? [geom.coordinates] : [];
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

function boundsOf(geom) {
  let b = { minlat: 90, maxlat: -90, minlon: 180, maxlon: -180 };
  for (const poly of ringsOf(geom))
    for (const ring of poly)
      for (const [lon, lat] of ring) {
        b.minlat = Math.min(b.minlat, lat);
        b.maxlat = Math.max(b.maxlat, lat);
        b.minlon = Math.min(b.minlon, lon);
        b.maxlon = Math.max(b.maxlon, lon);
      }
  return b;
}

/** Grid over bbox, keep points inside the polygon, stride to spread them out. */
function samplePoints(geom, n) {
  const b = boundsOf(geom);
  const inside = [];
  const N = 7;
  for (let i = 1; i <= N; i++)
    for (let j = 1; j <= N; j++) {
      const lat = b.minlat + ((b.maxlat - b.minlat) * i) / (N + 1);
      const lon = b.minlon + ((b.maxlon - b.minlon) * j) / (N + 1);
      if (pointInGeom(lat, lon, geom)) inside.push({ lat, lon });
    }
  if (!inside.length) return [];
  const stride = Math.max(1, Math.floor(inside.length / n));
  const out = [];
  for (let i = 0; i < inside.length && out.length < n; i += stride) out.push(inside[i]);
  return out;
}

async function sample(layer, lat, lon) {
  const d = 0.0009;
  const bbox = `${lon - d},${lat - d},${lon + d},${lat + d}`;
  const url =
    `https://www.mrlc.gov/geoserver/mrlc_display/wms?service=WMS&version=1.1.1&request=GetFeatureInfo` +
    `&layers=${encodeURIComponent(layer)}&query_layers=${encodeURIComponent(layer)}&srs=EPSG:4326` +
    `&bbox=${bbox}&width=3&height=3&x=1&y=1&info_format=application%2Fjson`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(45000) });
    if (!res.ok) return null;
    const j = await res.json();
    const p = j?.features?.[0]?.properties;
    if (!p) return null;
    const v = p.PALETTE_INDEX ?? p.GRAY_INDEX ?? Object.values(p)[0];
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

async function main() {
  if (!existsSync(HOLC_CACHE)) throw new Error(`missing ${HOLC_CACHE} — run regenerate-places first`);
  const gj = JSON.parse(readFileSync(HOLC_CACHE, "utf8"));
  const feats = (gj.features ?? []).filter(
    (f) => String(f.properties?.city ?? "").includes(CITY) && f.properties?.grade,
  );
  console.log(`HOLC canopy audit — ${feats.length} graded polygons matching "${CITY}"`);
  console.log(`sampling ${SAMPLES} interior points per polygon (NLCD 2021)\n`);

  const results = await pool(feats, CONCURRENCY, async (f) => {
    const pts = samplePoints(f.geometry, SAMPLES);
    const canopy = [];
    const imperv = [];
    for (const p of pts) {
      const [c, i] = await Promise.all([sample(TCC, p.lat, p.lon), sample(IMP, p.lat, p.lon)]);
      if (typeof c === "number") canopy.push(c);
      if (typeof i === "number") imperv.push(i);
    }
    process.stdout.write(".");
    return {
      grade: f.properties.grade,
      label: f.properties.label,
      canopy: mean(canopy),
      impervious: mean(imperv),
      n: canopy.length,
    };
  });
  process.stdout.write("\n\n");

  const byGrade = {};
  for (const r of results) {
    if (r.canopy === null) continue;
    (byGrade[r.grade] ??= { canopy: [], imperv: [] }).canopy.push(r.canopy);
    byGrade[r.grade].imperv.push(r.impervious);
  }

  console.log("=== NEIGHBORHOOD canopy & impervious by 1939 HOLC grade ===");
  console.log("grade   n   mean canopy   median canopy   mean impervious");
  for (const g of ["A", "B", "C", "D"]) {
    const v = byGrade[g];
    if (!v) continue;
    console.log(
      `  ${g}   ${String(v.canopy.length).padStart(3)}   ` +
        `${mean(v.canopy).toFixed(1).padStart(9)}%   ${median(v.canopy).toFixed(1).padStart(11)}%   ` +
        `${mean(v.imperv).toFixed(1).padStart(13)}%`,
    );
  }

  const grab = (gs, k) => gs.flatMap((g) => byGrade[g]?.[k] ?? []);
  const ab = grab(["A", "B"], "canopy");
  const cd = grab(["C", "D"], "canopy");
  const abI = grab(["A", "B"], "imperv");
  const cdI = grab(["C", "D"], "imperv");
  console.log("\n=== favored (A+B) vs redlined (C+D) ===");
  if (ab.length && cd.length) {
    console.log(`  canopy      A+B ${mean(ab).toFixed(1)}%  vs  C+D ${mean(cd).toFixed(1)}%   (Δ ${(mean(ab) - mean(cd)).toFixed(1)} pts)`);
    console.log(`  impervious  A+B ${mean(abI).toFixed(1)}%  vs  C+D ${mean(cdI).toFixed(1)}%   (Δ ${(mean(cdI) - mean(abI)).toFixed(1)} pts)`);
  }
  writeFileSync("/tmp/holc-audit.json", JSON.stringify({ city: CITY, results }, null, 2));
  console.log("\nwrote /tmp/holc-audit.json");
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
