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
export declare function appendSnapshot<T>(snap: Snapshot<T>): number;
export declare function latestSnapshot<T = unknown>(source: SourceKey): Snapshot<T> | null;
export declare function appendCollation(c: Collation): number;
export declare function latestCollation(): Collation | null;
//# sourceMappingURL=store.d.ts.map