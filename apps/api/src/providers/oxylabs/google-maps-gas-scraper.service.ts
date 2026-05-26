import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OxylabsBaseService } from './oxylabs-base.service';
import { NormalizedGasStation } from '../../common/interfaces/normalized-gas-price.interface';
import * as cheerio from 'cheerio';

/**
 * Scraper for Google Maps using Oxylabs specialized source.
 * Fetches gas stations and prices directly from Google Maps search results.
 */
@Injectable()
export class GoogleMapsGasScraperService extends OxylabsBaseService {
  constructor(protected readonly configService: ConfigService) {
    super(configService);
  }

  /**
   * Search for stores in a specific area.
   * @param area - Location string or query (e.g., "75201" or "Walmart in Dallas")
   * @param type - Optional category to refine search (e.g., "grocery stores", "gas stations")
   * @returns Array of normalized store results.
   */
  async searchNearbyStores(area: string, type?: string): Promise<NormalizedGasStation[]> {
    const query = type ? `${type} in ${area}` : area;
    
    try {
      // Oxylabs google_maps source is sensitive to payload shape.
      // `parse: true` may not be supported for this target and can trigger 400s,
      // so we rely on HTML parsing when structured results aren't present.
      const isUS = area.toLowerCase().includes('united states');
      const geoLocation = isUS ? area : `${area}, United States`;

      this.logger.log(`Searching Google Maps (Structured): ${query}`);
      const response = await this.httpClient.post('', {
        source: 'google_maps',
        query,
        user_agent_type: 'desktop',
      });

      const content = response.data?.results?.[0]?.content;

      // If Oxylabs returns a parsed object shape, normalize it.
      const structuredResults =
        content?.results?.local_results ||
        content?.results?.organic_results ||
        [];
      if (Array.isArray(structuredResults) && structuredResults.length > 0) {
        return this.normalizeResults(structuredResults);
      }

      // Otherwise treat content as HTML and parse it ourselves.
      return typeof content === 'string' ? this.parseHtmlResults(content) : [];
    } catch (error: any) {
      const status = error?.response?.status;
      const details = error?.response?.data ? JSON.stringify(error.response.data).slice(0, 500) : '';
      this.logger.error(`Google Maps scraping failed${status ? ` (${status})` : ''}: ${error.message}${details ? ` — ${details}` : ''}`);
      return [];
    }
  }

  /**
   * Search for stores near real GPS coordinates using the Google Maps Places API.
   * More accurate than ZIP-based search — finds stores in adjacent ZIPs within radius.
   * Falls back to ZIP-based searchNearbyStores if coordinates are missing or Places API fails.
   * @param lat User latitude
   * @param lng User longitude
   * @param type Store category keyword (e.g. "grocery stores")
   * @param radiusMeters Search radius in meters (default: 16000 ≈ 10 miles)
   */
  async searchNearbyStoresByCoords(
    lat: number,
    lng: number,
    type: string,
    radiusMeters: number = 16000,
  ): Promise<NormalizedGasStation[]> {
    try {
      const apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY');
      if (!apiKey) {
        this.logger.warn('GOOGLE_MAPS_API_KEY not configured — skipping Places API search');
        return [];
      }

      const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
      this.logger.log(`Places API nearby search: lat=${lat}, lng=${lng}, type="${type}", radius=${radiusMeters}m`);

      const response = await axios.get(url, {
        params: {
          location: `${lat},${lng}`,
          radius: radiusMeters,
          keyword: type,
          key: apiKey,
        },
        timeout: 10000,
      });

      const results: any[] = response.data?.results || [];
      this.logger.log(`Places API returned ${results.length} results for "${type}" near (${lat}, ${lng})`);

      return results.map((place: any) => ({
        stationId: place.place_id || `gm-${Buffer.from((place.name || '') + (place.vicinity || '')).toString('base64').substr(0, 12)}`,
        name: place.name || 'Unknown Store',
        address: place.vicinity || '',
        latitude: place.geometry?.location?.lat || 0,
        longitude: place.geometry?.location?.lng || 0,
        logoUrl: null,
        prices: { regular: null, midgrade: null, premium: null, diesel: null },
      }));
    } catch (error: any) {
      this.logger.error(`Places API nearby search failed: ${error.message} — falling back to ZIP search`);
      return [];
    }
  }

  private normalizeResults(results: any[]): NormalizedGasStation[] {
    return results.map(res => ({
      stationId: `gm-${Buffer.from(res.title + res.address).toString('base64').substr(0, 12)}`,
      name: res.title || 'Unknown Store',
      address: res.address || '',
      latitude: res.gps_coordinates?.latitude || 0,
      longitude: res.gps_coordinates?.longitude || 0,
      logoUrl: res.thumbnail || null,
      prices: {
        regular: null,
        midgrade: null,
        premium: null,
        diesel: null,
      },
    }));
  }

  private parseHtmlResults(html: string): NormalizedGasStation[] {
    if (!html) return [];
    const $ = cheerio.load(html);
    const stations: NormalizedGasStation[] = [];

    // Search results in Google Local Pack (Map Pack)
    $('.VkpGBb, div.v7W49e, div.Vkp9Se, div.u950Ad, .tF2Cxc, .C8vY6e, .cX3fhd').each((_, el) => {
      const element = $(el);
      
      // 1. Name
      let name = element.find('.hfpxzc').attr('aria-label') || 
                  element.find('.qBF1Pd').text() || 
                  element.find('.OSrXXb').text() || 
                  element.find('.dbg0pd, h3').first().text() ||
                  'Unknown Station';

      // Clean up name (remove " · Gas station", " · Houston", " - Open 24h", review snippets etc.)
      name = name.split(' · ')[0].split(' - ')[0].split('"')[0].split('\n')[0].trim();

      // 2. Address
      let address = element.find('.W4E7P').first().text() || 
                    element.find('.rllt__details div:nth-child(3)').text() ||
                    element.find('.L8B79d, .yGr79e, .VwiC3b, .t86Sre').first().text() ||
                    'Unknown';
      
      // Clean up address (remove phone numbers like "· (713) 523-6402")
      address = address.split('·')[0].trim();

      // 3. Coordinates
      let latitude = 0;
      let longitude = 0;

      const latAttr = element.find('.hfpxzc').attr('data-latitude');
      const lngAttr = element.find('.hfpxzc').attr('data-longitude');
      
      if (latAttr && lngAttr) {
        latitude = parseFloat(latAttr);
        longitude = parseFloat(lngAttr);
      } else {
        const htmlContext = element.html() || '';
        // Look for @lat,lng or static map URLs or raw lat,lng pairs
        const coordMatch = htmlContext.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || 
                          htmlContext.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
                          htmlContext.match(/(-?\d+\.\d{5,}),(-?\d+\.\d{5,})/); // Raw lat,lng
                          
        if (coordMatch) {
          latitude = parseFloat(coordMatch[1]);
          longitude = parseFloat(coordMatch[2]);
        }
      }

      // Look for price pattern
      const priceEl = element.find('.f3Ucuc');
      const detailsText = priceEl.attr('aria-label') || element.text();
      const priceMatch = detailsText.match(/\$([0-9]\.[0-9]{2})/);
      const price = priceMatch ? parseFloat(priceMatch[1]) : null;

      let regular = null;
      let diesel = null;
      if (detailsText.toLowerCase().includes('diesel')) {
        diesel = price;
      } else {
        regular = price;
      }

      if (name && (price || address || (latitude !== 0))) {
        stations.push({
          stationId: `gm-${Buffer.from(name + address).toString('base64').substr(0, 12)}`,
          name,
          address: address || 'Address not found',
          latitude,
          longitude,
          logoUrl: null,
          prices: {
            regular,
            midgrade: null,
            premium: null,
            diesel,
          },
        });
      }
    });

    // Fallback: If no structured results, try to find anything that looks like a station + price
    if (stations.length === 0) {
      this.logger.warn('Specific selectors failed, trying broader HTML search...');
      const bodyText = $.text();
      const stationsMatch = bodyText.match(/([A-Z][a-z\s]+)\s+\$([0-9]\.[0-9]{2})/g);
      if (stationsMatch) {
        stationsMatch.forEach(match => {
          const [_, n, p] = match.match(/([A-Z][a-z\s]+)\s+\$([0-9]\.[0-9]{2})/) || [];
          if (n && p) {
            stations.push({
              stationId: `gm-fb-${Buffer.from(n).toString('base64').substr(0, 8)}`,
              name: n.trim(),
              address: 'Unknown',
              latitude: 0,
              longitude: 0,
              logoUrl: null,
              prices: {
                regular: parseFloat(p),
                midgrade: null,
                premium: null,
                diesel: null,
              },
            });
          }
        });
      }
    }

    this.logger.log(`Extracted ${stations.length} gas stations from HTML.`);
    return stations;
  }

}
