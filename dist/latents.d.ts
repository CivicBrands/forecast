import type { Collation } from "./store";
export type DerivedLatent = {
    name: string;
    value: number;
    inputs: Record<string, unknown>;
    confidence?: number;
};
export type SnapshotLookup = (source: string) => {
    data: unknown[];
} | null;
/**
 * Derive cross-source latent signals from a collation.
 *
 * A latent is computed only when every source it depends on is present in the
 * collation. Absence MUST NOT be interpolated.
 */
export declare function deriveLatents(c: Collation, lookup: SnapshotLookup): DerivedLatent[];
//# sourceMappingURL=latents.d.ts.map