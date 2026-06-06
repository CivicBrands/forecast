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

type SnapshotRow = {
  id: number;
  source: SourceKey;
  fetched_at: number;
  observed_at_min: number;
  observed_at_max: number;
  data: string;
};

type CollationRow = {
  id: number;
  collated_at: number;
  observed_at_min: number;
  observed_at_max: number;
  sources: string;
};

type LatentRow = {
  id: number;
  ts: number;
  name: string;
  value: number;
  collation_id: number;
  inputs: string;
  confidence: number | null;
};

export async function appendSnapshot<T>(db: D1Database, snap: Snapshot<T>): Promise<number> {
  const res = await db
    .prepare(
      `INSERT INTO snapshots (source, fetched_at, observed_at_min, observed_at_max, data)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
    )
    .bind(snap.source, snap.fetched_at, snap.observed_at_min, snap.observed_at_max, JSON.stringify(snap.data))
    .run();
  return Number(res.meta.last_row_id);
}

export async function latestSnapshot<T = unknown>(db: D1Database, source: SourceKey): Promise<Snapshot<T> | null> {
  const row = await db
    .prepare(
      `SELECT id, source, fetched_at, observed_at_min, observed_at_max, data
       FROM snapshots WHERE source = ?1 ORDER BY fetched_at DESC LIMIT 1`,
    )
    .bind(source)
    .first<SnapshotRow>();
  if (!row) return null;
  return { ...row, data: JSON.parse(row.data) as T[] };
}

export async function appendCollation(db: D1Database, c: Collation): Promise<number> {
  const res = await db
    .prepare(
      `INSERT INTO collations (collated_at, observed_at_min, observed_at_max, sources)
       VALUES (?1, ?2, ?3, ?4)`,
    )
    .bind(c.collated_at, c.observed_at_min, c.observed_at_max, JSON.stringify(c.sources))
    .run();
  return Number(res.meta.last_row_id);
}

export async function latestCollation(db: D1Database): Promise<Collation | null> {
  const row = await db
    .prepare(
      `SELECT id, collated_at, observed_at_min, observed_at_max, sources
       FROM collations ORDER BY collated_at DESC LIMIT 1`,
    )
    .first<CollationRow>();
  if (!row) return null;
  return { ...row, sources: JSON.parse(row.sources) as Collation["sources"] };
}

export async function appendLatent(db: D1Database, l: Latent): Promise<number> {
  const res = await db
    .prepare(
      `INSERT INTO latents (ts, name, value, collation_id, inputs, confidence)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(l.ts, l.name, l.value, l.collation_id, JSON.stringify(l.inputs), l.confidence ?? null)
    .run();
  return Number(res.meta.last_row_id);
}

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

export async function latestLatents(db: D1Database): Promise<Latent[]> {
  const res = await db
    .prepare(
      `SELECT id, ts, name, value, collation_id, inputs, confidence
       FROM latents WHERE ts = (SELECT MAX(ts) FROM latents)`,
    )
    .all<LatentRow>();
  return (res.results ?? []).map(rowToLatent);
}

export async function latentsByName(db: D1Database, name: string, limit = 100): Promise<Latent[]> {
  const res = await db
    .prepare(
      `SELECT id, ts, name, value, collation_id, inputs, confidence
       FROM latents WHERE name = ?1 ORDER BY ts DESC LIMIT ?2`,
    )
    .bind(name, limit)
    .all<LatentRow>();
  return (res.results ?? []).map(rowToLatent);
}
