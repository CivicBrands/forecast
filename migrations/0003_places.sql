-- Place registry + time-resolved place signals.
--
-- `places` is the STATIC overlay: park geometry + attributes that change on a
-- decadal (canopy, land-surface heat), historical (HOLC grade), or slow
-- (amenities, baseline noise) timescale. It is precomputed by an offline
-- pipeline (OSM/Overpass geometry, Mapping Inequality HOLC join, Landsat/MODIS
-- canopy + LST, DOT BTS noise), NOT fetched per tick.
--
-- `place_signals` is the DYNAMIC output: one row per park per derivation, the
-- predicted crowd concentration and the drivers behind it. `foot_traffic` is a
-- deliberate seam for observed ground truth (e.g. a SafeGraph subscription):
-- when present it calibrates the prediction and feeds a separate,
-- soberly-scored anomaly signal for safety analysis.

CREATE TABLE IF NOT EXISTS places (
  id           TEXT PRIMARY KEY,          -- stable slug, e.g. 'loose-park'
  name         TEXT NOT NULL,
  category     TEXT NOT NULL,             -- 'park' for now; registry generalizes
  lat          REAL NOT NULL,
  lon          REAL NOT NULL,
  area_acres   REAL,
  holc_grade   TEXT,                      -- 'A' | 'B' | 'C' | 'D' | NULL (unmapped)
  canopy_index REAL,                      -- 0..100, higher = more tree canopy
  lst_summer_index REAL,                  -- 0..100, higher = hotter surface in summer
  noise_index  REAL,                      -- 0..100, higher = louder baseline
  water_feature INTEGER DEFAULT 0,        -- 0/1, enterable/cooling water present
  amenities    TEXT NOT NULL DEFAULT '[]',-- JSON array of tags
  access_points TEXT NOT NULL DEFAULT '[]',-- JSON array of {name,lat,lon,road}
  provenance   TEXT NOT NULL DEFAULT '{}',-- JSON: per-attribute source + method
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS place_signals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           INTEGER NOT NULL,
  place_id     TEXT NOT NULL,
  signal       TEXT NOT NULL DEFAULT 'park_crowding',
  value        REAL NOT NULL,             -- 0..100 predicted crowd concentration
  rank         INTEGER,                   -- 1 = most crowded in the run
  demand       REAL,                      -- day/weather demand multiplier applied
  pull         REAL,                      -- static attractiveness under weather
  friction     REAL,                      -- dynamic access penalty
  drivers      TEXT NOT NULL DEFAULT '{}',-- JSON: signed contributions
  narrative    TEXT,                      -- public-facing crowd-cast copy
  foot_traffic REAL,                      -- observed ground truth (nullable seam)
  anomaly      REAL,                      -- observed vs predicted deviation (safety)
  confidence   REAL
);

CREATE INDEX IF NOT EXISTS idx_place_signals_ts ON place_signals(ts DESC);
CREATE INDEX IF NOT EXISTS idx_place_signals_place_ts ON place_signals(place_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_place_signals_signal_ts ON place_signals(signal, ts DESC);
