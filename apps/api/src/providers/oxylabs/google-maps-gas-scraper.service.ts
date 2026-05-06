import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    this.logger.log(`Searching Google Maps (Structured): ${query}`);

    try {
      const response = await this.httpClient.post('', {
        source: 'google_maps',
        geo_location: 'United States',
        query: query,
        parse: true, // Enable Oxylabs automatic parsing
      });

      const results = response.data?.results?.[0]?.content?.results?.local_results || 
                     response.data?.results?.[0]?.content?.results?.organic_results || [];
      
      if (results.length > 0) {
        return this.normalizeResults(results);
      }

      // Fallback to HTML parsing if structured data is missing
      const html = response.data?.results?.[0]?.content || '';
      return typeof html === 'string' ? this.parseHtmlResults(html) : [];
    } catch (error: any) {
      this.logger.error(`Google Maps scraping failed: ${error.message}`);
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
      
      // Try multiple selectors for name
      let name = element.find('.dbg0pd, h3, .OSrXXb, .rllt__details span, .VwiC3b, .uJ337c').first().text().trim();
      
      // Try multiple selectors for address
      let address = element.find('.rllt__details div:nth-child(3), .L8B79d, .yGr79e, .VwiC3b, .t86Sre').text().trim();
      
      // Attempt to extract latitude/longitude from data attributes or links
      let latitude = 0;
      let longitude = 0;
      
      // Some elements have data-lat/data-lng
      const latAttr = element.attr('data-lat') || element.find('[data-lat]').attr('data-lat');
      const lngAttr = element.attr('data-lng') || element.find('[data-lng]').attr('data-lng');
      
      if (latAttr && lngAttr) {
        latitude = parseFloat(latAttr);
        longitude = parseFloat(lngAttr);
      } else {
        // Look in links (e.g. Google Maps links often have coordinates)
        const mapLink = element.find('a[href*="/maps/"], a[href*="google.com/maps"]').attr('href');
        if (mapLink) {
          // Patterns: @lat,lng or !3d...!4d...
          const coordMatch = mapLink.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || 
                            mapLink.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
          if (coordMatch) {
            latitude = parseFloat(coordMatch[1]);
            longitude = parseFloat(coordMatch[2]);
          }
        }
      }

      // If we still don't have coordinates, try to find them in the entire element's HTML/attributes
      if (latitude === 0) {
        const htmlContext = element.html() || '';
        // Look for @lat,lng or static map URLs in attributes
        const deepMatch = htmlContext.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || 
                         htmlContext.match(/center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/) ||
                         htmlContext.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
                         
        if (deepMatch) {
          latitude = parseFloat(deepMatch[1]);
          longitude = parseFloat(deepMatch[2]);
        } else {
          // Final attempt: any pair of numbers that look like coordinates
          const latMatch = htmlContext.match(/(-?\d+\.\d+),(-?\d+\.\d+)/);
          if (latMatch && Math.abs(parseFloat(latMatch[1])) < 90 && Math.abs(parseFloat(latMatch[2])) < 180) {
            latitude = parseFloat(latMatch[1]);
            longitude = parseFloat(latMatch[2]);
          }
        }
      }

      // Look for price pattern
      const priceEl = element.find('.f3Ucuc');
      const detailsText = priceEl.attr('aria-label') || element.text();
      const priceMatch = detailsText.match(/\$([0-9]\.[0-9]{2})/);
      const price = priceMatch ? parseFloat(priceMatch[1]) : null;

      if (name && (price || address || (latitude !== 0))) {
        stations.push({
          stationId: `gm-${Buffer.from(name + address).toString('base64').substr(0, 12)}`,
          name,
          address: address || 'Address not found',
          latitude,
          longitude,
          logoUrl: null,
          prices: {
            regular: price,
            midgrade: null,
            premium: null,
            diesel: null,
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
