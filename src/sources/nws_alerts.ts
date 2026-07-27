import { z } from "zod";
import { Source, SourceContext, boundsFrom } from "./types";

const NullableString = z.string().nullable().optional();

export const NwsAlertSchema = z.object({
  id: z.string(),
  event: z.string(),
  headline: NullableString,
  description: NullableString,
  instruction: NullableString,
  severity: NullableString,
  urgency: NullableString,
  certainty: NullableString,
  sent: NullableString,
  effective: NullableString,
  onset: NullableString,
  expires: NullableString,
  ends: NullableString,
  senderName: NullableString,
});

const NwsResponseSchema = z.object({
  features: z.array(
    z.object({
      id: z.string(),
      properties: NwsAlertSchema.omit({ id: true }),
    }),
  ),
});

const NwsAlertsSchema = z.array(NwsAlertSchema);
export type NwsAlert = z.infer<typeof NwsAlertSchema>;

function epochSeconds(value?: string | null): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
}

export function activeHeatAlert(rows: unknown[], now = Date.now()): NwsAlert | undefined {
  return rows
    .map((row) => NwsAlertSchema.safeParse(row))
    .filter((result): result is { success: true; data: NwsAlert } => result.success)
    .map((result) => result.data)
    .find((alert) => {
      if (!/(extreme heat|heat advisory)/i.test(alert.event)) return false;
      const starts = Date.parse(alert.onset ?? alert.effective ?? "");
      const ends = Date.parse(alert.ends ?? alert.expires ?? "");
      return (!Number.isFinite(starts) || starts <= now) && (!Number.isFinite(ends) || ends > now);
    });
}

export function alertWhat(alert: Pick<NwsAlert, "event" | "description">): string {
  const description = alert.description ?? "";
  const match = description.match(/\*\s*WHAT\.\.\.([\s\S]*?)(?:\n\s*\n|\*\s*WHERE)/i);
  const what = (match?.[1] ?? description.split(/\n\s*\n/)[0] ?? "").replace(/\s+/g, " ").trim();
  return what ? `${alert.event} is in effect. ${what}` : `${alert.event} is in effect.`;
}

export const nwsAlertsSource: Source<NwsAlert> = {
  name: "NWS_ALERTS",
  cadenceMs: 5 * 60 * 1000,
  schema: NwsAlertsSchema,
  isEnabled() {
    return true;
  },
  async fetch(ctx: SourceContext) {
    const url = `https://api.weather.gov/alerts/active?point=${ctx.lat},${ctx.lon}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/geo+json",
        "User-Agent": "CivicBrands Forecast contact@mail.civicbrands.org",
      },
    });
    if (!res.ok) {
      throw new Error(`NWS alerts fetch failed: ${res.status} ${res.statusText}`);
    }
    const parsed = NwsResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      throw new Error(JSON.stringify(parsed.error.format(), null, 2));
    }
    return parsed.data.features.map((feature) => ({ id: feature.id, ...feature.properties }));
  },
  observedAt(data) {
    return boundsFrom(data, (alert) => epochSeconds(alert.onset ?? alert.effective ?? alert.sent) ?? Math.floor(Date.now() / 1000));
  },
};
