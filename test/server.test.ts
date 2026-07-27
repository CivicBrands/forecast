import { before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AddressInfo } from "node:net";
import { once } from "node:events";

const tmp = mkdtempSync(join(tmpdir(), "forecast-server-"));
process.env.DB_PATH = join(tmp, "test.db");
process.env.AIRNOW_API_KEY = "test";

import { appendSnapshot, appendCollation } from "../src/store";
import { startServer } from "../src/server";

const server = startServer(0);
let base: string;

before(async () => {
  if (!server.listening) await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
});

test("GET /healthz returns ok", async () => {
  const r = await fetch(`${base}/healthz`);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
});

test("GET / returns endpoint JSON for API clients", async () => {
  const r = await fetch(`${base}/`, { headers: { Accept: "application/json" } });
  assert.equal(r.status, 200);
  const body = (await r.json()) as { endpoints: string[] };
  assert.ok(body.endpoints.includes("/healthz"));
  assert.ok(body.endpoints.includes("/collations/latest"));
});

test("GET / returns dashboard HTML for browsers", async () => {
  const r = await fetch(`${base}/`, { headers: { Accept: "text/html" } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type") ?? "", /text\/html/);
  const body = await r.text();
  assert.match(body, /What is happening around Kansas City right now\?/);
  assert.match(body, /href="\/crowdcast"/);
  assert.match(body, /Open Park Crowd-Cast/);
  assert.match(body, /relative forecast, not a headcount/);
  assert.match(body, /Where the readings came from/);
  assert.match(body, /KC help/);
  assert.match(body, /Heat warning: get somewhere cooler/);
  assert.match(body, /civicbrands\.org\/kc\/housing/);
  assert.match(body, /Choose a Forecast pathway/);
  assert.match(body, /Raw data access/);
  assert.match(body, /Provider \/ methodology/);
});

test("GET / defaults to dashboard HTML when Accept is omitted", async () => {
  const r = await fetch(`${base}/`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type") ?? "", /text\/html/);
  assert.match(await r.text(), /What is happening around Kansas City right now\?/);
});

test("GET /field/current rejects invalid location query", async () => {
  const r = await fetch(`${base}/field/current?lat=999&lon=-94`);
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { error: "invalid_lat" });
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
