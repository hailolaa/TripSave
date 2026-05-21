import axios from 'axios';

export interface GeocodeResult {
  lat: number;
  lng: number;
  zipCode: string | null;
  displayName: string;
  /** State/region short name (e.g. 'TX', 'CA'). Only populated by reverseGeocode. */
  region?: string;
}

/**
 * Retry wrapper with exponential backoff.
 * Retries on 429 (rate limit) and 5xx (server error) responses.
 * @param fn - The async function to retry
 * @param retries - Number of retry attempts (default 3)
 * @param delays - Delay in ms between retries (default [2000, 4000, 6000])
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delays: number[] = [2000, 4000, 6000],
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const status = error?.response?.status;
      const isRetryable = status === 429 || (status >= 500 && status < 600);

      if (!isRetryable || attempt >= retries) {
        throw error;
      }

      const delay = delays[attempt] || delays[delays.length - 1];
      console.warn(`Geocoding retry ${attempt + 1}/${retries} after ${delay}ms (HTTP ${status})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

const GOOGLE_MAPS_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

function getApiKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY || '';
}

/**
 * Extract a component of a given type from Google Maps geocoding results.
 */
function extractComponent(components: any[], type: string, useShortName = false): string | null {
  const comp = components?.find((c: any) => c.types?.includes(type));
  return comp ? (useShortName ? comp.short_name : comp.long_name) : null;
}

export async function geocodePlace(query: string): Promise<GeocodeResult | null> {
  if (!query) return null;

  try {
    return await retryWithBackoff(async () => {
      const response = await axios.get(GOOGLE_MAPS_GEOCODE_URL, {
        params: {
          address: query,
          components: 'country:US',
          key: getApiKey(),
        },
        timeout: 7000,
      });

      if (response.data?.results?.length > 0) {
        const result = response.data.results[0];
        const loc = result.geometry?.location;
        const components = result.address_components || [];
        const zipCode = extractComponent(components, 'postal_code') || null;

        return {
          lat: loc.lat,
          lng: loc.lng,
          zipCode,
          displayName: result.formatted_address || '',
        };
      }
      return null;
    });
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Geocode a query near a specific coordinate using location biasing.
 * This prevents global false positives for ambiguous store names.
 */
export async function geocodePlaceNear(
  query: string,
  nearLat: number,
  nearLng: number,
  viewboxDegrees: number = 0.5,
): Promise<GeocodeResult | null> {
  if (!query) return null;

  try {
    return await retryWithBackoff(async () => {
      // Use bounds to bias results near the user's location
      const south = nearLat - viewboxDegrees;
      const north = nearLat + viewboxDegrees;
      const west = nearLng - viewboxDegrees;
      const east = nearLng + viewboxDegrees;

      const response = await axios.get(GOOGLE_MAPS_GEOCODE_URL, {
        params: {
          address: query,
          bounds: `${south},${west}|${north},${east}`,
          components: 'country:US',
          key: getApiKey(),
        },
        timeout: 7000,
      });

      if (response.data?.results?.length > 0) {
        const result = response.data.results[0];
        const loc = result.geometry?.location;
        const components = result.address_components || [];
        const zipCode = extractComponent(components, 'postal_code') || null;

        return {
          lat: loc.lat,
          lng: loc.lng,
          zipCode,
          displayName: result.formatted_address || '',
        };
      }
      return null;
    });
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Reverse geocode coordinates to get a display name/address.
 * Extracts administrative_area_level_1 short name as the region (e.g. 'TX').
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  try {
    return await retryWithBackoff(async () => {
      const response = await axios.get(GOOGLE_MAPS_GEOCODE_URL, {
        params: {
          latlng: `${lat},${lng}`,
          key: getApiKey(),
        },
        timeout: 7000,
      });

      if (response.data?.results?.length > 0) {
        const result = response.data.results[0];
        const loc = result.geometry?.location;
        const components = result.address_components || [];

        const zipCode = extractComponent(components, 'postal_code') || null;
        const region = extractComponent(components, 'administrative_area_level_1', true) || undefined;

        return {
          lat: loc?.lat ?? lat,
          lng: loc?.lng ?? lng,
          zipCode,
          displayName: result.formatted_address || '',
          region,
        };
      }
      return null;
    });
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    // Fallback: return a minimal result with 'US' region so callers don't crash
    return {
      lat,
      lng,
      zipCode: null,
      displayName: '',
      region: 'US',
    };
  }
}

/**
 * Get neighboring ZIP codes by geocoding 4 offset points (approx 5 miles in each direction).
 */
export async function getNeighboringZips(lat: number, lng: number, zip: string): Promise<string[]> {
  const offsets = [
    [lat + 0.07, lng],  // north
    [lat - 0.07, lng],  // south
    [lat, lng + 0.07],  // east
    [lat, lng - 0.07],  // west
  ];
  
  const neighborZips = await Promise.all(
    offsets.map(async ([oLat, oLng]) => {
      const result = await reverseGeocode(oLat, oLng);
      return result?.zipCode;
    })
  );
  
  const allZips = [zip, ...neighborZips].filter(Boolean) as string[];
  return [...new Set(allZips)];
}
