"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestMetar = ingestMetar;
exports.validateMetar = validateMetar;
exports.ingestAirNow = ingestAirNow;
exports.validateAirNow = validateAirNow;
const zod_1 = require("zod");
// --- METAR schema (matches real aviationweather.gov response) ---
const MetarCloudLayerSchema = zod_1.z.object({
    cover: zod_1.z.string(),
    base: zod_1.z.number().optional(),
});
const MetarObservationSchema = zod_1.z.object({
    icaoId: zod_1.z.string(),
    receiptTime: zod_1.z.string(),
    obsTime: zod_1.z.number(),
    reportTime: zod_1.z.string(),
    temp: zod_1.z.number(),
    dewp: zod_1.z.number(),
    wdir: zod_1.z.number(),
    wspd: zod_1.z.number(),
    wg: zod_1.z.number().optional(),
    visib: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]),
    altim: zod_1.z.number(),
    slp: zod_1.z.number().optional(),
    qcField: zod_1.z.number(),
    metarType: zod_1.z.string(),
    rawOb: zod_1.z.string(),
    lat: zod_1.z.number(),
    lon: zod_1.z.number(),
    elev: zod_1.z.number(),
    name: zod_1.z.string(),
    cover: zod_1.z.string(),
    clouds: zod_1.z.array(MetarCloudLayerSchema),
    wxString: zod_1.z.string().optional(),
    fltCat: zod_1.z.string(),
});
const MetarResponseSchema = zod_1.z.array(MetarObservationSchema);
// --- Geo helpers ---
function bboxFromPoint(lat, lon, radiusMiles) {
    const latDelta = radiusMiles / 69;
    const lonDelta = radiusMiles / (69 * Math.cos((lat * Math.PI) / 180));
    return {
        south: lat - latDelta,
        west: lon - lonDelta,
        north: lat + latDelta,
        east: lon + lonDelta,
    };
}
// --- Ingestion ---
async function ingestMetar(lat, lon, radiusMiles = 30) {
    const { south, west, north, east } = bboxFromPoint(lat, lon, radiusMiles);
    const url = `https://aviationweather.gov/api/data/metar?bbox=${south},${west},${north},${east}&format=json`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`METAR fetch failed: ${res.status} ${res.statusText}`);
    }
    const raw = await res.json();
    return validateMetar(raw);
}
// --- Validation ---
function validateMetar(input) {
    const result = MetarResponseSchema.safeParse(input);
    if (!result.success) {
        throw new Error(JSON.stringify(result.error.format(), null, 2));
    }
    return result.data;
}
// --- AirNow schema (matches real airnowapi.org response) ---
const AirNowCategorySchema = zod_1.z.object({
    Number: zod_1.z.number(),
    Name: zod_1.z.string(),
});
const AirNowObservationSchema = zod_1.z.object({
    DateObserved: zod_1.z.string(),
    HourObserved: zod_1.z.number(),
    LocalTimeZone: zod_1.z.string(),
    ReportingArea: zod_1.z.string(),
    StateCode: zod_1.z.string(),
    Latitude: zod_1.z.number(),
    Longitude: zod_1.z.number(),
    ParameterName: zod_1.z.string(),
    AQI: zod_1.z.number(),
    Category: AirNowCategorySchema,
});
const AirNowResponseSchema = zod_1.z.array(AirNowObservationSchema);
// --- AirNow Ingestion ---
async function ingestAirNow(lat, lon, distanceMiles = 30, apiKey) {
    const url = `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=${lat}&longitude=${lon}&distance=${distanceMiles}&API_KEY=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`AirNow fetch failed: ${res.status} ${res.statusText}`);
    }
    const raw = await res.json();
    return validateAirNow(raw);
}
function validateAirNow(input) {
    const result = AirNowResponseSchema.safeParse(input);
    if (!result.success) {
        throw new Error(JSON.stringify(result.error.format(), null, 2));
    }
    return result.data;
}
//# sourceMappingURL=ingest.js.map