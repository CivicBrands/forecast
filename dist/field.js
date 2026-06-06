"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KC_DEFAULTS = void 0;
exports.parseFieldLocation = parseFieldLocation;
exports.buildFieldContext = buildFieldContext;
exports.buildTransientField = buildTransientField;
const latents_1 = require("./latents");
const registry_1 = require("./sources/registry");
exports.KC_DEFAULTS = {
    lat: 39.0997,
    lon: -94.5786,
    radiusMiles: 30,
    label: "Kansas City area",
};
function parseFieldLocation(params, defaults = exports.KC_DEFAULTS) {
    const hasLat = params.has("lat");
    const hasLon = params.has("lon");
    const hasRadius = params.has("radius") || params.has("radiusMiles");
    if (hasLat !== hasLon)
        throw new Error("lat_lon_required");
    const lat = hasLat ? Number(params.get("lat")) : defaults.lat;
    const lon = hasLon ? Number(params.get("lon")) : defaults.lon;
    const radiusMiles = hasRadius ? Number(params.get("radius") ?? params.get("radiusMiles")) : defaults.radiusMiles;
    if (!Number.isFinite(lat) || lat < -90 || lat > 90)
        throw new Error("invalid_lat");
    if (!Number.isFinite(lon) || lon < -180 || lon > 180)
        throw new Error("invalid_lon");
    if (!Number.isFinite(radiusMiles) || radiusMiles <= 0 || radiusMiles > 250)
        throw new Error("invalid_radius");
    const requestedSource = params.get("location_source");
    const source = requestedSource === "browser" ? "browser" : hasLat ? "query" : "default";
    return {
        lat,
        lon,
        radiusMiles,
        source,
        label: source === "default" ? defaults.label : "Selected area",
    };
}
function buildFieldContext(location, env) {
    return {
        lat: location.lat,
        lon: location.lon,
        radiusMiles: location.radiusMiles,
        env,
    };
}
async function buildTransientField(location, env, sources = registry_1.registry, now = Date.now()) {
    const ctx = buildFieldContext(location, env);
    const sourceResults = [];
    const snapshots = {};
    await Promise.all(sources.map(async (src) => {
        if (!src.isEnabled(ctx)) {
            sourceResults.push({ name: src.name, status: "disabled", record_count: 0 });
            return;
        }
        try {
            const data = await src.fetch(ctx);
            if (data.length === 0) {
                sourceResults.push({ name: src.name, status: "empty", record_count: 0, fetched_at: now });
                return;
            }
            const { min, max } = src.observedAt(data);
            snapshots[src.name] = {
                source: src.name,
                fetched_at: now,
                observed_at_min: min,
                observed_at_max: max,
                data,
            };
            sourceResults.push({
                name: src.name,
                status: "ok",
                record_count: data.length,
                fetched_at: now,
                observed_at_min: min,
                observed_at_max: max,
            });
        }
        catch (err) {
            sourceResults.push({
                name: src.name,
                status: "error",
                record_count: 0,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }));
    sourceResults.sort((a, b) => a.name.localeCompare(b.name));
    const okSnapshots = Object.values(snapshots);
    const collation = okSnapshots.length
        ? {
            collated_at: now,
            observed_at_min: Math.min(...okSnapshots.map((s) => s.observed_at_min)),
            observed_at_max: Math.max(...okSnapshots.map((s) => s.observed_at_max)),
            sources: Object.fromEntries(okSnapshots.map((s) => [s.source, { fetched_at: s.fetched_at, record_count: s.data.length }])),
        }
        : null;
    const latents = collation
        ? (0, latents_1.deriveLatents)({
            collated_at: collation.collated_at,
            observed_at_min: collation.observed_at_min,
            observed_at_max: collation.observed_at_max,
            sources: Object.fromEntries(Object.entries(collation.sources).map(([name, s]) => [
                name,
                { snapshot_id: 0, fetched_at: s.fetched_at, record_count: s.record_count },
            ])),
        }, (name) => snapshots[name] ?? null)
        : [];
    const labeledLocation = { ...location, label: deriveLocationLabel(location, snapshots) };
    const observations = Object.values(snapshots).flatMap((snap) => summarizeSnapshot(snap.source, snap.data));
    return {
        generated_at: now,
        location: labeledLocation,
        sources: sourceResults,
        collation,
        latents,
        observations,
        snapshots,
    };
}
function deriveLocationLabel(location, snapshots) {
    if (location.source === "default")
        return location.label;
    const airnow = snapshots.AIRNOW?.data[0];
    if (airnow?.ReportingArea) {
        return airnow.StateCode ? `${airnow.ReportingArea}, ${airnow.StateCode}` : airnow.ReportingArea;
    }
    const metar = snapshots.METAR?.data[0];
    if (metar?.name)
        return `${metar.name} area`;
    return "Selected area";
}
function summarizeSnapshot(source, data) {
    switch (source) {
        case "METAR":
            return summarizeMetar(data);
        case "AIRNOW":
            return summarizeAirNow(data);
        case "FIRMS":
            return summarizeFirms(data);
        case "HRRR_SMOKE":
            return summarizeHrrrSmoke(data);
        case "NEXRAD":
            return summarizeNexrad(data);
        case "NLDN":
            return summarizeNldn(data);
        default:
            return [{ source, title: source, summary: `${data.length} record(s) available.` }];
    }
}
function summarizeMetar(data) {
    return data.slice(0, 8).map((row) => {
        const o = row;
        const tempF = typeof o.temp === "number" ? Math.round((o.temp * 9) / 5 + 32) : undefined;
        const dewF = typeof o.dewp === "number" ? Math.round((o.dewp * 9) / 5 + 32) : undefined;
        const wind = typeof o.wspd === "number" ? `${o.wspd} kt${typeof o.wdir === "number" ? ` from ${o.wdir}°` : ""}` : "wind unavailable";
        const visibility = o.visib !== undefined ? `${o.visib} sm visibility` : "visibility unavailable";
        return {
            source: "METAR",
            title: `${o.name ?? o.icaoId ?? "Station"}${o.icaoId ? ` (${o.icaoId})` : ""}`,
            summary: `${tempF ?? "-"}°F, dew point ${dewF ?? "-"}°F, ${wind}, ${visibility}, flight category ${o.fltCat ?? "unknown"}.`,
            severity: o.fltCat && !["VFR"].includes(o.fltCat) ? "watch" : "ok",
            details: { raw: o.rawOb },
        };
    });
}
function summarizeAirNow(data) {
    return data.map((row) => {
        const o = row;
        return {
            source: "AIRNOW",
            title: `${o.ParameterName ?? "AQI"} in ${o.ReportingArea ?? "area"}${o.StateCode ? `, ${o.StateCode}` : ""}`,
            summary: `AQI ${o.AQI ?? "-"} (${o.Category?.Name ?? "unknown category"}).`,
            severity: typeof o.AQI === "number" && o.AQI > 100 ? "alert" : typeof o.AQI === "number" && o.AQI > 50 ? "watch" : "ok",
            details: { category: o.Category },
        };
    });
}
function summarizeFirms(data) {
    const frps = data.map((d) => d.frp).filter((n) => typeof n === "number");
    const maxFrp = frps.length ? Math.max(...frps) : undefined;
    return [
        {
            source: "FIRMS",
            title: "Active fire detections",
            summary: `${data.length} detection(s) in the selected radius${maxFrp !== undefined ? `; max FRP ${maxFrp}` : ""}.`,
            severity: data.length > 0 ? "watch" : "ok",
        },
    ];
}
function summarizeHrrrSmoke(data) {
    const values = data
        .map((d) => d.near_surface_smoke)
        .filter((n) => typeof n === "number");
    const max = values.length ? Math.max(...values) : undefined;
    return [
        {
            source: "HRRR_SMOKE",
            title: "Near-surface smoke",
            summary: `${data.length} model point(s)${max !== undefined ? `; max near-surface smoke ${max}` : ""}.`,
            severity: max !== undefined && max > 0 ? "watch" : "ok",
        },
    ];
}
function summarizeNexrad(data) {
    return data.map((row) => {
        const o = row;
        return {
            source: "NEXRAD",
            title: `Radar ${o.station ?? "station"}`,
            summary: `Latest scan metadata at ${o.ts ? new Date(o.ts * 1000).toISOString() : "unknown time"}.`,
            details: { key: o.s3_key },
        };
    });
}
function summarizeNldn(data) {
    const peaks = data.map((d) => Math.abs(d.peak_kA ?? 0));
    const maxPeak = peaks.length ? Math.max(...peaks) : undefined;
    return [
        {
            source: "NLDN",
            title: "Lightning detections",
            summary: `${data.length} strike(s)${maxPeak !== undefined ? `; max peak ${maxPeak} kA` : ""}.`,
            severity: data.length > 0 ? "alert" : "ok",
        },
    ];
}
//# sourceMappingURL=field.js.map