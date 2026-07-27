import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { latentsByName, latestCollation, latestLatents, latestSnapshot } from "./store";
import { knownSourceNames } from "./sources/registry";
import { renderFrontendHtml } from "./frontend";
import { buildTransientField, KC_DEFAULTS, parseFieldLocation } from "./field";
import { config } from "./config";

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function html(res: ServerResponse, body: string) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(body);
}

function wantsHtml(req: IncomingMessage): boolean {
  const accept = String(req.headers.accept ?? "");
  return !accept.includes("application/json");
}

function endpointIndex() {
  const snapshotRoutes = knownSourceNames().map((s) => `/snapshots/${s}`);
  return {
    endpoints: ["/healthz", "/field/current", ...snapshotRoutes, "/collations/latest", "/latents/latest", "/latents?name="],
  };
}

function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method !== "GET") return json(res, 405, { error: "method_not_allowed" });

  if (url.pathname === "/healthz") return json(res, 200, { ok: true });

  if (url.pathname === "/field/current") {
    try {
      const location = parseFieldLocation(url.searchParams, {
        ...KC_DEFAULTS,
        lat: config.user.lat,
        lon: config.user.lon,
        radiusMiles: config.user.radiusMiles,
      });
      buildTransientField(location, process.env)
        .then((field) => json(res, 200, field))
        .catch((err) => json(res, 500, { error: err instanceof Error ? err.message : String(err) }));
      return;
    } catch (err) {
      return json(res, 400, { error: err instanceof Error ? err.message : "invalid_location" });
    }
  }

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
    return wantsHtml(req) ? html(res, renderFrontendHtml()) : json(res, 200, endpointIndex());
  }

  json(res, 404, { error: "not_found" });
}

export function startServer(port: number) {
  const server = createServer(handle);
  server.listen(port, () => console.log(`HTTP listening on :${port}`));
  return server;
}
