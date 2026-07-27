# The Compendium — Chapter: Where The City Actually Goes

*A running book of loosely-coupled, tightly-provenanced correlations that make a
Kansas Citian go "huh, I never realized that." The commons belongs to everybody;
so does noticing how it really gets used. This chapter is the Park Crowd-Cast.*

---

## The one-liner

On a hot day, Kansas City doesn't spread out across its parks — it **funnels**
into a handful of cool, wet, shaded ones and abandons the rest. Which ones fill
and which ones bake is not random, not really about the parks themselves, and
mostly decided decades before anyone packed a cooler. You can call the crowd map
from a thermometer, a closure feed, and a **1939 redlining map**.

## The chain (signed)

```
STRUCTURAL   HOLC 1939 grade ──(D →)──▶ ↓canopy, ↑surface heat, ↓amenities   [the explainer]
STATIC PULL  canopy / shade ─(+, ×heat)─▶ cool refuge
             water feature ──(+, ×heat)─▶ the hot-day magnet
             quiet (¬highway/rail) ─(+)─▶ dwell desirability
             amenities ──────────(+)────▶ reasons to come
             surface heat ─(−, ×heat)───▶ bakes the treeless flat
DYNAMIC      road / trail closure ─(−)──▶ access friction  → crowd bounces elsewhere
DEMAND       temperature + day-type + hour + events ──(scales the whole thing)
                                             ⟶  relative crowd concentration, ranked
```

Composed in `src/parks.ts`:

```
crowding(park) = clamp( demand(day, temp) × ( pull(park, heat) + event − friction(park, now) ), 0, 100 )
```

where `pull` weights **shade and water up as the temperature climbs** — the whole
trick is that a tree is worth little at 74° and everything at 98°.

## Provenance — every edge is a free source

| Layer | Field | Free source | Cadence |
|---|---|---|---|
| geometry, amenities | park polygon, tags | OpenStreetMap Overpass (`leisure=park`) | static |
| structural | `holc_grade` | Mapping Inequality HOLC polygons (U. Richmond) | static (historical) |
| canopy / shade | `canopy_index` | USFS/NLCD tree canopy or Landsat NDVI (NASA AppEEARS) | ~annual |
| surface heat | `lst_summer_index` | Landsat/MODIS land-surface temperature, summer mean | ~seasonal |
| noise | `noise_index` | US DOT BTS National Transportation Noise Map | static |
| access friction | closures | WZDx work-zone feeds / KC Scout / KC Open Data 311 | live |
| demand | temperature | METAR (already ingested) → `hottestTempF()` | 5 min |
| demand | heat alert | NWS `api.weather.gov` alerts | ~hourly |
| demand | events | PredictHQ EVENTS (already ingested) | hourly |

Cross-link worth noting: the **noise** layer can borrow the MCI runway-flow logic
from the aviation chain — south-flow vs north-flow at the airport swings which
Northland parks catch climb-out noise on a given afternoon.

## CORRECTION (2026-07-27) — what measurement changed

The first version of this chapter shipped a confident claim that turned out to be
**wrong in two specific ways**. Both were caught by replacing seed estimates with
measurements. Recording it here because a reversed finding is worth more than the
original guess.

**Claim as shipped:** *"The parks that bake and clear out sit, overwhelmingly, east
of Troost — graded D in 1937. The trees that would cool them were never planted.
The shade gap is the crowd gap."*

**Error 1 — false geography.** HOLC grade is not a synonym for "east of Troost."
Penn Valley Park measures grade **D** and sits **west** of Troost, at lon −94.59.
The live page was asserting a location the data contradicted. The Troost divide is
real history, but it is not the same object as the HOLC grade map, and the two
must not be used interchangeably.

**Error 2 — wrong object.** Canopy measured *inside park polygons* shows almost no
grade gradient (A+B 34.2% vs C+D 31.7%, n=61 graded parks). A park is by
construction the greenest patch of its neighborhood, so park-interior canopy is a
poor test of a claim the literature makes about **neighborhoods**.

**What is actually measured** (`scripts/holc-canopy-audit.mjs`, all 120 KC HOLC
polygons, NLCD 2021, 6 interior samples each):

| HOLC grade | n | mean canopy | mean impervious |
|---|---|---|---|
| A | 10 | **37.6%** | 28.0% |
| B | 23 | 26.8% | 40.1% |
| C | 47 | 21.4% | 46.9% |
| D | 40 | 22.1% | 46.7% |
| **A+B** | 33 | **30.1%** | 36.4% |
| **C+D** | 87 | **21.7%** | 46.8% |

The redlining↔canopy↔heat relationship **holds in Kansas City at neighborhood
level** — an 8.4-point canopy gap and a 10.4-point pavement gap — and is monotonic
from A through C. So the literature is vindicated; our sentence was not.

**The corrected — and better — insight.** Because park interiors *don't* vary much
by grade while their surroundings vary a lot, the honest reading inverts the
original: **a park in a redlined neighborhood is not shade-poor, it is shade-rare.**
Spring Valley Park (grade D) measures 38.8% canopy inside against 17.8% in the
blocks around it — more than double. It is a cool island in a hot sea, carrying
more load for more people with nothing nearby to share it. That is the claim the
page now makes, and every number in it is measured.

This is also why `Place` gained `neighborhood_canopy_index`: the redlining signal
lives in the surroundings, not the park, and the model needed a field for it.

## The "huh"

The Troost divide is textbook redlining: from the 1920s on, Black residents were
confined east of Troost Avenue, white and wealthier residents west. HOLC's 1939
survey graded much of that east side "hazardous," and the environmental
fingerprint is still legible — KC appears in the national "Legacy of Redlining"
urban-heat literature and in local canopy-equity assessments.

Our own measurement (n=120 KC HOLC polygons, NLCD 2021) puts numbers on it:
**grade A neighborhoods carry 37.6% canopy over 28% pavement; grade C and D carry
21.7% over 47%.** A ninety-year-old lending map still predicts where the shade is.

The part worth saying out loud is the *inversion* documented in the correction
above. The gap is in the **neighborhoods**, not the parks — park interiors barely
differ by grade, because a park is the greenest patch of wherever it sits. So a
park in a redlined neighborhood is not shade-poor, it is **shade-rare**: Spring
Valley Park (grade D) holds 38.8% canopy against 17.8% in the blocks around it.
It is doing more work, for more people, with less nearby to share the load. When
one of those runs quiet in a heat wave, there is no shaded backup down the street.

That is the one place this project keeps a straight face — and every number in it
is measured, not assumed.

> Note: earlier drafts of this section cited seed estimates (e.g. "Loose Park,
> grade A, 85% canopy"). Measurement contradicted them — Loose measures grade **B**
> with 14.6% interior canopy, because it is largely open lawn. Those figures have
> been removed rather than quietly corrected, so the retraction stays legible.

## Voice guide (for the compendium and the public view)

- **Default: on-air meteorologist.** Bold, specific, a little fun. Call the zoo
  three hours out and own it. "Lock it in." "Bank on it." Name the street, name
  the walk. Confidence comes from signal, not swagger — but when the signal is
  there, don't hedge it to death.
- **Split signal gets mild hedging, not a disclaimer avalanche.** "Sleeper day,"
  "could go either way past 4," — one clause, then move on.
- **The redlining explainer is the sober exception.** No jokes, no "load the
  cooler." State the mechanism plainly and let it land.
- **Anything touching safety/trafficking is a different document in a different
  voice.** See below. Never narrate a risk anomaly in crowd-cast voice.

## The pipeline (now built)

Three scripts, all free/keyless, all runnable offline:

```bash
# 1. discover parks + measure canopy/impervious/HOLC grade
node scripts/regenerate-places.mjs --min-acres 3 --max 220

# 2. audit NEIGHBORHOOD canopy inside every HOLC polygon
node scripts/holc-canopy-audit.mjs

# 3. merge into the runtime registry
node scripts/build-registry.mjs src/places.generated.json
```

`src/places.ts` prefers `places.generated.json` and falls back to the hand-seeded
list if it's missing, so the app never hard-fails on a bad regeneration.
`registryIsMeasured()` reports which is live.

**Board size is capped at 24 parks.** The pipeline discovers ~220 metro-wide, but
each park costs one `place_signals` row per tick (288 ticks/day). Selection keeps
the HOLC-graded parks preferentially — they carry the signal that makes the board
worth reading.

**Operational notes learned the hard way:**

- Public Overpass instances throttle aggressively. The script caches responses to
  `/tmp/overpass-*.json` and supports `--skip-extras` so a run still produces the
  load-bearing measurements when the amenity/road passes are unavailable.
- Excluding `relation` from the park query is a ~10× speedup for a small loss.
- `out geom` (not `out center`) is required — `bounds` is not emitted alongside
  `center`, and real polygons give correct area and in-polygon sampling.
- Sample points must be tested against the polygon. A single centroid probe at
  Loose Park returned 59% canopy; the 5-point in-polygon mean is 14.6%. The park
  is mostly open lawn. **One pixel is not a measurement.**

### Still outstanding

- `noise_index` — the OSM major-road proximity pass has not completed against a
  throttled Overpass. Currently defaults to a neutral 45 rather than pretending
  to be quiet. Re-run without `--skip-extras`.
- `water_feature` — currently a curated fallback list, labeled as such in
  provenance; the OSM pass will replace it.
- `lst_summer_index` — a documented **proxy** (0.7×impervious + 0.3×(100−canopy)),
  not a thermal measurement. Landsat LST has no free keyless endpoint; promoting
  it needs a NASA Earthdata login (free, but an account).

## Original regeneration plan (retained for reference)

To promote seed values to measured:

1. **Geometry/amenities** — Overpass query for `leisure=park` within the metro;
   store polygon + centroid + amenity tags.
2. **HOLC grade** — spatial-join each polygon against Mapping Inequality GeoJSON;
   take the dominant grade (verify per-polygon at boundaries).
3. **Canopy** — zonal mean of NLCD/USFS canopy or Landsat NDVI over the polygon → 0..100.
4. **Heat** — zonal mean of summer Landsat/MODIS LST → 0..100 (normalize metro-wide).
5. **Noise** — sample the BTS noise raster at access points → 0..100.
6. Write rows into the `places` table (migration `0003_places.sql`); the deriver
   swaps from `loadKcParks()` to a table read with zero scoring changes.

Everything above steps 3–5 is a **precompute** (decadal/annual). Only temperature,
alerts, events, and closures touch the live tick. Cheap at runtime.

## SafeGraph calibration & the safety fork (sober)

`place_signals.foot_traffic` is a reserved seam. With an observed foot-traffic
feed:

- **Calibration** — the score blends toward observed truth (currently
  `0.5·predicted + 0.5·observed`), and confidence rises from the seed's 0.55 to 0.82.
- **Anomaly** — `anomaly = observed − predicted`, signed and persisted. A large
  positive anomaly (a park far busier than every environmental driver predicts,
  at a time the model says it should be quiet) is exactly the pattern that merits
  a second look for exploitation and trafficking risk.

This safety derivation is deliberately **not** built on seed data and **not**
written in the crowd-cast voice. It is a separate, sober output gated on real
observed traffic. The Crowd-Cast tells you where the party is; the anomaly channel
is a quiet flag for someone whose job is safety, phrased for that room.

## Generalization

Nothing here is KC-specific except the registry. HOLC is mapped for 200+ cities,
the BTS noise map and Landsat are national/global, OSM is global. **Port = rebuild
the place registry**; the archetypes (structural explainer, heat-weighted pull,
access friction, demand) and the code do not change. Denver swaps in altitude and
Front-Range heat; Atlanta swaps in pollen and the Chattahoochee. Same three shapes.

## Caveats

- **Seed data.** Indices are coarse first-pass estimates until the pipeline runs.
- **Ground truth is the weak link.** Without observed traffic this is a *predicted
  ranking*, not a measured one. Validation waits on the SafeGraph-class feed.
- **Relative, not absolute.** The number is concentration/ranking, not a headcount.

## Sources

- [Dissecting the Troost Divide — Martin City Telegraph](https://martincitytelegraph.com/2020/06/30/dissecting-the-troost-divide-and-racial-segregation-in-kansas-city/)
- [Considerations for Canopy Distribution in Kansas City — Bridging The Gap](https://bridgingthegap.org/considerations-for-equitable-canopy-distribution-in-kansas-city/)
- [Urban Heat Management and the Legacy of Redlining — Journal of the American Planning Association](https://www.tandfonline.com/doi/full/10.1080/01944363.2020.1759127)
- [Troost Avenue racial divide — KCUR](https://www.kcur.org/politics-elections-and-government/2025-10-13/missouris-new-congressional-map-reopens-old-wounds-along-troost-avenue-racial-divide)
