import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AddressInfo } from "node:net";

const tmp = mkdtempSync(join(tmpdir(), "forecast-server-"));
process.env.DB_PATH = join(tmp, "test.db");
process.env.AIRNOW_API_KEY = "test";

import { appendSnapshot, appendCollation } from "../src/store";
import { startServer } from "../src/server";

const server = startServer(0);
const port = (server.address() as AddressInfo).port;
const base = `http://127.0.0.1:${port}`;

test("GET /healthz returns ok", async () => {
  const r = await fetch(`${base}/healthz`);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
});

test("GET /snapshots/UNKNOWN returns 404", async () => {
  const r = await fetch(`${base}/snapshots/BOGUS`);
  assert.equal(r.status, 404);
});

test("GET /snapshots/METAR returns latest snapshot", async () => {
  appendSnapshot({
    source: "METAR",
    fetched_at: 1000,
    observed_at_min: 100,
    observed_at_max: 200,
    data: [{ icao: "KMCI" }],
  });
  const r = await fetch(`${base}/snapshots/METAR`);
  assert.equal(r.status, 200);
  const body = (await r.json()) as { source: string; data: unknown[] };
  assert.equal(body.source, "METAR");
  assert.equal(body.data.length, 1);
});

test("GET /collations/latest returns the latest collation", async () => {
  appendCollation({
    collated_at: 5000,
    observed_at_min: 100,
    observed_at_max: 300,
    sources: { METAR: { snapshot_id: 1, fetched_at: 1000, record_count: 1 } },
  });
  const r = await fetch(`${base}/collations/latest`);
  assert.equal(r.status, 200);
  const body = (await r.json()) as { collated_at: number };
  assert.equal(body.collated_at, 5000);
});

test("POST /healthz returns 405", async () => {
  const r = await fetch(`${base}/healthz`, { method: "POST" });
  assert.equal(r.status, 405);
});

test.after(() => {
  server.close();
  rmSync(tmp, { recursive: true, force: true });
});
