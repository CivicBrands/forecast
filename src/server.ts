import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { latestCollation, latestSnapshot, SourceKey } from "./store";

const KNOWN_SOURCES: SourceKey[] = ["METAR", "AIRNOW"];

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method !== "GET") return json(res, 405, { error: "method_not_allowed" });

  if (url.pathname === "/healthz") return json(res, 200, { ok: true });

  if (url.pathname === "/collations/latest") {
    const c = latestCollation();
    return c ? json(res, 200, c) : json(res, 404, { error: "no_collation" });
  }

  const snapMatch = url.pathname.match(/^\/snapshots\/([A-Z]+)$/);
  if (snapMatch) {
    const source = snapMatch[1] as SourceKey;
    if (!KNOWN_SOURCES.includes(source)) return json(res, 404, { error: "unknown_source" });
    const snap = latestSnapshot(source);
    return snap ? json(res, 200, snap) : json(res, 404, { error: "no_snapshot" });
  }

  if (url.pathname === "/") {
    return json(res, 200, {
      endpoints: ["/healthz", "/snapshots/METAR", "/snapshots/AIRNOW", "/collations/latest"],
    });
  }

  json(res, 404, { error: "not_found" });
}

export function startServer(port: number) {
  const server = createServer(handle);
  server.listen(port, () => console.log(`HTTP listening on :${port}`));
  return server;
}
