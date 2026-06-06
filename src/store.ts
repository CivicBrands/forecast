import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config";

export type SourceKey = string;

export type Snapshot<T = unknown> = {
  id?: number;
  source: SourceKey;
  fetched_at: number;
  observed_at_min: number;
  observed_at_max: number;
  data: T[];
};

export type Collation = {
  id?: number;
  collated_at: number;
  observed_at_min: number;
  observed_at_max: number;
  sources: Record<string, { snapshot_id: number; fetched_at: number; record_count: number }>;
};

export type Latent = {
  id?: number;
  ts: number;
  name: string;
  value: number;
  collation_id: number;
  inputs: Record<string, unknown>;
  confidence?: number;
};

mkdirSync(dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
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

  CREATE TABLE IF NOT EXISTS collations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collated_at INTEGER NOT NULL,
    observed_at_min INTEGER NOT NULL,
    observed_at_max INTEGER NOT NULL,
    sources TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_collations_collated_at
    ON collations(collated_at DESC);

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
`);

const insertSnapshotStmt = db.prepare(
  `INSERT INTO snapshots (source, fetched_at, observed_at_min, observed_at_max, data)
   VALUES (?, ?, ?, ?, ?)`,
);

const latestSnapshotStmt = db.prepare(
  `SELECT id, source, fetched_at, observed_at_min, observed_at_max, data
   FROM snapshots WHERE source = ? ORDER BY fetched_at DESC LIMIT 1`,
);

const insertCollationStmt = db.prepare(
  `INSERT INTO collations (collated_at, observed_at_min, observed_at_max, sources)
   VALUES (?, ?, ?, ?)`,
);

const latestCollationStmt = db.prepare(
  `SELECT id, collated_at, observed_at_min, observed_at_max, sources
   FROM collations ORDER BY collated_at DESC LIMIT 1`,
);

const insertLatentStmt = db.prepare(
  `INSERT INTO latents (ts, name, value, collation_id, inputs, confidence)
   VALUES (?, ?, ?, ?, ?, ?)`,
);

const latestLatentsStmt = db.prepare(
  `SELECT id, ts, name, value, collation_id, inputs, confidence
   FROM latents WHERE ts = (SELECT MAX(ts) FROM latents)`,
);

const latentsByNameStmt = db.prepare(
  `SELECT id, ts, name, value, collation_id, inputs, confidence
   FROM latents WHERE name = ? ORDER BY ts DESC LIMIT ?`,
);

export function appendSnapshot<T>(snap: Snapshot<T>): number {
  const info = insertSnapshotStmt.run(
    snap.source,
    snap.fetched_at,
    snap.observed_at_min,
    snap.observed_at_max,
    JSON.stringify(snap.data),
  );
  return Number(info.lastInsertRowid);
}

export function latestSnapshot<T = unknown>(source: SourceKey): Snapshot<T> | null {
  const row = latestSnapshotStmt.get(source) as
    | { id: number; source: SourceKey; fetched_at: number; observed_at_min: number; observed_at_max: number; data: string }
    | undefined;
  if (!row) return null;
  return { ...row, data: JSON.parse(row.data) as T[] };
}

export function appendCollation(c: Collation): number {
  const info = insertCollationStmt.run(
    c.collated_at,
    c.observed_at_min,
    c.observed_at_max,
    JSON.stringify(c.sources),
  );
  return Number(info.lastInsertRowid);
}

export function latestCollation(): Collation | null {
  const row = latestCollationStmt.get() as
    | { id: number; collated_at: number; observed_at_min: number; observed_at_max: number; sources: string }
    | undefined;
  if (!row) return null;
  return { ...row, sources: JSON.parse(row.sources) as Collation["sources"] };
}

export function appendLatent(l: Latent): number {
  const info = insertLatentStmt.run(
    l.ts,
    l.name,
    l.value,
    l.collation_id,
    JSON.stringify(l.inputs),
    l.confidence ?? null,
  );
  return Number(info.lastInsertRowid);
}

type LatentRow = { id: number; ts: number; name: string; value: number; collation_id: number; inputs: string; confidence: number | null };

function rowToLatent(row: LatentRow): Latent {
  return {
    id: row.id,
    ts: row.ts,
    name: row.name,
    value: row.value,
    collation_id: row.collation_id,
    inputs: JSON.parse(row.inputs) as Record<string, unknown>,
    confidence: row.confidence ?? undefined,
  };
}

export function latestLatents(): Latent[] {
  const rows = latestLatentsStmt.all() as LatentRow[];
  return rows.map(rowToLatent);
}

export function latentsByName(name: string, limit = 100): Latent[] {
  const rows = latentsByNameStmt.all(name, limit) as LatentRow[];
  return rows.map(rowToLatent);
}
