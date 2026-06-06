import { DerivedLatent } from "./latents";
import { AnySource, Snapshot, SourceContext } from "./sources/types";
export type FieldLocationSource = "default" | "query" | "browser";
export type FieldLocation = {
    lat: number;
    lon: number;
    radiusMiles: number;
    source: FieldLocationSource;
    label: string;
};
export type FieldSourceResult = {
    name: string;
    status: "ok" | "empty" | "disabled" | "error";
    record_count: number;
    fetched_at?: number;
    observed_at_min?: number;
    observed_at_max?: number;
    error?: string;
};
export type PlainObservation = {
    source: string;
    title: string;
    summary: string;
    severity?: "ok" | "watch" | "alert";
    details?: Record<string, unknown>;
};
export type TransientField = {
    generated_at: number;
    location: FieldLocation;
    sources: FieldSourceResult[];
    collation: {
        collated_at: number;
        observed_at_min: number;
        observed_at_max: number;
        sources: Record<string, {
            fetched_at: number;
            record_count: number;
        }>;
    } | null;
    latents: DerivedLatent[];
    observations: PlainObservation[];
    snapshots: Record<string, Snapshot<unknown>>;
};
export type FieldDefaults = {
    lat: number;
    lon: number;
    radiusMiles: number;
    label: string;
};
export declare const KC_DEFAULTS: FieldDefaults;
export declare function parseFieldLocation(params: URLSearchParams, defaults?: FieldDefaults): FieldLocation;
export declare function buildFieldContext(location: FieldLocation, env: Record<string, string | undefined>): SourceContext;
export declare function buildTransientField(location: FieldLocation, env: Record<string, string | undefined>, sources?: AnySource[], now?: number): Promise<TransientField>;
//# sourceMappingURL=field.d.ts.map