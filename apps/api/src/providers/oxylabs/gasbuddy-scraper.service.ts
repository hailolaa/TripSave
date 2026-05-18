import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OxylabsBaseService } from './oxylabs-base.service';
import { NormalizedGasStation } from '../../common/interfaces/normalized-gas-price.interface';
import * as cheerio from 'cheerio';

/**
 * Scraper for GasBuddy using the Oxylabs Universal Scraper.
 * Combines ultra-fast no-render discovery with targeted JS-rendered detail page extraction.
 */
@Injectable()
export class GasBuddyScraperService extends OxylabsBaseService {
  protected readonly logger = new Logger(GasBuddyScraperService.name);

  constructor(protected readonly configService: ConfigService) {
    super(configService);
  }

  /**
   * Search for gas stations and their prices in a given area.
   * Matches GoogleMapsGasScraperService interface for simple drop-in capability.
   */
  async searchNearbyStores(area: string, type?: string): Promise<NormalizedGasStation[]> {
    this.logger.log(`[GasBuddy] Scraping gas stations in: "${area}"`);

    try {
      // Step 1: Discover stations from search page Apollo State (no-render, ultra fast & reliable)
      const searchUrl = `https://www.gasbuddy.com/home?search=${encodeURIComponent(area)}`;
      this.logger.debug(`[GasBuddy] Fetching search list via Oxylabs: ${searchUrl}`);
      
      const searchHtml = await this.scrape(searchUrl, {
        render: false,
        geo_location: 'United States',
      });

      const discoveredStations = this.parseApolloStateStations(searchHtml);
      if (discoveredStations.length === 0) {
        this.logger.warn(`[GasBuddy] Found 0 stations in search results for: "${area}"`);
        return [];
      }

      this.logger.log(`[GasBuddy] Discovered ${discoveredStations.length} stations in "${area}". Hydrating prices...`);

      // Step 2: Determine hub stations to query for nearby price lists
      // We will select the first 2 stations to act as central hubs.
      const hubs = discoveredStations.slice(0, 2);
      const pricingMap = new Map<string, { regular: number | null; diesel: number | null }>();

      // Check if any station in the area has diesel capability
      const hasDieselStations = discoveredStations.some(s => s.prices.diesel === null); // We initially set diesel to null, let's look at their capability or just query it

      for (const hub of hubs) {
        // Fetch Regular prices (fuel=1)
        try {
          const regularUrl = `https://www.gasbuddy.com/station/${hub.stationId}?fuel=1`;
          this.logger.debug(`[GasBuddy] Fetching Regular prices from hub ${hub.name} (${hub.stationId})`);
          
          const regHtml = await this.scrape(regularUrl, {
            render: true,
            geo_location: 'United States',
          });

          this.parseNearbyPricesFromDom(regHtml, 'regular', pricingMap);
        } catch (e: any) {
          this.logger.error(`[GasBuddy] Failed to fetch Regular prices from hub ${hub.stationId}: ${e.message}`);
        }

        // Fetch Diesel prices (fuel=4)
        try {
          const dieselUrl = `https://www.gasbuddy.com/station/${hub.stationId}?fuel=4`;
          this.logger.debug(`[GasBuddy] Fetching Diesel prices from hub ${hub.name} (${hub.stationId})`);
          
          const dieselHtml = await this.scrape(dieselUrl, {
            render: true,
            geo_location: 'United States',
          });

          this.parseNearbyPricesFromDom(dieselHtml, 'diesel', pricingMap);
        } catch (e: any) {
          this.logger.error(`[GasBuddy] Failed to fetch Diesel prices from hub ${hub.stationId}: ${e.message}`);
        }
      }

      // Step 3: Populate prices back into the discovered stations
      const fullyNormalizedStations = discoveredStations.map(station => {
        const prices = pricingMap.get(station.stationId);
        return {
          ...station,
          prices: {
            regular: prices?.regular || null,
            midgrade: null,
            premium: null,
            diesel: prices?.diesel || null,
          },
        };
      });

      // Filter out stations with zero prices to maintain pristine data quality
      const validStations = fullyNormalizedStations.filter(s => s.prices.regular !== null || s.prices.diesel !== null);

      this.logger.log(`[GasBuddy] Fully hydrated and returned ${validStations.length}/${discoveredStations.length} stations with price data.`);
      return validStations;

    } catch (err: any) {
      this.logger.error(`[GasBuddy] Scraping failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Parse static Apollo State script block from the search page.
   */
  private parseApolloStateStations(html: string): NormalizedGasStation[] {
    const stations: NormalizedGasStation[] = [];
    try {
      const apolloMatch = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});/);
      if (!apolloMatch) return [];

      const state = JSON.parse(apolloMatch[1]);
      const keys = Object.keys(state);

      const stationKeys = keys.filter(k => k.startsWith('Station:'));
      for (const key of stationKeys) {
        const s = state[key];
        if (!s || !s.id || !s.name) continue;

        // Extract address details
        let addressStr = 'Unknown';
        if (s.address) {
          const addr = s.address;
          addressStr = `${addr.line1 || ''}, ${addr.locality || ''}, ${addr.region || ''} ${addr.postalCode || ''}`.replace(/\s+/g, ' ').trim();
        }

        // Extract coordinates
        const latitude = s.latitude ? Number(s.latitude) : 0;
        const longitude = s.longitude ? Number(s.longitude) : 0;

        // Extract logo/brand Url
        let logoUrl = null;
        if (Array.isArray(s.brands) && s.brands.length > 0) {
          logoUrl = s.brands[0].imageUrl || null;
        }

        stations.push({
          stationId: s.id,
          name: s.name,
          address: addressStr,
          latitude,
          longitude,
          logoUrl,
          prices: {
            regular: null,
            midgrade: null,
            premium: null,
            diesel: null,
          },
        });
      }
    } catch (e: any) {
      this.logger.error(`[GasBuddy] Failed to parse Apollo State: ${e.message}`);
    }
    return stations;
  }

  /**
   * Parse the DOM prices for the nearby list in a JS-rendered station HTML.
   */
  private parseNearbyPricesFromDom(
    html: string,
    fuelType: 'regular' | 'diesel',
    pricingMap: Map<string, { regular: number | null; diesel: number | null }>,
  ): void {
    try {
      const $ = cheerio.load(html);

      // Find all generic station list items (nearby stations list)
      $('.GenericStationListItem-module__stationListItem___3Jmn4, [class*="stationListItem"]').each((_, el) => {
        const element = $(el);

        // 1. Extract station ID from the href anchor
        const anchor = element.find('a[href*="/station/"]').first();
        const href = anchor.attr('href') || '';
        const idMatch = href.match(/\/station\/(\d+)/);
        if (!idMatch) return;
        const stationId = idMatch[1];

        // 2. Extract price
        const priceCard = element.find('[class*="priceCard"], [class*="PriceCard"]').first();
        const priceText = priceCard.find('[class*="price"], [class*="Price"]').first().text().trim();
        if (!priceText || priceText === '- - -') return;

        const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        if (isNaN(price) || price <= 0.1) return;

        // 3. Store in pricing map
        const existing = pricingMap.get(stationId) || { regular: null, diesel: null };
        if (fuelType === 'regular') {
          existing.regular = price;
        } else {
          existing.diesel = price;
        }
        pricingMap.set(stationId, existing);
      });
    } catch (e: any) {
      this.logger.error(`[GasBuddy] Failed to parse nearby DOM prices: ${e.message}`);
    }
  }
}
