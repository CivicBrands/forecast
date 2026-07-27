-- Roll-up + retention.
--
-- Raw `place_signals` accrue ~24 rows per tick (288 ticks/day ≈ 6.9k rows/day).
-- The value of that resolution decays fast: nobody needs 5-minute granularity on
-- a two-week-old crowd forecast, but the hourly shape is worth keeping forever
-- (it is the seasonal baseline a future calibration/anomaly model trains on).
--
-- Strategy: aggregate complete hours into `place_signals_hourly` (additive, safe,
-- idempotent), and prune raw rows only when RETENTION_DAYS is explicitly set.
-- Pruning is destructive, so it is OFF by default.

CREATE TABLE IF NOT EXISTS place_signals_hourly (
  place_id   TEXT NOT NULL,
  hour_ts    INTEGER NOT NULL,          -- epoch ms, floored to the hour
  signal     TEXT NOT NULL DEFAULT 'park_crowding',
  avg_value  REAL NOT NULL,
  max_value  REAL NOT NULL,
  min_value  REAL NOT NULL,
  avg_rank   REAL,
  samples    INTEGER NOT NULL,
  PRIMARY KEY (place_id, hour_ts, signal)
);

CREATE INDEX IF NOT EXISTS idx_psh_hour ON place_signals_hourly(hour_ts DESC);
CREATE INDEX IF NOT EXISTS idx_psh_place_hour ON place_signals_hourly(place_id, hour_ts DESC);

-- Small key/value table so maintenance is resumable and never re-scans history.
CREATE TABLE IF NOT EXISTS maintenance_state (
  key        TEXT PRIMARY KEY,
  value      INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
