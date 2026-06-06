"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendSnapshot = appendSnapshot;
exports.latestSnapshot = latestSnapshot;
exports.appendCollation = appendCollation;
exports.latestCollation = latestCollation;
exports.appendLatent = appendLatent;
exports.latestLatents = latestLatents;
exports.latentsByName = latentsByName;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const config_1 = require("./config");
(0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(config_1.config.dbPath), { recursive: true });
const db = new better_sqlite3_1.default(config_1.config.dbPath);
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
const insertSnapshotStmt = db.prepare(`INSERT INTO snapshots (source, fetched_at, observed_at_min, observed_at_max, data)
   VALUES (?, ?, ?, ?, ?)`);
const latestSnapshotStmt = db.prepare(`SELECT id, source, fetched_at, observed_at_min, observed_at_max, data
   FROM snapshots WHERE source = ? ORDER BY fetched_at DESC LIMIT 1`);
const insertCollationStmt = db.prepare(`INSERT INTO collations (collated_at, observed_at_min, observed_at_max, sources)
   VALUES (?, ?, ?, ?)`);
const latestCollationStmt = db.prepare(`SELECT id, collated_at, observed_at_min, observed_at_max, sources
   FROM collations ORDER BY collated_at DESC LIMIT 1`);
const insertLatentStmt = db.prepare(`INSERT INTO latents (ts, name, value, collation_id, inputs, confidence)
   VALUES (?, ?, ?, ?, ?, ?)`);
const latestLatentsStmt = db.prepare(`SELECT id, ts, name, value, collation_id, inputs, confidence
   FROM latents WHERE ts = (SELECT MAX(ts) FROM latents)`);
const latentsByNameStmt = db.prepare(`SELECT id, ts, name, value, collation_id, inputs, confidence
   FROM latents WHERE name = ? ORDER BY ts DESC LIMIT ?`);
function appendSnapshot(snap) {
    const info = insertSnapshotStmt.run(snap.source, snap.fetched_at, snap.observed_at_min, snap.observed_at_max, JSON.stringify(snap.data));
    return Number(info.lastInsertRowid);
}
function latestSnapshot(source) {
    const row = latestSnapshotStmt.get(source);
    if (!row)
        return null;
    return { ...row, data: JSON.parse(row.data) };
}
function appendCollation(c) {
    const info = insertCollationStmt.run(c.collated_at, c.observed_at_min, c.observed_at_max, JSON.stringify(c.sources));
    return Number(info.lastInsertRowid);
}
function latestCollation() {
    const row = latestCollationStmt.get();
    if (!row)
        return null;
    return { ...row, sources: JSON.parse(row.sources) };
}
function appendLatent(l) {
    const info = insertLatentStmt.run(l.ts, l.name, l.value, l.collation_id, JSON.stringify(l.inputs), l.confidence ?? null);
    return Number(info.lastInsertRowid);
}
function rowToLatent(row) {
    return {
        id: row.id,
        ts: row.ts,
        name: row.name,
        value: row.value,
        collation_id: row.collation_id,
        inputs: JSON.parse(row.inputs),
        confidence: row.confidence ?? undefined,
    };
}
function latestLatents() {
    const rows = latestLatentsStmt.all();
    return rows.map(rowToLatent);
}
function latentsByName(name, limit = 100) {
    const rows = latentsByNameStmt.all(name, limit);
    return rows.map(rowToLatent);
}
//# sourceMappingURL=store.js.map