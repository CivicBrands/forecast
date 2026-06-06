import { AnySource } from "./types";
import { metarSource } from "./metar";
import { airnowSource } from "./airnow";
import { firmsSource } from "./firms";
import { hrrrSmokeSource } from "./hrrr_smoke";
import { nexradSource } from "./nexrad";
import { nldnSource } from "./nldn";
import { notamSource } from "./notam";

export const registry: AnySource[] = [
  metarSource,
  airnowSource,
  firmsSource,
  hrrrSmokeSource,
  nexradSource,
  nldnSource,
  notamSource,
];

export function sourceNames(): string[] {
  return registry.map((s) => s.name);
}

export function findSource(name: string): AnySource | undefined {
  return registry.find((s) => s.name === name);
}
