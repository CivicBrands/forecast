CREATE TABLE IF NOT EXISTS latents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  name TEXT NOT NULL,
  value REAL NOT NULL,
  collation_id INTEGER NOT NULL,
  inputs TEXT NOT NULL,
  confidence REAL
);
CREATE INDEX IF NOT EXISTS idx_latents_ts ON latents(ts DESC);
CREATE INDEX IF NOT EXISTS idx_latents_name_ts ON latents(name, ts DESC);
