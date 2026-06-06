import { config } from "./config";
import { Forwarder } from "./forwarder";
import { parseAixmMessage } from "./parse";
import { withinRadius } from "./filter";
import { startConsumer } from "./swim";

function log(level: "info" | "warn" | "error", msg: string, extra?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, msg, ...(extra ?? {}) };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

const forwarder = new Forwarder({
  url: config.ingest.url,
  token: config.ingest.token,
  maxRecords: config.batch.maxRecords,
  maxAgeMs: config.batch.maxAgeMs,
  onFlush: (count, ok, err) => {
    if (ok) log("info", "batch_forwarded", { count });
    else log("error", "batch_failed", { count, err });
  },
});

let processed = 0;
let kept = 0;
let dropped = 0;
let parseFailures = 0;

function handleMessage(xml: string, ack: () => void) {
  processed++;
  const rec = parseAixmMessage(xml);
  if (!rec) {
    parseFailures++;
    ack();
    return;
  }
  if (
    config.geoFilterEnabled &&
    rec.lat !== undefined &&
    rec.lon !== undefined &&
    !withinRadius(rec.lat, rec.lon, config.user.lat, config.user.lon, config.user.radiusMiles)
  ) {
    dropped++;
    ack();
    return;
  }
  kept++;
  forwarder.enqueue(rec);
  ack();
}

const stop = startConsumer({
  url: config.swim.url,
  vpn: config.swim.vpn,
  username: config.swim.username,
  password: config.swim.password,
  queue: config.swim.queue,
  onUp: () => log("info", "swim_up"),
  onDown: (reason) => log("warn", "swim_down", { reason }),
  onMessage: handleMessage,
});

const reportInterval = setInterval(() => {
  log("info", "stats", { processed, kept, dropped, parseFailures });
}, 60_000);

async function shutdown(signal: string) {
  log("info", "shutdown", { signal });
  clearInterval(reportInterval);
  try {
    await forwarder.drain();
  } catch (err) {
    log("error", "drain_failed", { err: err instanceof Error ? err.message : String(err) });
  }
  await stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

log("info", "starting", {
  queue: config.swim.queue,
  vpn: config.swim.vpn,
  geoFilter: config.geoFilterEnabled,
  center: { lat: config.user.lat, lon: config.user.lon, radiusMiles: config.user.radiusMiles },
  batch: config.batch,
});
