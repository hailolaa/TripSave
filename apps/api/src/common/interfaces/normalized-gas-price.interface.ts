/**
 * Normalized gas station data returned by gas price providers (e.g., GasBuddy).
 * Raw API structures must be mapped to this shape before entering the service layer.
 */
export interface NormalizedGasStation {
  /** External station identifier from the source */
  stationId: string;

  /** Station/brand name (e.g., "Shell", "Exxon") */
  name: string;

  /** Full street address */
  address: string;

  /** Latitude coordinate */
  latitude: number;

  /** Longitude coordinate */
  longitude: number;

  /** Brand logo URL */
  logoUrl: string | null;

  /** Price data by fuel type */
  prices: NormalizedGasPrice;
}

export interface NormalizedGasPrice {
  /** Regular unleaded price in USD */
  regular: number | null;

  /** Midgrade price in USD */
  midgrade: number | null;

  /** Premium price in USD */
  premium: number | null;

  /** Diesel price in USD */
  diesel: number | null;
}
