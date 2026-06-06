"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const node_http_1 = require("node:http");
const store_1 = require("./store");
const KNOWN_SOURCES = ["METAR", "AIRNOW"];
function json(res, status, body) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}
function handle(req, res) {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method !== "GET")
        return json(res, 405, { error: "method_not_allowed" });
    if (url.pathname === "/healthz")
        return json(res, 200, { ok: true });
    if (url.pathname === "/collations/latest") {
        const c = (0, store_1.latestCollation)();
        return c ? json(res, 200, c) : json(res, 404, { error: "no_collation" });
    }
    const snapMatch = url.pathname.match(/^\/snapshots\/([A-Z]+)$/);
    if (snapMatch) {
        const source = snapMatch[1];
        if (!KNOWN_SOURCES.includes(source))
            return json(res, 404, { error: "unknown_source" });
        const snap = (0, store_1.latestSnapshot)(source);
        return snap ? json(res, 200, snap) : json(res, 404, { error: "no_snapshot" });
    }
    if (url.pathname === "/") {
        return json(res, 200, {
            endpoints: ["/healthz", "/snapshots/METAR", "/snapshots/AIRNOW", "/collations/latest"],
        });
    }
    json(res, 404, { error: "not_found" });
}
function startServer(port) {
    const server = (0, node_http_1.createServer)(handle);
    server.listen(port, () => console.log(`HTTP listening on :${port}`));
    return server;
}
//# sourceMappingURL=server.js.map