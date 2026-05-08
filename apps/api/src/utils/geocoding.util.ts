import axios from 'axios';

export interface GeocodeResult {
  lat: number;
  lng: number;
  zipCode: string | null;
  displayName: string;
}

export async function geocodePlace(query: string): Promise<GeocodeResult | null> {
  if (!query) return null;

  try {
    // Restrict to US results to avoid global false positives (e.g., "Target" matching a place name abroad).
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(query)}` +
      `&format=json` +
      `&addressdetails=1` +
      `&limit=1` +
      `&countrycodes=us`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'TripSaveApp/1.0',
      },
      timeout: 5000,
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        zipCode: result.address?.postcode || null,
        displayName: result.display_name,
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Geocode a query near a specific coordinate using a bounded viewbox.
 * This prevents global false positives for ambiguous store names.
 */
export async function geocodePlaceNear(
  query: string,
  nearLat: number,
  nearLng: number,
  viewboxDegrees: number = 0.5,
): Promise<GeocodeResult | null> {
  if (!query) return null;

  const left = nearLng - viewboxDegrees;
  const right = nearLng + viewboxDegrees;
  const top = nearLat + viewboxDegrees;
  const bottom = nearLat - viewboxDegrees;

  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(query)}` +
      `&format=json` +
      `&addressdetails=1` +
      `&limit=1` +
      `&countrycodes=us` +
      `&bounded=1` +
      `&viewbox=${encodeURIComponent(`${left},${top},${right},${bottom}`)}`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'TripSaveApp/1.0',
      },
      timeout: 7000,
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        zipCode: result.address?.postcode || null,
        displayName: result.display_name,
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}
