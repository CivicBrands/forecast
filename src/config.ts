export const config = {
  user: {
    lat: Number(process.env.USER_LAT ?? 39.0997),
    lon: Number(process.env.USER_LON ?? -94.5786),
    radiusMiles: Number(process.env.RADIUS_MILES ?? 30),
  },
  airnowApiKey: process.env.AIRNOW_API_KEY ?? "",
  tickMs: Number(process.env.TICK_MS ?? 5 * 60 * 1000),
  runOnce: process.env.RUN_ONCE === "1",
  port: Number(process.env.PORT ?? 3000),
  serve: process.env.SERVE !== "0",
  dbPath: process.env.DB_PATH ?? "./data/forecast.db",
  collationMaxAgeMs: Number(process.env.COLLATION_MAX_AGE_MS ?? 60 * 60 * 1000),
};
