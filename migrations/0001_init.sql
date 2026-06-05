CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  observed_at_min INTEGER NOT NULL,
  observed_at_max INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_source_fetched
  ON snapshots(source, fetched_at DESC);

CREATE TABLE IF NOT EXISTS collations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collated_at INTEGER NOT NULL,
  observed_at_min INTEGER NOT NULL,
  observed_at_max INTEGER NOT NULL,
  sources TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_collations_collated_at
  ON collations(collated_at DESC);
