import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseAttributeValue: true,
  // Keep tag values as strings so leading-zero NOTAM numbers ("035"), flight
  // levels ("000"/"999"), and dotted text are preserved verbatim. Numeric
  // fields are coerced explicitly via numOrU().
  parseTagValue: false,
  trimValues: true,
});

export type CanonicalNotam = {
  id: string;
  fns_uuid: string;
  number: string;
  year: string;
  type: string;
  interpretation: string;
  issued: string;
  effective_start: string;
  effective_end?: string;
  location: string;
  icao_location?: string;
  airport_name?: string;
  affected_fir?: string;
  selection_code?: string;
  qline?: string;
  min_fl?: number;
  max_fl?: number;
  coordinates?: string;
  lat?: number;
  lon?: number;
  radius_nm?: number;
  classification?: string;
  text: string;
  local_format?: string;
  icao_format?: string;
};

function asArray<T>(x: T | T[] | undefined | null): T[] {
  if (x === null || x === undefined) return [];
  return Array.isArray(x) ? x : [x];
}

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}

function numOrU(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parse one AIXM Basic Message into a canonical NOTAM record.
 * Returns null when the message contains no Event/NOTAM payload.
 */
export function parseAixmMessage(xml: string): CanonicalNotam | null {
  let obj: unknown;
  try {
    obj = parser.parse(xml);
  } catch {
    return null;
  }
  const root = (obj as Record<string, unknown> | undefined)?.AIXMBasicMessage as
    | Record<string, unknown>
    | undefined;
  if (!root) return null;

  const members = asArray(root.hasMember as unknown);

  let event: Record<string, unknown> | undefined;
  let airport: Record<string, unknown> | undefined;
  for (const m of members) {
    const mm = m as Record<string, unknown>;
    if (mm.Event && !event) event = mm.Event as Record<string, unknown>;
    if (mm.AirportHeliport && !airport) airport = mm.AirportHeliport as Record<string, unknown>;
  }
  if (!event) return null;

  const fnsUuid = str((event.identifier as Record<string, unknown> | undefined)?.["#text"]) ?? str(event.identifier);
  const timeSlice = (event.timeSlice as Record<string, unknown> | undefined)?.EventTimeSlice as
    | Record<string, unknown>
    | undefined;
  if (!timeSlice) return null;

  const interpretation = str(timeSlice.interpretation) ?? "BASELINE";
  const notam = (timeSlice.textNOTAM as Record<string, unknown> | undefined)?.NOTAM as
    | Record<string, unknown>
    | undefined;
  if (!notam) return null;

  const ext = (timeSlice.extension as Record<string, unknown> | undefined)?.EventExtension as
    | Record<string, unknown>
    | undefined;

  // Find airport lat/lon if present
  let lat: number | undefined;
  let lon: number | undefined;
  const arpTimeSlice = (airport?.timeSlice as Record<string, unknown> | undefined)?.AirportHeliportTimeSlice as
    | Record<string, unknown>
    | undefined;
  const elevatedPoint = (arpTimeSlice?.ARP as Record<string, unknown> | undefined)?.ElevatedPoint as
    | Record<string, unknown>
    | undefined;
  const pos = str(elevatedPoint?.pos);
  if (pos) {
    const parts = pos.split(/\s+/);
    if (parts.length >= 2) {
      lat = numOrU(parts[0]);
      lon = numOrU(parts[1]);
    }
  }

  // Translations: collect by type
  let localFormat: string | undefined;
  let icaoFormat: string | undefined;
  const translations = asArray((notam.translation as unknown));
  for (const t of translations) {
    const nt = (t as Record<string, unknown>).NOTAMTranslation as Record<string, unknown> | undefined;
    if (!nt) continue;
    const type = str(nt.type) ?? "";
    if (type === "LOCAL_FORMAT") {
      localFormat = str(nt.simpleText);
    } else if (type.endsWith("ICAO")) {
      const formatted = nt.formattedText as Record<string, unknown> | undefined;
      icaoFormat = str(formatted?.div) ?? str(formatted);
    }
  }

  const id = str(ext?.xovernotamID) ?? `${str(notam.location)}-${str(notam.year)}-${str(notam.number)}`;
  const issued = str(notam.issued) ?? str(ext?.lastUpdated) ?? "";
  const validTime = (timeSlice.validTime as Record<string, unknown> | undefined)?.TimePeriod as
    | Record<string, unknown>
    | undefined;
  const effective_start = str(validTime?.beginPosition) ?? "";
  const effective_end = str(validTime?.endPosition);

  return {
    id,
    fns_uuid: fnsUuid ?? id,
    number: str(notam.number) ?? "",
    year: str(notam.year) ?? "",
    type: str(notam.type) ?? "",
    interpretation,
    issued,
    effective_start,
    effective_end,
    location: str(notam.location) ?? "",
    icao_location: str(ext?.icaoLocation) ?? str(arpTimeSlice?.locationIndicatorICAO),
    airport_name: str(ext?.airportname) ?? str(arpTimeSlice?.name),
    affected_fir: str(notam.affectedFIR),
    selection_code: str(notam.selectionCode),
    qline: str(ext?.qline),
    min_fl: numOrU(notam.minimumFL),
    max_fl: numOrU(notam.maximumFL),
    coordinates: str(notam.coordinates),
    lat,
    lon,
    radius_nm: numOrU(notam.radius),
    classification: str(ext?.classification),
    text: str(notam.text) ?? "",
    local_format: localFormat,
    icao_format: icaoFormat,
  };
}
