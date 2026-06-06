function require_(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

function num(name: string, def: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return def;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`Env ${name} is not a number: ${v}`);
  return n;
}

export const config = {
  swim: {
    url: require_("SWIM_URL"),
    vpn: require_("SWIM_VPN"),
    username: require_("SWIM_USERNAME"),
    password: require_("SWIM_PASSWORD"),
    queue: require_("SWIM_QUEUE"),
  },
  ingest: {
    url: require_("INGEST_URL"),
    token: require_("INGEST_TOKEN"),
  },
  user: {
    lat: num("USER_LAT", 39.0997),
    lon: num("USER_LON", -94.5786),
    radiusMiles: num("RADIUS_MILES", 30),
  },
  batch: {
    maxRecords: num("BATCH_MAX_RECORDS", 50),
    maxAgeMs: num("BATCH_MAX_AGE_MS", 30_000),
  },
  geoFilterEnabled: (process.env.GEO_FILTER ?? "1") !== "0",
};

export type Config = typeof config;
