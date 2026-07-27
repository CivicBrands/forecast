export function renderFrontendHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>forecast - civicbrands</title>
  <link rel="canonical" href="https://forecast.civicbrands.org/" />
  <meta name="description" content="A live, multi-source picture of observed conditions and relationships around Kansas City." />
  <style>
    :root {
      color-scheme: dark;
      --civic-ink: #0f1a2c;
      --iris: #6a5a95;
      --iris-deep: #463a6b;
      --signal: #c9482f;
      --steel: #7a8aa3;
      --vellum: #e5ddc9;
      --newsprint: #f2ede2;
      --bg: var(--civic-ink);
      --panel: #152238;
      --panel-2: #192943;
      --ink: var(--newsprint);
      --muted: #aab5c7;
      --line: #34445e;
      --accent: #9f8ed0;
      --ok: #7fd09c;
      --warn: #d5aa68;
      --bad: #e26b55;
      --shadow: rgba(4, 9, 18, 0.28);
      --display: Sora, Avenir, "Avenir Next", ui-sans-serif, system-ui, sans-serif;
      --body: Spectral, Georgia, "Times New Roman", serif;
      --mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
    }

    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--ink); }
    body {
      font: 16px/1.55 var(--body);
      background:
        linear-gradient(90deg, rgba(106, 90, 149, 0.08), transparent 24rem),
        var(--bg);
    }
    a { color: inherit; }
    button, select { font: 600 0.78rem/1 var(--display); }
    button {
      border: 1px solid var(--line);
      background: var(--panel-2);
      color: var(--ink);
      min-height: 2.65rem;
      padding: 0.7rem 0.9rem;
      border-radius: 2px;
      cursor: pointer;
    }
    button:hover, button:focus-visible { border-color: var(--accent); background: var(--iris-deep); }
    :focus-visible { outline: 2px solid var(--newsprint); outline-offset: 3px; }
    .skip-link {
      position: absolute;
      left: 1rem;
      top: -5rem;
      z-index: 20;
      padding: 0.7rem 1rem;
      background: var(--newsprint);
      color: var(--civic-ink);
      font: 600 0.8rem/1 var(--display);
    }
    .skip-link:focus { top: 1rem; }
    .site-header {
      border-bottom: 1px solid var(--line);
      background: rgba(15, 26, 44, 0.96);
      position: sticky;
      top: 0;
      z-index: 10;
      backdrop-filter: blur(10px);
    }
    .header-inner, .page, .site-footer {
      width: min(100% - 3rem, 90rem);
      margin-inline: auto;
    }
    .header-inner {
      min-height: 4.5rem;
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }
    .civic-wordmark {
      display: inline-flex;
      align-items: center;
      gap: 0.28rem;
      color: var(--newsprint);
      font: 600 0.92rem/1 var(--display);
      letter-spacing: -0.035em;
      text-decoration: none;
      white-space: nowrap;
    }
    .civic-wordmark span { color: var(--signal); font-size: 0.72em; }
    .division {
      color: var(--steel);
      border-left: 1px solid var(--line);
      padding-left: 1.25rem;
      font: 400 0.72rem/1 var(--mono);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    nav {
      margin-left: auto;
      display: flex;
      align-items: stretch;
      gap: 0.15rem;
      font: 500 0.76rem/1 var(--display);
    }
    nav a {
      color: var(--muted);
      display: flex;
      align-items: center;
      min-height: 4.5rem;
      padding: 0 0.7rem;
      text-decoration: none;
      border-bottom: 2px solid transparent;
      white-space: nowrap;
    }
    nav a:hover, nav a:focus-visible { color: var(--ink); border-bottom-color: var(--iris); }
    nav .crowdcast-nav { color: var(--newsprint); margin-left: 0.25rem; border-bottom-color: var(--signal); }
    .page { padding: 4.5rem 0 5rem; }
    .intro {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(20rem, 0.8fr);
      gap: clamp(2rem, 6vw, 6rem);
      align-items: start;
      margin-bottom: 2.25rem;
    }
    h1, h2, h3, h4 { font-family: var(--display); }
    h1 {
      max-width: 17ch;
      margin: 0;
      font-size: clamp(2.6rem, 5vw, 4.9rem);
      line-height: 1.04;
      letter-spacing: -0.045em;
      font-weight: 600;
    }
    .intro-copy > p {
      max-width: 62ch;
      margin: 1.5rem 0 0;
      color: #c9d1dc;
      font-size: clamp(1.05rem, 1.5vw, 1.25rem);
      line-height: 1.55;
    }
    .field-summary {
      margin-top: 1.6rem;
      padding-left: 1rem;
      border-left: 2px solid var(--iris);
      color: var(--vellum);
      font: 400 0.78rem/1.55 var(--mono);
    }
    .field-summary.watch, .field-summary.alert {
      padding: 0.85rem 1rem;
      background: rgba(201, 72, 47, 0.1);
    }
    .field-summary.watch { border-left-color: var(--warn); }
    .field-summary.alert { border-left-color: var(--signal); color: var(--newsprint); }
    .crowdcast-feature {
      display: block;
      padding: clamp(1.5rem, 3vw, 2.4rem);
      border: 1px solid var(--iris);
      border-top: 3px solid var(--signal);
      background: rgba(70, 58, 107, 0.24);
      text-decoration: none;
      box-shadow: 0 1.5rem 4rem var(--shadow);
    }
    .crowdcast-feature:hover { border-color: var(--newsprint); background: rgba(70, 58, 107, 0.4); }
    .crowdcast-feature h2 { margin: 0; font-size: clamp(1.45rem, 2.5vw, 2rem); font-weight: 500; }
    .crowdcast-feature p { color: #c9d1dc; margin: 1rem 0 1.5rem; }
    .text-link {
      color: var(--newsprint);
      font: 600 0.82rem/1.2 var(--display);
    }
    .pathways {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1px;
      margin: 0 0 2.25rem;
      border: 1px solid var(--line);
      background: var(--line);
    }
    .pathway {
      min-height: 8.5rem;
      padding: 1.1rem;
      background: var(--civic-ink);
      text-decoration: none;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: space-between;
      gap: 1.25rem;
      border-bottom: 0;
      white-space: normal;
      min-width: 0;
    }
    .pathway:hover { background: var(--iris-deep); }
    .pathway strong { font: 500 0.9rem/1.35 var(--display); }
    .pathway span { color: var(--muted); }
    .pathway small { color: var(--steel); font: 400 0.62rem/1.4 var(--mono); text-transform: uppercase; letter-spacing: 0.08em; }
    .control-strip {
      display: flex;
      align-items: stretch;
      border: 1px solid var(--line);
      background: var(--panel);
      margin-bottom: 1.25rem;
      min-width: 0;
    }
    .statusline, .locationbar, .refresh-wrap {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.75rem 1rem;
      min-width: 0;
    }
    .statusline { color: var(--muted); font: 400 0.72rem/1 var(--mono); }
    .locationbar { flex: 1; border-left: 1px solid var(--line); }
    .refresh-wrap { border-left: 1px solid var(--line); }
    .dot { width: 0.6rem; height: 0.6rem; border-radius: 999px; background: var(--warn); }
    .dot.ok { background: var(--ok); }
    .dot.bad { background: var(--bad); }
    .location-name { color: var(--ink); font: 500 0.82rem/1.2 var(--display); margin-right: auto; }
    .location-details {
      margin: -0.35rem 0 1.75rem;
      color: var(--muted);
      font-size: 0.9rem;
    }
    .location-details summary { cursor: pointer; font: 400 0.68rem/1.4 var(--mono); }
    .privacy-note { max-width: 78ch; margin: 0.8rem 0 0; }
    .metric-rail {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      border: 1px solid var(--line);
      background: rgba(21, 34, 56, 0.6);
      margin-bottom: 5rem;
    }
    .resource-guide {
      margin: -2.75rem 0 5rem;
      padding: clamp(1.25rem, 3vw, 2rem);
      border: 1px solid var(--signal);
      border-left-width: 4px;
      background: rgba(201, 72, 47, 0.1);
    }
    .resource-guide[hidden] { display: none; }
    .resource-guide h2 { margin: 0; font-size: clamp(1.35rem, 2.5vw, 1.85rem); font-weight: 500; }
    .resource-guide p { max-width: 72ch; margin: 0.7rem 0 0; }
    .resource-guide .official-instruction { color: var(--vellum); }
    .resource-links {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: 1px;
      margin-top: 1.35rem;
      background: var(--line);
      border: 1px solid var(--line);
    }
    .resource-links a {
      padding: 0.9rem 1rem;
      background: var(--civic-ink);
      color: var(--newsprint);
      font: 500 0.76rem/1.35 var(--display);
      text-decoration: none;
    }
    .resource-links a:hover { background: var(--iris-deep); }
    .metric {
      padding: 1.2rem 1.35rem;
      min-width: 0;
    }
    .metric + .metric { border-left: 1px solid var(--line); }
    .metric .value { margin-top: 0.55rem; font: 600 1.9rem/1 var(--display); }
    .metric .label {
      color: var(--steel);
      font: 400 0.64rem/1.3 var(--mono);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .content-section {
      margin: 0 0 4.75rem;
      scroll-margin-top: 6rem;
    }
    .section-head {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 1.5rem;
      margin-bottom: 1.15rem;
    }
    .section-head h2, .section-head h3 { margin: 0; font-size: clamp(1.55rem, 2.5vw, 2.15rem); font-weight: 500; }
    .section-head p { max-width: 60ch; margin: 0.45rem 0 0; color: var(--muted); }
    .section-body {
      border: 1px solid var(--line);
      background: var(--panel);
      min-width: 0;
      overflow: hidden;
    }
    .source-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr));
      min-width: 0;
    }
    .latent-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(22rem, 100%), 1fr)); }
    .engine-stack { display: grid; }
    .engine-group + .engine-group { border-top: 1px solid var(--line); }
    .engine-group-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.85rem 1.25rem;
      background: rgba(15, 26, 44, 0.55);
    }
    .engine-group-head h3 { margin: 0; font: 500 0.82rem/1.3 var(--display); text-transform: capitalize; }
    .engine-group-head span { color: var(--steel); font: 400 0.61rem/1.3 var(--mono); }
    .source-card {
      border-right: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      padding: 1.1rem;
      min-height: 8.5rem;
      display: grid;
      gap: 0.5rem;
    }
    .latent-card {
      border-right: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      background: rgba(25, 41, 67, 0.72);
      padding: 1.25rem;
      display: grid;
      gap: 0.65rem;
      min-width: 0;
    }
    .latent-card.alert { box-shadow: inset 3px 0 var(--signal); }
    .latent-card.watch { box-shadow: inset 3px 0 var(--warn); }
    .latent-top { display: flex; justify-content: space-between; align-items: start; gap: 0.75rem; }
    .latent-title { display: grid; gap: 0.15rem; min-width: 0; }
    .latent-title strong { font: 500 0.95rem/1.3 var(--display); }
    .latent-title span { color: var(--muted); font: 400 0.64rem/1.4 var(--mono); text-transform: uppercase; letter-spacing: 0.07em; }
    .latent-value { font: 600 1.7rem/1 var(--display); white-space: nowrap; }
    .latent-summary { color: var(--ink); }
    .latent-meta { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .source-title { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .source-title strong { font: 500 0.9rem/1.3 var(--display); }
    .source-attribution { color: var(--accent); font: 400 0.68rem/1.4 var(--mono); text-underline-offset: 0.2em; }
    .pill { border: 1px solid var(--line); padding: 0.18rem 0.42rem; color: var(--muted); font: 400 0.63rem/1.2 var(--mono); }
    .pill.ok { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, var(--line)); }
    .pill.watch { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 45%, var(--line)); }
    .pill.bad { color: var(--bad); border-color: color-mix(in srgb, var(--bad) 45%, var(--line)); }
    .kv { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 0.3rem 0.7rem; color: var(--muted); font: 400 0.72rem/1.5 var(--mono); }
    .kv b { color: var(--ink); font-weight: 400; overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.8rem 1rem; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { color: var(--muted); font: 400 0.64rem/1.4 var(--mono); text-transform: uppercase; letter-spacing: 0.07em; }
    td { overflow-wrap: anywhere; }
    pre {
      margin: 0;
      max-height: 24rem;
      overflow: auto;
      background: #0a1220;
      color: #d6ddea;
      padding: 1rem;
      font: 12px/1.5 var(--mono);
    }
    .muted { color: var(--muted); }
    .error { color: var(--bad); }
    .empty { color: var(--muted); padding: 1rem; border: 1px dashed var(--line); }
    .technical-details {
      border: 1px solid var(--line);
      background: rgba(21, 34, 56, 0.5);
      scroll-margin-top: 6rem;
    }
    .technical-details > summary {
      cursor: pointer;
      padding: 1.25rem;
      font: 500 1.1rem/1.2 var(--display);
      list-style-position: inside;
    }
    .technical-stack { border-top: 1px solid var(--line); }
    .technical-stack .content-section { margin: 0; padding: 1.25rem; }
    .technical-stack .content-section + .content-section { border-top: 1px solid var(--line); }
    .technical-stack .section-head h3 { font-size: 1.15rem; }
    .site-footer {
      padding: 2rem 0 3.5rem;
      border-top: 1px solid var(--line);
      color: var(--muted);
    }
    .footer-top, .footer-links {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .footer-top { justify-content: space-between; margin-bottom: 1.4rem; }
    .footer-note { max-width: 55ch; margin: 0; }
    .footer-links { font: 400 0.68rem/1.5 var(--mono); }
    .footer-links a { text-underline-offset: 0.22em; }
    .footer-meta { margin: 1.2rem 0 0; font: 400 0.62rem/1.5 var(--mono); }

    @media (max-width: 1060px) {
      .header-inner { flex-wrap: wrap; padding: 0.85rem 0; }
      nav { width: 100%; margin-left: 0; overflow-x: auto; }
      nav a { min-height: 2.5rem; }
      nav .crowdcast-nav { margin-left: auto; }
      .intro { grid-template-columns: 1fr; }
      .crowdcast-feature { max-width: 48rem; }
      .pathways { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 720px) {
      .header-inner, .page, .site-footer { width: min(100% - 2rem, 90rem); }
      .page { padding-top: 3rem; }
      .division { margin-right: auto; }
      nav { flex-wrap: wrap; overflow: visible; }
      nav a { min-height: 2.15rem; padding-inline: 0.55rem; }
      nav .crowdcast-nav { margin-left: 0; }
      h1 { font-size: clamp(2.45rem, 13vw, 3.6rem); }
      .control-strip { display: grid; }
      .locationbar, .refresh-wrap { border-left: 0; border-top: 1px solid var(--line); }
      .locationbar { flex-wrap: wrap; }
      .metric-rail { grid-template-columns: repeat(2, 1fr); margin-bottom: 3.5rem; }
      .pathways { grid-template-columns: 1fr; }
      .metric:nth-child(3) { border-left: 0; border-top: 1px solid var(--line); }
      .metric:nth-child(4) { border-top: 1px solid var(--line); }
      .content-section { margin-bottom: 3.5rem; }
      .section-head { align-items: start; flex-direction: column; }
      .section-body { overflow-x: auto; }
      table { min-width: 42rem; }
      .footer-top { align-items: start; flex-direction: column; }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <header class="site-header">
    <div class="header-inner">
      <a class="civic-wordmark" href="https://civicbrands.org/" aria-label="CivicBrands home">Civic <span>◆</span> Brands</a>
      <div class="division">Forecast</div>
      <nav aria-label="Forecast">
        <a href="#now">Now</a>
        <a href="#latents">What the field sees</a>
        <a href="#sources">Sources</a>
        <a href="#technical">Technical</a>
        <a href="https://civicbrands.org/kc/crisis">KC help</a>
        <a class="crowdcast-nav" href="/crowdcast">Park Crowd-Cast&nbsp; →</a>
      </nav>
    </div>
  </header>

  <main id="main-content" class="page">
    <section id="now" class="intro" aria-labelledby="page-title">
      <div class="intro-copy">
        <h1 id="page-title">What is happening around Kansas City right now?</h1>
        <p>Forecast brings weather, air quality, smoke, lightning, airspace notices, and local context into one live picture. It reports observed conditions and relationships—not a conventional weather prediction.</p>
        <div id="summary" class="field-summary">Loading the latest field state...</div>
      </div>
      <a class="crowdcast-feature" href="/crowdcast">
        <h2>Choosing a park?</h2>
        <p>See where park demand is likely to concentrate from heat, shade, water, access, and the live field. It is a relative forecast, not a headcount.</p>
        <span class="text-link">Open Park Crowd-Cast&nbsp; →</span>
      </a>
    </section>

    <nav class="pathways" aria-label="Choose a Forecast pathway">
      <a class="pathway" href="/crowdcast">
        <small>Park information</small>
        <strong>Where are park crowds likely to concentrate?</strong>
        <span>Open Crowd-Cast&nbsp; →</span>
      </a>
      <a class="pathway" href="#latents">
        <small>KC factors</small>
        <strong>What relationships are the inference engines finding?</strong>
        <span>Read the signals&nbsp; ↓</span>
      </a>
      <a class="pathway" href="#sources">
        <small>Source attribution</small>
        <strong>Which public systems produced these readings?</strong>
        <span>Inspect provenance&nbsp; ↓</span>
      </a>
      <a class="pathway" href="#technical">
        <small>Raw data access</small>
        <strong>Need the collation, payload, or API endpoints?</strong>
        <span>Open technical access&nbsp; ↓</span>
      </a>
    </nav>

    <div class="control-strip" aria-label="Field controls">
      <div class="statusline"><span id="health-dot" class="dot"></span><span id="health-text">checking</span></div>
      <div class="locationbar">
        <span id="location-label" class="location-name">Kansas City area</span>
        <button id="use-location" type="button" title="Use browser location">Use my location</button>
        <button id="reset-location" type="button" title="Reset to Kansas City">Kansas City</button>
      </div>
      <div class="refresh-wrap"><button id="refresh" type="button" title="Refresh">Refresh</button></div>
    </div>

    <details class="location-details">
      <summary>Location details &amp; privacy</summary>
      <div id="location-details">Default Kansas City area, 30 mile radius.</div>
      <p class="privacy-note">
        <b>Your location is not stored.</b> &ldquo;Use my location&rdquo; asks your browser
        for coordinates and sends them with a single request, only to choose which weather
        stations, air-quality monitors and parks to read. They build that one response and
        are then discarded &mdash; not written to the database, not logged, not attached to
        any identifier, and never shared. Nothing is kept that could reconstruct where you
        were. Declining the prompt keeps the default Kansas City view, and the
        <em>Kansas City</em> button clears it at any time.
      </p>
    </details>

    <div id="overview" class="metric-rail" aria-label="Current field summary">
      <div class="metric"><div class="label">Sources</div><div id="metric-sources" class="value">—</div></div>
      <div class="metric"><div class="label">Records</div><div id="metric-records" class="value">—</div></div>
      <div class="metric"><div class="label">Signals</div><div id="metric-latents" class="value">—</div></div>
      <div class="metric"><div class="label">Observed window</div><div id="metric-window" class="value">—</div></div>
    </div>

    <section id="weather-help" class="resource-guide" aria-live="polite" hidden>
      <h2 id="weather-help-title">Weather resources</h2>
      <p id="weather-help-summary"></p>
      <p id="weather-help-instruction" class="official-instruction"></p>
      <div class="resource-links">
        <a href="https://civicbrands.org/kc/crisis">Need help now&nbsp; →</a>
        <a href="https://civicbrands.org/kc/libraries">Indoor public places&nbsp; →</a>
        <a href="https://civicbrands.org/kc/transit">Plan a ride&nbsp; →</a>
        <a href="https://civicbrands.org/kc/utilities">Utility assistance&nbsp; →</a>
        <a href="https://civicbrands.org/kc/housing">Shelter and housing&nbsp; →</a>
        <a href="https://civicbrands.org/kc/healthcare">Medical care&nbsp; →</a>
      </div>
    </section>

    <section id="latents" class="content-section">
      <div class="section-head">
        <div><h2>What the field is noticing</h2><p>Each inference engine reads one part of the Kansas City field. Engines are grouped by family, so new forms of inference can join this page without changing how it is read.</p></div>
        <span id="latent-status" class="pill">—</span>
      </div>
      <div class="section-body" id="latents-body"></div>
    </section>

    <section id="observed" class="content-section">
      <div class="section-head">
        <div><h2>What was observed</h2><p>Decoded measurements and notices from the current field, in plain language.</p></div>
        <span id="observed-count" class="pill">—</span>
      </div>
      <div class="section-body" id="observed-body"></div>
    </section>

    <section id="sources" class="content-section">
      <div class="section-head">
        <div><h2>Where the readings came from</h2><p>The source registry shows which systems contributed to this view and how fresh their readings are.</p></div>
        <span id="source-count" class="pill">—</span>
      </div>
      <div class="section-body"><div id="sources-grid" class="source-grid"></div></div>
    </section>

    <details id="technical" class="technical-details">
      <summary>Technical details</summary>
      <div class="technical-stack">
        <section class="content-section">
          <div class="section-head"><h3>Latest collation</h3><span id="collation-id" class="pill">—</span></div>
          <div class="section-body" id="collation-body"></div>
        </section>
        <section id="raw" class="content-section">
          <div class="section-head"><h3>Raw payload</h3><span id="raw-label" class="pill">collation</span></div>
          <div class="section-body"><pre id="raw-json">{}</pre></div>
        </section>
      </div>
    </details>
  </main>

  <footer class="site-footer">
    <div class="footer-top">
      <a class="civic-wordmark" href="https://civicbrands.org/">Civic <span>◆</span> Brands</a>
      <p class="footer-note">Forecast is observational infrastructure for the Kansas City metro. Data is observational, not predictive.</p>
    </div>
    <div class="footer-links" aria-label="CivicBrands">
      <a href="https://civicbrands.org/">CivicBrands</a>
      <a href="https://civicbrands.org/kc/crisis">Need help now</a>
      <a href="https://civicbrands.org/kc/">KC resources</a>
      <a href="/crowdcast">Park Crowd-Cast</a>
      <a href="https://civicbrands.org/systems/">Systems</a>
      <a href="https://civicbrands.org/updates/">Updates</a>
      <a href="https://civicbrands.org/status/">Status</a>
      <a href="https://civicbrands.org/brand">Brand</a>
      <a href="https://civicbrands.org/privacy/">Privacy</a>
      <a href="https://civicbrands.org/terms/">Terms</a>
    </div>
    <p class="footer-meta">© 2026 CivicBrands · For the Commons · EIN 39-2829761</p>
  </footer>

  <script>
    const state = {
      endpoints: [],
      field: null,
      collation: null,
      latents: [],
      observations: [],
      snapshots: new Map(),
      sourceResults: new Map(),
      errors: new Map(),
      locationMode: "default",
      browserLocation: null
    };
    const sourceMeta = {
      METAR: "Aviation weather",
      AIRNOW: "Air quality",
      FIRMS: "Fire detections",
      HRRR_SMOKE: "Smoke model",
      NEXRAD: "Radar metadata",
      NLDN: "Lightning detections",
      NWS_ALERTS: "Official weather alerts",
      NOTAM: "Airspace notices"
    };
    const sourceLinks = {
      METAR: "https://aviationweather.gov/data/api/",
      AIRNOW: "https://www.airnow.gov/",
      FIRMS: "https://firms.modaps.eosdis.nasa.gov/",
      HRRR_SMOKE: "https://rapidrefresh.noaa.gov/hrrr/",
      NEXRAD: "https://www.ncei.noaa.gov/products/radar",
      NLDN: "https://www.vaisala.com/en/products/national-lightning-detection-network-nldn",
      EVENTS: "https://www.predicthq.com/",
      NWS_ALERTS: "https://www.weather.gov/eax/",
      NOTAM: "https://www.faa.gov/air_traffic/flight_info/aeronav/notams"
    };

    const el = (id) => document.getElementById(id);
    const fmtCount = (n) => Number.isFinite(n) ? String(n) : "-";
    const fmtDateMs = (n) => Number.isFinite(n) ? new Date(n).toLocaleString() : "-";
    const fmtDateSec = (n) => Number.isFinite(n) ? new Date(n * 1000).toLocaleString() : "-";
    const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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

    function fieldPath() {
      if (!state.browserLocation) return "/field/current";
      const p = new URLSearchParams({
        lat: String(state.browserLocation.lat),
        lon: String(state.browserLocation.lon),
        radius: String(state.browserLocation.radiusMiles || 30),
        location_source: "browser"
      });
      return "/field/current?" + p.toString();
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

      const [root, field] = await Promise.all([getJson("/"), getJson(fieldPath())]);
      state.endpoints = root.endpoints || [];
      state.field = field;
      state.collation = field.collation;
      state.latents = field.latents || [];
      state.observations = field.observations || [];
      state.snapshots = new Map(Object.entries(field.snapshots || {}));
      state.sourceResults = new Map((field.sources || []).map((s) => [s.name, s]));

      render(endpointSources(state.endpoints));
    }

    function render(sources) {
      const collationSources = state.collation ? Object.entries(state.collation.sources || {}) : [];
      const recordCount = collationSources.reduce((sum, [, s]) => sum + (s.record_count || 0), 0);
      el("metric-sources").textContent = fmtCount(collationSources.length);
      el("metric-records").textContent = fmtCount(recordCount);
      el("metric-latents").textContent = fmtCount(state.latents.length);
      el("metric-window").textContent = state.collation ? fmtSpan(state.collation.observed_at_min, state.collation.observed_at_max) : "-";
      const lead = leadLatent();
      el("summary").className = "field-summary" + (lead && lead.severity !== "ok" ? " " + lead.severity : "");
      el("summary").textContent = lead
        ? (String(lead.summary).startsWith(String(lead.label)) ? lead.summary : lead.label + ": " + lead.summary)
        : state.collation
          ? "Collated " + collationSources.length + " source(s) at " + fmtDateMs(state.collation.collated_at) + "."
          : "No current collation is available.";
      el("source-count").textContent = sources.length + " known";
      el("collation-id").textContent = state.collation && state.collation.id ? "#" + state.collation.id : "-";
      el("latent-status").textContent = state.latents.length ? state.latents.length + " rows" : "empty";
      el("observed-count").textContent = state.observations.length ? state.observations.length + " items" : "empty";
      renderLocation();
      renderWeatherHelp();

      renderSources(sources);
      renderObserved();
      renderCollation();
      renderLatents();
      el("raw-json").textContent = JSON.stringify({
        field: state.field,
        collation: state.collation,
        latents: state.latents,
        observations: state.observations,
        snapshots: Object.fromEntries(state.snapshots)
      }, null, 2);
    }

    function renderLocation() {
      const loc = state.field && state.field.location;
      const label = loc ? loc.label : "Kansas City area";
      el("location-label").textContent = label;
      const sourceText = loc && loc.source === "browser" ? "Browser location" : "Kansas City default";
      const coords = loc ? loc.lat.toFixed(3) + ", " + loc.lon.toFixed(3) : "39.100, -94.579";
      const radius = loc ? loc.radiusMiles : 30;
      el("location-details").textContent = sourceText + "; " + coords + "; " + radius + " mile radius.";
    }

    function renderWeatherHelp() {
      const guide = el("weather-help");
      const hazard = state.latents.find((l) => l.name === "declared_weather_hazard");
      const event = String(hazard && hazard.label || "");
      const mode = /heat/i.test(event) ? "heat" : /(cold|freeze|wind chill)/i.test(event) ? "cold" : "";
      if (!mode) {
        guide.hidden = true;
        return;
      }
      const alertObservation = state.observations.find((o) => o.source === "NWS_ALERTS" && o.title === event);
      el("weather-help-title").textContent = mode === "heat" ? "Heat warning: get somewhere cooler" : "Cold warning: get somewhere warmer";
      el("weather-help-summary").textContent = hazard.summary + " The warning should connect to help, not stop at a status label.";
      el("weather-help-instruction").textContent =
        alertObservation && alertObservation.details && alertObservation.details.instruction
          ? "NWS guidance: " + String(alertObservation.details.instruction).replace(/\\s+/g, " ").trim()
          : mode === "heat"
            ? "Use the links below to find an indoor public place, transportation, utility assistance, shelter, or medical care."
            : "Use the links below to find a warm indoor place, transportation, utility assistance, shelter, or medical care.";
      guide.hidden = false;
    }

    function renderSources(sources) {
      const grid = el("sources-grid");
      grid.innerHTML = "";
      for (const source of sources) {
        const snap = state.snapshots.get(source);
        const result = state.sourceResults.get(source);
        const err = result && result.status === "error" ? { message: result.error } : null;
        const fresh = Boolean(state.collation && state.collation.sources && state.collation.sources[source]);
        const card = document.createElement("div");
        card.className = "source-card";
        const status = fresh ? "fresh" : result ? result.status : err ? err.message : "unknown";
        card.innerHTML = \`
          <div class="source-title">
            <strong>\${source}</strong>
            <span class="pill \${fresh ? "ok" : err ? "bad" : ""}">\${status}</span>
          </div>
          <div class="muted">\${sourceMeta[source] || "Registered source"}</div>
          \${sourceLinks[source] ? \`<a class="source-attribution" href="\${sourceLinks[source]}">Provider / methodology ↗</a>\` : ""}
          <div class="kv">
            <span>records</span><b>\${snap ? snap.data.length : result ? result.record_count : "-"}</b>
            <span>fetched</span><b>\${snap ? fmtDateMs(snap.fetched_at) : result && result.fetched_at ? fmtDateMs(result.fetched_at) : "-"}</b>
            <span>observed</span><b>\${snap ? fmtDateSec(snap.observed_at_max) : "-"}</b>
          </div>\`;
        grid.appendChild(card);
      }
    }

    function renderObserved() {
      const body = el("observed-body");
      if (!state.observations.length) {
        body.innerHTML = '<div class="empty">No decoded observations are available for this field.</div>';
        return;
      }
      body.innerHTML = \`<table><thead><tr><th>Source</th><th>Observation</th><th>Usable reading</th></tr></thead><tbody>\${state.observations.map((o) =>
        \`<tr><td>\${o.source}</td><td>\${o.title}</td><td>\${o.summary}</td></tr>\`
      ).join("")}</tbody></table>\`;
    }

    function renderCollation() {
      const body = el("collation-body");
      if (!state.collation) {
        const err = state.errors.get("collation");
        body.innerHTML = \`<div class="empty">\${err ? err.message : "No collation"}</div>\`;
        return;
      }
      const rows = Object.entries(state.collation.sources || {}).map(([name, s]) =>
        \`<tr><td>\${name}</td><td>\${s.record_count}</td><td>\${fmtDateMs(s.fetched_at)}</td><td>\${s.snapshot_id !== undefined ? "#" + s.snapshot_id : "transient"}</td></tr>\`
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
      const sorted = [...state.latents].sort((a, b) => (b.order || 1) - (a.order || 1) || severityRank(b) - severityRank(a) || b.value - a.value);
      const families = new Map();
      for (const latent of sorted) {
        const family = latent.family || "field";
        if (!families.has(family)) families.set(family, []);
        families.get(family).push(latent);
      }
      body.innerHTML = \`<div class="engine-stack">\${[...families.entries()].map(([family, rows]) => \`
        <section class="engine-group">
          <div class="engine-group-head"><h3>\${esc(family)} engine</h3><span>\${rows.length} signal\${rows.length === 1 ? "" : "s"}</span></div>
          <div class="latent-grid">\${rows.map((l) => {
        const severity = l.severity || "ok";
        const pillClass = severity === "alert" ? "bad" : severity === "watch" ? "watch" : "ok";
        const confidence = typeof l.confidence === "number" ? Math.round(l.confidence * 100) + "% confidence" : "direct reading";
        const unit = l.unit ? " " + esc(l.unit) : "";
        return \`<article class="latent-card \${esc(severity)}">
          <div class="latent-top">
            <div class="latent-title"><strong>\${esc(l.label || l.name)}</strong><span>\${esc(l.family || "field")} · order \${esc(l.order || 1)}</span></div>
            <div class="latent-value">\${esc(l.value)}\${unit}</div>
          </div>
          <div class="latent-summary">\${esc(l.summary || l.name)}</div>
          <div class="latent-meta">
            <span class="pill \${pillClass}">\${esc(severity)}</span>
            <span class="pill">\${esc(confidence)}</span>
            <span class="pill">\${esc(l.name)}</span>
          </div>
        </article>\`;
      }).join("")}</div>
        </section>\`).join("")}</div>\`;
    }

    function leadLatent() {
      if (!state.latents.length) return null;
      return [...state.latents].sort((a, b) => (b.order || 1) - (a.order || 1) || severityRank(b) - severityRank(a) || b.value - a.value)[0];
    }

    function severityRank(l) {
      return l.severity === "alert" ? 2 : l.severity === "watch" ? 1 : 0;
    }

    el("refresh").addEventListener("click", () => load().catch(showFatal));
    el("reset-location").addEventListener("click", () => {
      state.locationMode = "default";
      state.browserLocation = null;
      try { localStorage.removeItem("forecast.browserLocation"); } catch {}
      load().catch(showFatal);
    });
    el("use-location").addEventListener("click", () => {
      if (!navigator.geolocation) {
        el("location-label").textContent = "Location unavailable";
        return;
      }
      el("location-label").textContent = "Requesting location";
      navigator.geolocation.getCurrentPosition((pos) => {
        state.locationMode = "browser";
        state.browserLocation = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          radiusMiles: 30
        };
        try { localStorage.setItem("forecast.browserLocation", JSON.stringify(state.browserLocation)); } catch {}
        load().catch(showFatal);
      }, () => {
        el("location-label").textContent = "Kansas City area";
        el("location-details").textContent = "Browser location was unavailable; using Kansas City default.";
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
    });
    try {
      const saved = localStorage.getItem("forecast.browserLocation");
      if (saved) state.browserLocation = JSON.parse(saved);
    } catch {}
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
