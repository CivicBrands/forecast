import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type SourceKey = "METAR" | "AIRNOW";

export type Snapshot<T = unknown> = {
  source: SourceKey;
  fetched_at: number;
  observed_at_min: number;
  observed_at_max: number;
  data: T[];
};

const DB_PATH = process.env.DB_PATH ?? "./data/forecast.db";

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
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
`);

const insertStmt = db.prepare(
  `INSERT INTO snapshots (source, fetched_at, observed_at_min, observed_at_max, data)
   VALUES (?, ?, ?, ?, ?)`,
);

const latestStmt = db.prepare(
  `SELECT source, fetched_at, observed_at_min, observed_at_max, data
   FROM snapshots WHERE source = ? ORDER BY fetched_at DESC LIMIT 1`,
);

export function appendSnapshot<T>(snap: Snapshot<T>): void {
  insertStmt.run(
    snap.source,
    snap.fetched_at,
    snap.observed_at_min,
    snap.observed_at_max,
    JSON.stringify(snap.data),
  );
}

export function latestSnapshot<T = unknown>(source: SourceKey): Snapshot<T> | null {
  const row = latestStmt.get(source) as
    | { source: SourceKey; fetched_at: number; observed_at_min: number; observed_at_max: number; data: string }
    | undefined;
  if (!row) return null;
  return { ...row, data: JSON.parse(row.data) as T[] };
}
