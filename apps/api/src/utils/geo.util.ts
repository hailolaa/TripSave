/**
 * Geographic utility functions.
 */

/**
 * Calculate Haversine distance between two coordinates.
 * @returns Distance in miles
 */
export function haversineDistanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  if ((lat1 === 0 && lng1 === 0) || (lat2 === 0 && lng2 === 0)) {
    return 999; // Fallback to a large unknown distance if coords are missing/invalid
  }
  const EARTH_RADIUS_MILES = 3959;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_MILES * c;
}

/**
 * Convert meters to miles.
 */
export function metersToMiles(meters: number): number {
  return meters * 0.000621371;
}

/**
 * Calculate driving cost.
 * @param distanceMiles One-way distance in miles
 * @param mpg Vehicle miles per gallon
 * @param gasPrice Current gas price per gallon
 * @param isRoundTrip Whether to calculate for a round trip (default: true)
 * @returns Driving cost in USD
 */
export function calculateDriveCost(
  distanceMiles: number,
  mpg?: number,
  gasPrice?: number,
  isRoundTrip: boolean = true,
): number {
  const totalMiles = isRoundTrip ? distanceMiles * 2 : distanceMiles;
  // New simplified drive cost formula: $0.72 per mile
  return totalMiles * 0.72;
}

/**
 * Calculate true cost = item price + driving cost.
 */
export function calculateTrueCost(
  itemPrice: number,
  driveCost: number,
): number {
  return itemPrice + driveCost;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
