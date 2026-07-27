import type { Collation } from "./store";
export type DerivedLatent = {
    name: string;
    label: string;
    value: number;
    unit?: string;
    summary: string;
    severity: "ok" | "watch" | "alert";
    order: 1 | 2 | 3 | 4;
    family: "air" | "visibility" | "fire" | "smoke" | "storm" | "operations" | "mobility" | "civic" | "field";
    inputs: Record<string, unknown>;
    confidence?: number;
};
export type SnapshotLookup = (source: string) => {
    data: unknown[];
} | null;
export type LocalEventContext = {
    name: string;
    starts_at: number;
    ends_at: number;
    expected_presence?: number;
    tags?: string[];
};
export type LatentContext = {
    now?: number;
    timezone?: string;
    locationLabel?: string;
    events?: LocalEventContext[];
};
/**
 * Derive cross-source latent signals from a collation.
 *
 * A latent is computed only when every source it depends on is present in the
 * collation. Absence MUST NOT be interpolated.
 */
export declare function deriveLatents(c: Collation, lookup: SnapshotLookup, context?: LatentContext): DerivedLatent[];
//# sourceMappingURL=latents.d.ts.map