"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const node_http_1 = require("node:http");
const store_1 = require("./store");
const registry_1 = require("./sources/registry");
const frontend_1 = require("./frontend");
const field_1 = require("./field");
const config_1 = require("./config");
function json(res, status, body) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}
function html(res, body) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
}
function wantsHtml(req) {
    const accept = String(req.headers.accept ?? "");
    return accept.includes("text/html") && !accept.includes("application/json");
}
function endpointIndex() {
    const snapshotRoutes = (0, registry_1.knownSourceNames)().map((s) => `/snapshots/${s}`);
    return {
        endpoints: ["/healthz", "/field/current", ...snapshotRoutes, "/collations/latest", "/latents/latest", "/latents?name="],
    };
}
function handle(req, res) {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method !== "GET")
        return json(res, 405, { error: "method_not_allowed" });
    if (url.pathname === "/healthz")
        return json(res, 200, { ok: true });
    if (url.pathname === "/field/current") {
        try {
            const location = (0, field_1.parseFieldLocation)(url.searchParams, {
                ...field_1.KC_DEFAULTS,
                lat: config_1.config.user.lat,
                lon: config_1.config.user.lon,
                radiusMiles: config_1.config.user.radiusMiles,
            });
            (0, field_1.buildTransientField)(location, process.env)
                .then((field) => json(res, 200, field))
                .catch((err) => json(res, 500, { error: err instanceof Error ? err.message : String(err) }));
            return;
        }
        catch (err) {
            return json(res, 400, { error: err instanceof Error ? err.message : "invalid_location" });
        }
    }
    if (url.pathname === "/collations/latest") {
        const c = (0, store_1.latestCollation)();
        return c ? json(res, 200, c) : json(res, 404, { error: "no_collation" });
    }
    if (url.pathname === "/latents/latest") {
        const rows = (0, store_1.latestLatents)();
        return rows.length > 0 ? json(res, 200, rows) : json(res, 404, { error: "no_latents" });
    }
    if (url.pathname === "/latents") {
        const name = url.searchParams.get("name");
        if (!name)
            return json(res, 400, { error: "name_required" });
        const limit = Number(url.searchParams.get("limit") ?? 100);
        return json(res, 200, (0, store_1.latentsByName)(name, limit));
    }
    const snapMatch = url.pathname.match(/^\/snapshots\/([A-Z0-9_]+)$/);
    if (snapMatch) {
        const source = snapMatch[1];
        if (!(0, registry_1.knownSourceNames)().includes(source))
            return json(res, 404, { error: "unknown_source" });
        const snap = (0, store_1.latestSnapshot)(source);
        return snap ? json(res, 200, snap) : json(res, 404, { error: "no_snapshot" });
    }
    if (url.pathname === "/") {
        return wantsHtml(req) ? html(res, (0, frontend_1.renderFrontendHtml)()) : json(res, 200, endpointIndex());
    }
    json(res, 404, { error: "not_found" });
}
function startServer(port) {
    const server = (0, node_http_1.createServer)(handle);
    server.listen(port, () => console.log(`HTTP listening on :${port}`));
    return server;
}
//# sourceMappingURL=server.js.map