"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendSnapshot = appendSnapshot;
exports.latestSnapshot = latestSnapshot;
exports.appendCollation = appendCollation;
exports.latestCollation = latestCollation;
exports.appendLatent = appendLatent;
exports.latestLatents = latestLatents;
exports.latentsByName = latentsByName;
async function appendSnapshot(db, snap) {
    const res = await db
        .prepare(`INSERT INTO snapshots (source, fetched_at, observed_at_min, observed_at_max, data)
       VALUES (?1, ?2, ?3, ?4, ?5)`)
        .bind(snap.source, snap.fetched_at, snap.observed_at_min, snap.observed_at_max, JSON.stringify(snap.data))
        .run();
    return Number(res.meta.last_row_id);
}
async function latestSnapshot(db, source) {
    const row = await db
        .prepare(`SELECT id, source, fetched_at, observed_at_min, observed_at_max, data
       FROM snapshots WHERE source = ?1 ORDER BY fetched_at DESC LIMIT 1`)
        .bind(source)
        .first();
    if (!row)
        return null;
    return { ...row, data: JSON.parse(row.data) };
}
async function appendCollation(db, c) {
    const res = await db
        .prepare(`INSERT INTO collations (collated_at, observed_at_min, observed_at_max, sources)
       VALUES (?1, ?2, ?3, ?4)`)
        .bind(c.collated_at, c.observed_at_min, c.observed_at_max, JSON.stringify(c.sources))
        .run();
    return Number(res.meta.last_row_id);
}
async function latestCollation(db) {
    const row = await db
        .prepare(`SELECT id, collated_at, observed_at_min, observed_at_max, sources
       FROM collations ORDER BY collated_at DESC LIMIT 1`)
        .first();
    if (!row)
        return null;
    return { ...row, sources: JSON.parse(row.sources) };
}
async function appendLatent(db, l) {
    const res = await db
        .prepare(`INSERT INTO latents (ts, name, value, collation_id, inputs, confidence)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
        .bind(l.ts, l.name, l.value, l.collation_id, JSON.stringify(l.inputs), l.confidence ?? null)
        .run();
    return Number(res.meta.last_row_id);
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
async function latestLatents(db) {
    const res = await db
        .prepare(`SELECT id, ts, name, value, collation_id, inputs, confidence
       FROM latents WHERE ts = (SELECT MAX(ts) FROM latents)`)
        .all();
    return (res.results ?? []).map(rowToLatent);
}
async function latentsByName(db, name, limit = 100) {
    const res = await db
        .prepare(`SELECT id, ts, name, value, collation_id, inputs, confidence
       FROM latents WHERE name = ?1 ORDER BY ts DESC LIMIT ?2`)
        .bind(name, limit)
        .all();
    return (res.results ?? []).map(rowToLatent);
}
//# sourceMappingURL=store.js.map