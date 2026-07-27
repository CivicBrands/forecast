import "dotenv/config";
import { appendLatent, appendPlaceSignal, appendSnapshot, latestSnapshot, Snapshot } from "./store";
import { collate } from "./collate";
import { deriveLatents } from "./latents";
import { deriveParkCrowding, hottestTempF } from "./parks";
import { loadKcParks } from "./places";
import { startServer } from "./server";
import { config } from "./config";
import { registry } from "./sources/registry";
import { AnySource, SourceContext } from "./sources/types";

const lastFetched = new Map<string, number>();

function buildContext(): SourceContext {
  return {
    lat: config.user.lat,
    lon: config.user.lon,
    radiusMiles: config.user.radiusMiles,
    env: process.env,
  };
}

type RunOutcome =
  | { kind: "skipped" }
  | { kind: "disabled" }
  | { kind: "empty" }
  | { kind: "ok"; count: number };

async function runSource(src: AnySource, ctx: SourceContext, now: number): Promise<RunOutcome> {
  const last = lastFetched.get(src.name) ?? 0;
  if (last !== 0 && now - last < src.cadenceMs) return { kind: "skipped" };
  if (!src.isEnabled(ctx)) return { kind: "disabled" };
  const data = await src.fetch(ctx);
  lastFetched.set(src.name, now);
  if (data.length === 0) return { kind: "empty" };
  const { min, max } = src.observedAt(data);
  const snap: Snapshot<unknown> = {
    source: src.name,
    fetched_at: now,
    observed_at_min: min,
    observed_at_max: max,
    data,
  };
  appendSnapshot(snap);
  return { kind: "ok", count: data.length };
}

async function tick() {
  const started = new Date().toISOString();
  console.log(`[${started}] tick`);
  const now = Date.now();
  const ctx = buildContext();

  const results = await Promise.allSettled(registry.map((src) => runSource(src, ctx, now)));

  results.forEach((r, i) => {
    const name = registry[i].name;
    if (r.status === "rejected") {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      console.error(`  ${name} failed: ${msg}`);
      return;
    }
    switch (r.value.kind) {
      case "skipped":
        return;
      case "disabled":
        console.log(`  ${name}: disabled (missing env)`);
        return;
      case "empty":
        console.log(`  ${name}: 0 records`);
        return;
      case "ok": {
        const snap = latestSnapshot(name);
        console.log(`  ${name}: ${snap?.data.length ?? r.value.count} records persisted`);
        return;
      }
    }
  });

  const c = collate(now);
  if (!c) {
    console.log(`  COLLATED: no fresh sources`);
    return;
  }
  const srcList = Object.keys(c.sources).join(", ");
  console.log(`  COLLATED #${c.id}: [${srcList}] window ${c.observed_at_min}–${c.observed_at_max}`);

  const latents = deriveLatents(c, latestSnapshot);
  for (const l of latents) {
    appendLatent({
      ts: now,
      name: l.name,
      value: l.value,
      collation_id: c.id!,
      inputs: l.inputs,
      confidence: l.confidence,
    });
  }
  if (latents.length > 0) {
    console.log(`  LATENTS: ${latents.map((l) => `${l.name}=${l.value}`).join(", ")}`);
  }

  // Park Crowd-Cast — a per-place correlation over the static registry, keyed to
  // the live field (temperature from METAR). Persisted as place_signals, one row
  // per park. Runs whenever the registry is loaded; independent of source count.
  const metar = latestSnapshot("METAR");
  const temperatureF = metar ? hottestTempF(metar.data) : undefined;
  const cast = deriveParkCrowding(loadKcParks(), { now, temperatureF });
  for (const p of cast.parks) {
    appendPlaceSignal({
      ts: now,
      place_id: p.id,
      signal: "park_crowding",
      value: p.crowding,
      rank: p.rank,
      demand: p.demandMult,
      pull: p.pull,
      friction: p.friction,
      drivers: p.drivers,
      narrative: p.narrative,
      foot_traffic: p.foot_traffic,
      anomaly: p.anomaly,
      confidence: p.confidence,
    });
  }
  const top = cast.parks[0];
  console.log(`  CROWD-CAST (${cast.temperatureF}°F): #1 ${top.name} ${top.crowding} (${top.tier})`);
}

async function main() {
  await tick();
  if (config.runOnce) return;

  if (config.serve) startServer(config.port);

  console.log(`scheduling next tick every ${config.tickMs}ms`);
  setInterval(() => {
    tick().catch((err) => console.error("tick error:", err));
  }, config.tickMs);
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
