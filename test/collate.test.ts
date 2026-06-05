import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "forecast-collate-"));
process.env.DB_PATH = join(tmp, "test.db");
process.env.COLLATION_MAX_AGE_MS = "60000";
process.env.AIRNOW_API_KEY = "test";

import { appendSnapshot } from "../src/store";
import { collate } from "../src/collate";

test("returns null when no snapshots exist", () => {
  assert.equal(collate(Date.now()), null);
});

test("collates fresh snapshots across sources", () => {
  const now = 1_000_000;
  appendSnapshot({
    source: "METAR",
    fetched_at: now - 10_000,
    observed_at_min: 100,
    observed_at_max: 200,
    data: [{ x: 1 }],
  });
  appendSnapshot({
    source: "AIRNOW",
    fetched_at: now - 5_000,
    observed_at_min: 150,
    observed_at_max: 300,
    data: [{ y: 1 }, { y: 2 }],
  });

  const c = collate(now);
  assert.ok(c);
  assert.equal(c.observed_at_min, 100);
  assert.equal(c.observed_at_max, 300);
  assert.equal(c.sources.METAR?.record_count, 1);
  assert.equal(c.sources.AIRNOW?.record_count, 2);
});

test("skips snapshots older than COLLATION_MAX_AGE_MS", () => {
  const now = 2_000_000;
  appendSnapshot({
    source: "METAR",
    fetched_at: now - 5_000,
    observed_at_min: 100,
    observed_at_max: 200,
    data: [{ x: 1 }],
  });
  appendSnapshot({
    source: "AIRNOW",
    fetched_at: now - 999_999,
    observed_at_min: 150,
    observed_at_max: 300,
    data: [{ y: 1 }],
  });

  const c = collate(now);
  assert.ok(c);
  assert.ok(c.sources.METAR);
  assert.equal(c.sources.AIRNOW, undefined);
});

test.after(() => rmSync(tmp, { recursive: true, force: true }));
