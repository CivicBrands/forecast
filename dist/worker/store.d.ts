export type SourceKey = "METAR" | "AIRNOW";
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
    sources: Partial<Record<SourceKey, {
        snapshot_id: number;
        fetched_at: number;
        record_count: number;
    }>>;
};
export declare function appendSnapshot<T>(db: D1Database, snap: Snapshot<T>): Promise<number>;
export declare function latestSnapshot<T = unknown>(db: D1Database, source: SourceKey): Promise<Snapshot<T> | null>;
export declare function appendCollation(db: D1Database, c: Collation): Promise<number>;
export declare function latestCollation(db: D1Database): Promise<Collation | null>;
//# sourceMappingURL=store.d.ts.map