import { AnySource } from "./types";
/**
 * NOTAM is intentionally absent: it arrives via SWIM JMS (push) through the
 * out-of-process relay in `relay/notam/`, not by polling. The Worker still
 * stores NOTAM snapshots; ingest happens through POST /ingest/notam.
 */
export declare const registry: AnySource[];
export declare const NOTAM_SOURCE_NAME = "NOTAM";
export declare function sourceNames(): string[];
/**
 * Names of sources that have stored snapshots, including push-only sources
 * (NOTAM) that are not in the polling registry but DO appear under
 * /snapshots/{SOURCE}.
 */
export declare function knownSourceNames(): string[];
export declare function findSource(name: string): AnySource | undefined;
//# sourceMappingURL=registry.d.ts.map