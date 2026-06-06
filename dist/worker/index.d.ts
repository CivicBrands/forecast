export interface Env {
    DB: D1Database;
    AIRNOW_API_KEY: string;
    USER_LAT?: string;
    USER_LON?: string;
    RADIUS_MILES?: string;
    COLLATION_MAX_AGE_MS?: string;
}
export declare function runTick(env: Env): Promise<void>;
declare const _default: {
    fetch(req: Request, env: Env): Promise<Response>;
    scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void>;
};
export default _default;
//# sourceMappingURL=index.d.ts.map