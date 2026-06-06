import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { latentsByName, latestCollation, latestLatents, latestSnapshot } from "./store";
import { knownSourceNames } from "./sources/registry";

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

  if (url.pathname === "/latents/latest") {
    const rows = latestLatents();
    return rows.length > 0 ? json(res, 200, rows) : json(res, 404, { error: "no_latents" });
  }

  if (url.pathname === "/latents") {
    const name = url.searchParams.get("name");
    if (!name) return json(res, 400, { error: "name_required" });
    const limit = Number(url.searchParams.get("limit") ?? 100);
    return json(res, 200, latentsByName(name, limit));
  }

  const snapMatch = url.pathname.match(/^\/snapshots\/([A-Z0-9_]+)$/);
  if (snapMatch) {
    const source = snapMatch[1];
    if (!knownSourceNames().includes(source)) return json(res, 404, { error: "unknown_source" });
    const snap = latestSnapshot(source);
    return snap ? json(res, 200, snap) : json(res, 404, { error: "no_snapshot" });
  }

  if (url.pathname === "/") {
    const snapshotRoutes = knownSourceNames().map((s) => `/snapshots/${s}`);
    return json(res, 200, {
      endpoints: ["/healthz", ...snapshotRoutes, "/collations/latest", "/latents/latest", "/latents?name="],
    });
  }

  json(res, 404, { error: "not_found" });
}

export function startServer(port: number) {
  const server = createServer(handle);
  server.listen(port, () => console.log(`HTTP listening on :${port}`));
  return server;
}
