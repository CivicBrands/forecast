import { AnySource } from "./types";
import { metarSource } from "./metar";
import { airnowSource } from "./airnow";
import { firmsSource } from "./firms";
import { hrrrSmokeSource } from "./hrrr_smoke";
import { nexradSource } from "./nexrad";
import { nldnSource } from "./nldn";
import { eventsSource } from "./events";

/**
 * NOTAM is intentionally absent: it arrives via SWIM JMS (push) through the
 * out-of-process relay in `relay/notam/`, not by polling. The Worker still
 * stores NOTAM snapshots; ingest happens through POST /ingest/notam.
 */
export const registry: AnySource[] = [
  metarSource,
  airnowSource,
  firmsSource,
  hrrrSmokeSource,
  nexradSource,
  nldnSource,
  eventsSource,
];

export const NOTAM_SOURCE_NAME = "NOTAM";

export function sourceNames(): string[] {
  return registry.map((s) => s.name);
}

/**
 * Names of sources that have stored snapshots, including push-only sources
 * (NOTAM) that are not in the polling registry but DO appear under
 * /snapshots/{SOURCE}.
 */
export function knownSourceNames(): string[] {
  return [...sourceNames(), NOTAM_SOURCE_NAME];
}

export function findSource(name: string): AnySource | undefined {
  return registry.find((s) => s.name === name);
}
