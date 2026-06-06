/** Great-circle distance in miles between two lat/lon points (haversine). */
export function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.7613; // earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function withinRadius(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  radiusMiles: number,
): boolean {
  return distanceMiles(lat, lon, centerLat, centerLon) <= radiusMiles;
}
