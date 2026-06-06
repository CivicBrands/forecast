export function renderFrontendHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>forecast - civicbrands</title>
  <link rel="canonical" href="https://forecast.civicbrands.org/" />
  <meta name="description" content="Time-resolved, multi-source observational field generator." />
  <style>
    :root {
      color-scheme: dark;
      --bg: #101113;
      --panel: #17191c;
      --panel-2: #1d2024;
      --ink: #f1f3f4;
      --muted: #9da5ae;
      --line: #343941;
      --accent: #89c2d9;
      --ok: #82c68c;
      --warn: #e6b566;
      --bad: #df7b75;
      --shadow: rgba(0, 0, 0, 0.32);
    }

    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--ink); }
    body { font: 14px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    button, select { font: inherit; }
    button {
      border: 1px solid var(--line);
      background: var(--panel-2);
      color: var(--ink);
      height: 2.25rem;
      padding: 0 0.75rem;
      border-radius: 6px;
      cursor: pointer;
    }
    button:hover { border-color: var(--accent); }
    main { min-height: 100vh; display: grid; grid-template-columns: 17rem minmax(0, 1fr); }
    aside {
      border-right: 1px solid var(--line);
      background: #0d0e10;
      padding: 1rem;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow: auto;
      min-width: 0;
    }
    .brand { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 1.5rem; }
    h1 { font-size: 1.15rem; margin: 0; letter-spacing: 0; }
    .env { color: var(--muted); font-size: 0.78rem; }
    nav { display: grid; gap: 0.35rem; }
    nav a {
      color: var(--muted);
      text-decoration: none;
      padding: 0.45rem 0.5rem;
      border-radius: 6px;
    }
    nav a:hover { color: var(--ink); background: var(--panel); }
    .content { padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .titleblock h2 { margin: 0; font-size: 1.25rem; letter-spacing: 0; }
    .titleblock p { margin: 0.2rem 0 0; color: var(--muted); }
    .statusline { display: flex; align-items: center; gap: 0.5rem; color: var(--muted); }
    .dot { width: 0.6rem; height: 0.6rem; border-radius: 999px; background: var(--warn); }
    .dot.ok { background: var(--ok); }
    .dot.bad { background: var(--bad); }
    .toolbar { display: flex; gap: 0.5rem; align-items: center; }
    .grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 1rem; }
    section {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 8px;
      box-shadow: 0 1rem 2.5rem var(--shadow);
      min-width: 0;
    }
    .span-3 { grid-column: span 3; }
    .span-4 { grid-column: span 4; }
    .span-5 { grid-column: span 5; }
    .span-7 { grid-column: span 7; }
    .span-8 { grid-column: span 8; }
    .span-12 { grid-column: span 12; }
    .section-head {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--line);
      align-items: center;
    }
    .section-head h3 { margin: 0; font-size: 0.95rem; letter-spacing: 0; }
    .section-body { padding: 1rem; }
    .metric { display: grid; gap: 0.25rem; }
    .metric .value { font-size: 1.65rem; line-height: 1; font-weight: 650; }
    .metric .label { color: var(--muted); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; }
    .source-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(12rem, 100%), 1fr)); gap: 0.75rem; }
    .source-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0.8rem;
      background: var(--panel-2);
      min-height: 7rem;
      display: grid;
      gap: 0.5rem;
    }
    .source-title { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .source-title strong { font-size: 0.9rem; }
    .pill { border: 1px solid var(--line); border-radius: 999px; padding: 0.12rem 0.45rem; color: var(--muted); font-size: 0.72rem; }
    .pill.ok { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, var(--line)); }
    .pill.bad { color: var(--bad); border-color: color-mix(in srgb, var(--bad) 45%, var(--line)); }
    .kv { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 0.3rem 0.7rem; color: var(--muted); font-size: 0.82rem; }
    .kv b { color: var(--ink); font-weight: 550; overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.55rem 0.4rem; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { color: var(--muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; }
    td { overflow-wrap: anywhere; }
    pre {
      margin: 0;
      max-height: 24rem;
      overflow: auto;
      border-radius: 6px;
      background: #0b0c0e;
      color: #d8dde3;
      padding: 1rem;
      border: 1px solid var(--line);
      font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .muted { color: var(--muted); }
    .error { color: var(--bad); }
    .empty { color: var(--muted); padding: 1rem; border: 1px dashed var(--line); border-radius: 8px; }

    @media (max-width: 900px) {
      main { grid-template-columns: 1fr; }
      aside { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--line); }
      nav { display: flex; flex-wrap: wrap; }
      .span-3, .span-4, .span-5, .span-7, .span-8 { grid-column: span 12; }
    }
  </style>
</head>
<body>
  <main>
    <aside>
      <div class="brand">
        <h1>forecast</h1>
        <div class="env">live</div>
      </div>
      <nav>
        <a href="#overview">Overview</a>
        <a href="#sources">Sources</a>
        <a href="#latents">Latents</a>
        <a href="#raw">Raw</a>
      </nav>
    </aside>

    <div class="content">
      <div class="topbar">
        <div class="titleblock">
          <h2>Observational Field</h2>
          <p id="summary">Loading latest field state...</p>
        </div>
        <div class="toolbar">
          <div class="statusline"><span id="health-dot" class="dot"></span><span id="health-text">checking</span></div>
          <button id="refresh" type="button" title="Refresh">Refresh</button>
        </div>
      </div>

      <div id="overview" class="grid">
        <section class="span-3">
          <div class="section-head"><h3>Sources</h3></div>
          <div class="section-body metric"><div id="metric-sources" class="value">-</div><div class="label">fresh in collation</div></div>
        </section>
        <section class="span-3">
          <div class="section-head"><h3>Records</h3></div>
          <div class="section-body metric"><div id="metric-records" class="value">-</div><div class="label">fresh records</div></div>
        </section>
        <section class="span-3">
          <div class="section-head"><h3>Latents</h3></div>
          <div class="section-body metric"><div id="metric-latents" class="value">-</div><div class="label">latest rows</div></div>
        </section>
        <section class="span-3">
          <div class="section-head"><h3>Window</h3></div>
          <div class="section-body metric"><div id="metric-window" class="value">-</div><div class="label">observed span</div></div>
        </section>
      </div>

      <section id="sources" class="span-12">
        <div class="section-head"><h3>Source Registry</h3><span id="source-count" class="pill">-</span></div>
        <div class="section-body"><div id="sources-grid" class="source-grid"></div></div>
      </section>

      <div class="grid">
        <section class="span-7">
          <div class="section-head"><h3>Latest Collation</h3><span id="collation-id" class="pill">-</span></div>
          <div class="section-body" id="collation-body"></div>
        </section>
        <section id="latents" class="span-5">
          <div class="section-head"><h3>Latest Latents</h3><span id="latent-status" class="pill">-</span></div>
          <div class="section-body" id="latents-body"></div>
        </section>
      </div>

      <section id="raw" class="span-12">
        <div class="section-head"><h3>Raw Payload</h3><span id="raw-label" class="pill">collation</span></div>
        <div class="section-body"><pre id="raw-json">{}</pre></div>
      </section>
    </div>
  </main>

  <script>
    const state = { endpoints: [], collation: null, latents: [], snapshots: new Map(), errors: new Map() };
    const sourceMeta = {
      METAR: "Aviation weather",
      AIRNOW: "Air quality",
      FIRMS: "Fire detections",
      HRRR_SMOKE: "Smoke model",
      NEXRAD: "Radar metadata",
      NLDN: "Lightning detections",
      NOTAM: "Airspace notices"
    };

    const el = (id) => document.getElementById(id);
    const fmtCount = (n) => Number.isFinite(n) ? String(n) : "-";
    const fmtDateMs = (n) => Number.isFinite(n) ? new Date(n).toLocaleString() : "-";
    const fmtDateSec = (n) => Number.isFinite(n) ? new Date(n * 1000).toLocaleString() : "-";
    const fmtSpan = (min, max) => {
      if (!Number.isFinite(min) || !Number.isFinite(max)) return "-";
      const minutes = Math.max(0, Math.round((max - min) / 60));
      if (minutes < 60) return minutes + "m";
      return Math.round(minutes / 60) + "h";
    };

    async function getJson(path) {
      const res = await fetch(path, { headers: { "Accept": "application/json" } });
      const text = await res.text();
      const body = text ? JSON.parse(text) : null;
      if (!res.ok) {
        const err = new Error(body && body.error ? body.error : res.statusText);
        err.status = res.status;
        err.body = body;
        throw err;
      }
      return body;
    }

    function endpointSources(endpoints) {
      return endpoints
        .filter((p) => p.startsWith("/snapshots/"))
        .map((p) => p.replace("/snapshots/", ""));
    }

    async function load() {
      el("health-text").textContent = "checking";
      el("health-dot").className = "dot";
      state.errors.clear();

      try {
        await getJson("/healthz");
        el("health-text").textContent = "online";
        el("health-dot").className = "dot ok";
      } catch (err) {
        el("health-text").textContent = "offline";
        el("health-dot").className = "dot bad";
      }

      const root = await getJson("/");
      state.endpoints = root.endpoints || [];
      const sources = endpointSources(state.endpoints);

      const [collationResult, latentResult] = await Promise.allSettled([
        getJson("/collations/latest"),
        getJson("/latents/latest")
      ]);
      state.collation = collationResult.status === "fulfilled" ? collationResult.value : null;
      state.latents = latentResult.status === "fulfilled" ? latentResult.value : [];
      if (collationResult.status === "rejected") state.errors.set("collation", collationResult.reason);
      if (latentResult.status === "rejected") state.errors.set("latents", latentResult.reason);

      const snapshotResults = await Promise.allSettled(sources.map((source) => getJson("/snapshots/" + source)));
      state.snapshots.clear();
      snapshotResults.forEach((result, i) => {
        const source = sources[i];
        if (result.status === "fulfilled") state.snapshots.set(source, result.value);
        else state.errors.set(source, result.reason);
      });

      render(sources);
    }

    function render(sources) {
      const collationSources = state.collation ? Object.entries(state.collation.sources || {}) : [];
      const recordCount = collationSources.reduce((sum, [, s]) => sum + (s.record_count || 0), 0);
      el("metric-sources").textContent = fmtCount(collationSources.length);
      el("metric-records").textContent = fmtCount(recordCount);
      el("metric-latents").textContent = fmtCount(state.latents.length);
      el("metric-window").textContent = state.collation ? fmtSpan(state.collation.observed_at_min, state.collation.observed_at_max) : "-";
      el("summary").textContent = state.collation
        ? "Collated " + collationSources.length + " source(s) at " + fmtDateMs(state.collation.collated_at) + "."
        : "No current collation is available.";
      el("source-count").textContent = sources.length + " known";
      el("collation-id").textContent = state.collation && state.collation.id ? "#" + state.collation.id : "-";
      el("latent-status").textContent = state.latents.length ? state.latents.length + " rows" : "empty";

      renderSources(sources);
      renderCollation();
      renderLatents();
      el("raw-json").textContent = JSON.stringify({
        collation: state.collation,
        latents: state.latents,
        snapshots: Object.fromEntries(state.snapshots)
      }, null, 2);
    }

    function renderSources(sources) {
      const grid = el("sources-grid");
      grid.innerHTML = "";
      for (const source of sources) {
        const snap = state.snapshots.get(source);
        const err = state.errors.get(source);
        const fresh = Boolean(state.collation && state.collation.sources && state.collation.sources[source]);
        const card = document.createElement("div");
        card.className = "source-card";
        card.innerHTML = \`
          <div class="source-title">
            <strong>\${source}</strong>
            <span class="pill \${fresh ? "ok" : err ? "bad" : ""}">\${fresh ? "fresh" : err ? err.message : "stored"}</span>
          </div>
          <div class="muted">\${sourceMeta[source] || "Registered source"}</div>
          <div class="kv">
            <span>records</span><b>\${snap ? snap.data.length : "-"}</b>
            <span>fetched</span><b>\${snap ? fmtDateMs(snap.fetched_at) : "-"}</b>
            <span>observed</span><b>\${snap ? fmtDateSec(snap.observed_at_max) : "-"}</b>
          </div>\`;
        grid.appendChild(card);
      }
    }

    function renderCollation() {
      const body = el("collation-body");
      if (!state.collation) {
        const err = state.errors.get("collation");
        body.innerHTML = \`<div class="empty">\${err ? err.message : "No collation"}</div>\`;
        return;
      }
      const rows = Object.entries(state.collation.sources || {}).map(([name, s]) =>
        \`<tr><td>\${name}</td><td>\${s.record_count}</td><td>\${fmtDateMs(s.fetched_at)}</td><td>#\${s.snapshot_id}</td></tr>\`
      ).join("");
      body.innerHTML = \`
        <div class="kv" style="margin-bottom: 0.8rem">
          <span>collated</span><b>\${fmtDateMs(state.collation.collated_at)}</b>
          <span>observed min</span><b>\${fmtDateSec(state.collation.observed_at_min)}</b>
          <span>observed max</span><b>\${fmtDateSec(state.collation.observed_at_max)}</b>
        </div>
        <table><thead><tr><th>Source</th><th>Records</th><th>Fetched</th><th>Snapshot</th></tr></thead><tbody>\${rows}</tbody></table>\`;
    }

    function renderLatents() {
      const body = el("latents-body");
      if (!state.latents.length) {
        const err = state.errors.get("latents");
        body.innerHTML = \`<div class="empty">\${err ? err.message : "No latents"}</div>\`;
        return;
      }
      body.innerHTML = \`<table><thead><tr><th>Name</th><th>Value</th><th>Confidence</th></tr></thead><tbody>\${state.latents.map((l) =>
        \`<tr><td>\${l.name}</td><td>\${l.value}</td><td>\${l.confidence ?? "-"}</td></tr>\`
      ).join("")}</tbody></table>\`;
    }

    el("refresh").addEventListener("click", () => load().catch(showFatal));
    function showFatal(err) {
      el("summary").textContent = err.message || String(err);
      el("health-dot").className = "dot bad";
      el("health-text").textContent = "error";
    }
    load().catch(showFatal);
  </script>
</body>
</html>`;
}
