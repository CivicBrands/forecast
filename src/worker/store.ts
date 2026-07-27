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

export type PlaceSignal = {
  ts: number;
  place_id: string;
  signal?: string;
  value: number;
  rank?: number;
  demand?: number;
  pull?: number;
  friction?: number;
  drivers?: Record<string, unknown>;
  narrative?: string;
  foot_traffic?: number;
  anomaly?: number;
  confidence?: number;
};

type PlaceSignalRow = {
  ts: number;
  place_id: string;
  signal: string;
  value: number;
  rank: number | null;
  demand: number | null;
  pull: number | null;
  friction: number | null;
  drivers: string;
  narrative: string | null;
  foot_traffic: number | null;
  anomaly: number | null;
  confidence: number | null;
};

export async function appendPlaceSignal(db: D1Database, s: PlaceSignal): Promise<number> {
  const res = await db
    .prepare(
      `INSERT INTO place_signals (ts, place_id, signal, value, rank, demand, pull, friction, drivers, narrative, foot_traffic, anomaly, confidence)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
    )
    .bind(
      s.ts,
      s.place_id,
      s.signal ?? "park_crowding",
      s.value,
      s.rank ?? null,
      s.demand ?? null,
      s.pull ?? null,
      s.friction ?? null,
      JSON.stringify(s.drivers ?? {}),
      s.narrative ?? null,
      s.foot_traffic ?? null,
      s.anomaly ?? null,
      s.confidence ?? null,
    )
    .run();
  return Number(res.meta.last_row_id);
}

const HOUR_MS = 3_600_000;

async function getState(db: D1Database, key: string): Promise<number | null> {
  const row = await db.prepare(`SELECT value FROM maintenance_state WHERE key = ?1`).bind(key).first<{ value: number }>();
  return row?.value ?? null;
}

async function setState(db: D1Database, key: string, value: number, now: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO maintenance_state (key, value, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3`,
    )
    .bind(key, value, now)
    .run();
}

export type MaintenanceReport = {
  ran: boolean;
  rolledFrom?: number;
  rolledTo?: number;
  hourlyRows?: number;
  pruned?: number;
  retentionDays?: number;
};

/**
 * Roll complete hours of `place_signals` into `place_signals_hourly`, then
 * optionally prune raw rows past the retention window.
 *
 * Cost shape: at 24 parks × 288 ticks/day the raw table grows ~6.9k rows/day.
 * The hourly rollup compresses that ~12:1 (24 parks × 24 hours = 576 rows/day)
 * while preserving the diurnal/seasonal shape that a future calibration model
 * needs. Runs at most once per hour so it adds no meaningful per-tick cost.
 *
 * PRUNING IS DESTRUCTIVE and therefore opt-in: it only happens when
 * PLACE_SIGNALS_RETENTION_DAYS is set to a positive number. With it unset the
 * rollup is purely additive and nothing is ever deleted.
 */
export async function maintainPlaceSignals(
  db: D1Database,
  now: number,
  retentionDays = 0,
): Promise<MaintenanceReport> {
  const currentHour = Math.floor(now / HOUR_MS) * HOUR_MS;
  const lastRun = await getState(db, "last_maintenance_hour");
  if (lastRun !== null && lastRun >= currentHour) return { ran: false };

  // Roll up everything from the last completed rollup to the current hour.
  // First run backfills from the oldest raw row.
  let from = await getState(db, "rolled_through_hour");
  if (from === null) {
    const oldest = await db.prepare(`SELECT MIN(ts) AS t FROM place_signals`).first<{ t: number | null }>();
    if (oldest?.t == null) {
      await setState(db, "last_maintenance_hour", currentHour, now);
      return { ran: true, hourlyRows: 0 };
    }
    from = Math.floor(oldest.t / HOUR_MS) * HOUR_MS;
  }

  const res = await db
    .prepare(
      `INSERT OR REPLACE INTO place_signals_hourly (place_id, hour_ts, signal, avg_value, max_value, min_value, avg_rank, samples)
       SELECT place_id, (ts / ${HOUR_MS}) * ${HOUR_MS} AS hour_ts, signal,
              AVG(value), MAX(value), MIN(value), AVG(rank), COUNT(*)
       FROM place_signals
       WHERE ts >= ?1 AND ts < ?2
       GROUP BY place_id, hour_ts, signal`,
    )
    .bind(from, currentHour)
    .run();

  await setState(db, "rolled_through_hour", currentHour, now);
  await setState(db, "last_maintenance_hour", currentHour, now);

  let pruned = 0;
  if (retentionDays > 0) {
    const cutoff = now - retentionDays * 24 * HOUR_MS;
    // Never prune anything that has not been rolled up yet.
    const safeCutoff = Math.min(cutoff, currentHour);
    const del = await db.prepare(`DELETE FROM place_signals WHERE ts < ?1`).bind(safeCutoff).run();
    pruned = Number(del.meta.changes ?? 0);
  }

  return {
    ran: true,
    rolledFrom: from,
    rolledTo: currentHour,
    hourlyRows: Number(res.meta.changes ?? 0),
    pruned,
    retentionDays,
  };
}

export type PlaceSignalHourly = {
  place_id: string;
  hour_ts: number;
  avg_value: number;
  max_value: number;
  min_value: number;
  samples: number;
};

/** Hourly history for one place — the diurnal shape, cheap to read. */
export async function placeSignalHistory(
  db: D1Database,
  placeId: string,
  limit = 168,
): Promise<PlaceSignalHourly[]> {
  const res = await db
    .prepare(
      `SELECT place_id, hour_ts, avg_value, max_value, min_value, samples
       FROM place_signals_hourly WHERE place_id = ?1 AND signal = 'park_crowding'
       ORDER BY hour_ts DESC LIMIT ?2`,
    )
    .bind(placeId, limit)
    .all<PlaceSignalHourly>();
  return res.results ?? [];
}

export async function latestPlaceSignals(db: D1Database, signal = "park_crowding"): Promise<PlaceSignal[]> {
  const res = await db
    .prepare(
      `SELECT ts, place_id, signal, value, rank, demand, pull, friction, drivers, narrative, foot_traffic, anomaly, confidence
       FROM place_signals
       WHERE signal = ?1 AND ts = (SELECT MAX(ts) FROM place_signals WHERE signal = ?1)
       ORDER BY rank ASC`,
    )
    .bind(signal)
    .all<PlaceSignalRow>();
  return (res.results ?? []).map((r) => ({
    ts: r.ts,
    place_id: r.place_id,
    signal: r.signal,
    value: r.value,
    rank: r.rank ?? undefined,
    demand: r.demand ?? undefined,
    pull: r.pull ?? undefined,
    friction: r.friction ?? undefined,
    drivers: JSON.parse(r.drivers ?? "{}") as Record<string, unknown>,
    narrative: r.narrative ?? undefined,
    foot_traffic: r.foot_traffic ?? undefined,
    anomaly: r.anomaly ?? undefined,
    confidence: r.confidence ?? undefined,
  }));
}
