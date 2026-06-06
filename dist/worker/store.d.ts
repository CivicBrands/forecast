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
export declare function appendSnapshot<T>(db: D1Database, snap: Snapshot<T>): Promise<number>;
export declare function latestSnapshot<T = unknown>(db: D1Database, source: SourceKey): Promise<Snapshot<T> | null>;
export declare function appendCollation(db: D1Database, c: Collation): Promise<number>;
export declare function latestCollation(db: D1Database): Promise<Collation | null>;
export declare function appendLatent(db: D1Database, l: Latent): Promise<number>;
export declare function latestLatents(db: D1Database): Promise<Latent[]>;
export declare function latentsByName(db: D1Database, name: string, limit?: number): Promise<Latent[]>;
//# sourceMappingURL=store.d.ts.map