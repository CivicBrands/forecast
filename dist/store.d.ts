export type SourceKey = string;
export type Snapshot<T = unknown> = {
    id?: number;
    source: SourceKey;
    fetched_at: number;
    observed_at_min: number;
    observed_at_max: number;
    data: T[];
};
export type Collation = {
    id?: number;
    collated_at: number;
    observed_at_min: number;
    observed_at_max: number;
    sources: Record<string, {
        snapshot_id: number;
        fetched_at: number;
        record_count: number;
    }>;
};
export type Latent = {
    id?: number;
    ts: number;
    name: string;
    value: number;
    collation_id: number;
    inputs: Record<string, unknown>;
    confidence?: number;
};
export declare function appendSnapshot<T>(snap: Snapshot<T>): number;
export declare function latestSnapshot<T = unknown>(source: SourceKey): Snapshot<T> | null;
export declare function appendCollation(c: Collation): number;
export declare function latestCollation(): Collation | null;
export declare function appendLatent(l: Latent): number;
export declare function latestLatents(): Latent[];
export declare function latentsByName(name: string, limit?: number): Latent[];
//# sourceMappingURL=store.d.ts.map