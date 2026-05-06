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
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1`;
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
