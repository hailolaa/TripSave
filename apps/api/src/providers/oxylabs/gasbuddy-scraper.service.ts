import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OxylabsBaseService } from './oxylabs-base.service';
import { NormalizedGasStation } from '../../common/interfaces/normalized-gas-price.interface';
import * as cheerio from 'cheerio';

const STATE_NAMES: Record<string, string> = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california',
  CO: 'colorado', CT: 'connecticut', DE: 'delaware', FL: 'florida', GA: 'georgia',
  HI: 'hawaii', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa',
  KS: 'kansas', KY: 'kentucky', LA: 'louisiana', ME: 'maine', MD: 'maryland',
  MA: 'massachusetts', MI: 'michigan', MN: 'minnesota', MS: 'mississippi', MO: 'missouri',
  MT: 'montana', NE: 'nebraska', NV: 'nevada', NH: 'new-hampshire', NJ: 'new-jersey',
  NM: 'new-mexico', NY: 'new-york', NC: 'north-carolina', ND: 'north-dakota', OH: 'ohio',
  OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania', RI: 'rhode-island', SC: 'south-carolina',
  SD: 'south-dakota', TN: 'tennessee', TX: 'texas', UT: 'utah', VT: 'vermont',
  VA: 'virginia', WA: 'washington', WV: 'west-virginia', WI: 'wisconsin', WY: 'wyoming',
  DC: 'washington-dc'
};

export interface ScrapedGasStation extends NormalizedGasStation {
  locality?: string;
  region?: string;
}

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

      const discoveredStations = this.parseApolloStateStations(searchHtml) as ScrapedGasStation[];
      if (discoveredStations.length === 0) {
        this.logger.warn(`[GasBuddy] Found 0 stations in search results for: "${area}"`);
        return [];
      }

      this.logger.log(`[GasBuddy] Discovered ${discoveredStations.length} stations in "${area}". Hydrating prices...`);

      const pricingMap = new Map<string, { regular: number | null; diesel: number | null }>();

      // Group discovered stations by unique city/state combinations
      const cityStatePairs = new Map<string, { city: string; state: string }>();
      for (const station of discoveredStations) {
        if (station.locality && station.region) {
          const key = `${station.locality.toLowerCase()}_${station.region.toLowerCase()}`;
          if (!cityStatePairs.has(key)) {
            cityStatePairs.set(key, { city: station.locality, state: station.region });
          }
        }
      }

      this.logger.debug(`[GasBuddy] Grouped into ${cityStatePairs.size} unique city price page(s) to fetch.`);

      for (const [_, pair] of cityStatePairs.entries()) {
        const stateCode = pair.state.toUpperCase();
        const stateName = STATE_NAMES[stateCode];
        if (!stateName) {
          this.logger.warn(`[GasBuddy] Unsupported state abbreviation: "${stateCode}". Skipping pricing directory parse for ${pair.city}.`);
          continue;
        }

        const cityName = pair.city.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        const capState = stateName.charAt(0).toUpperCase() + stateName.slice(1);
        const stateGeo = `${capState},United States`;

        // Fetch Regular prices (fuel=1)
        try {
          const regularUrl = `https://www.gasbuddy.com/gasprices/${stateName}/${cityName}?fuel=1`;
          this.logger.debug(`[GasBuddy] Fetching Regular prices from city page: ${regularUrl} (using geolocation: ${stateGeo})`);
          
          const regHtml = await this.scrape(regularUrl, {
            render: true,
            geo_location: stateGeo,
          });

          this.parseNearbyPricesFromDom(regHtml, 'regular', pricingMap);
        } catch (e: any) {
          this.logger.error(`[GasBuddy] Failed to fetch Regular prices for ${pair.city}, ${pair.state}: ${e.message}`);
        }

        // Fetch Diesel prices (fuel=4)
        try {
          const dieselUrl = `https://www.gasbuddy.com/gasprices/${stateName}/${cityName}?fuel=4`;
          this.logger.debug(`[GasBuddy] Fetching Diesel prices from city page: ${dieselUrl} (using geolocation: ${stateGeo})`);
          
          const dieselHtml = await this.scrape(dieselUrl, {
            render: true,
            geo_location: stateGeo,
          });

          this.parseNearbyPricesFromDom(dieselHtml, 'diesel', pricingMap);
        } catch (e: any) {
          this.logger.error(`[GasBuddy] Failed to fetch Diesel prices for ${pair.city}, ${pair.state}: ${e.message}`);
        }
      }

      // Step 3: Populate prices back into the discovered stations
      const fullyNormalizedStations = discoveredStations.map(station => {
        const prices = pricingMap.get(station.stationId);
        return {
          stationId: station.stationId,
          name: station.name,
          address: station.address,
          latitude: station.latitude,
          longitude: station.longitude,
          logoUrl: station.logoUrl,
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

      if (validStations.length === 0) {
        this.logger.warn(`[GasBuddy] No stations had price data. Returning empty array to trigger Google Maps scraper fallback.`);
        return [];
      } else {
        this.logger.log(`[GasBuddy] Fully hydrated and returned ${validStations.length}/${discoveredStations.length} stations with price data.`);
      }
      return validStations;

    } catch (err: any) {
      this.logger.error(`[GasBuddy] Scraping failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Parse static Apollo State script block from the search page.
   */
  private parseApolloStateStations(html: string): ScrapedGasStation[] {
    const stations: ScrapedGasStation[] = [];
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
        let locality: string | undefined;
        let region: string | undefined;
        if (s.address) {
          const addr = s.address;
          locality = addr.locality || undefined;
          region = addr.region || undefined;
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
          locality,
          region,
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
   * Parse the main station's own price from the detail page HTML (Apollo State or DOM fallback).
   */
  private parseMainStationPrice(html: string, fuelType: 'regular' | 'diesel'): { regular: number | null; diesel: number | null } {
    const result: { regular: number | null; diesel: number | null } = { regular: null, diesel: null };
    try {
      const $ = cheerio.load(html);
      
      // 1. Try DOM parsing first (most direct and safe)
      let mainPrice: number | null = null;
      
      const priceSelectors = [
        '[class*="PriceSection-module__price"]',
        '[class*="price___"]',
        'span[class*="price"]',
        '.PriceSection-module__price___2l61y'
      ];
      
      for (const selector of priceSelectors) {
        const text = $(selector).first().text().trim();
        if (text) {
          const match = text.match(/\$([0-9]+\.[0-9]+)/);
          if (match) {
            mainPrice = parseFloat(match[1]);
            break;
          }
        }
      }

      if (mainPrice && !isNaN(mainPrice) && mainPrice > 0.1) {
        if (fuelType === 'regular') {
          result.regular = mainPrice;
        } else {
          result.diesel = mainPrice;
        }
        return result;
      }

      // 2. Try Apollo State parsing fallback
      const apolloMatch = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});/);
      if (apolloMatch) {
        const state = JSON.parse(apolloMatch[1]);
        const keys = Object.keys(state);
        const stationKey = keys.find(k => k.startsWith('Station:'));
        if (stationKey && state[stationKey]) {
          const station = state[stationKey];
          if (Array.isArray(station.prices)) {
            for (const priceRef of station.prices) {
              const priceObj = state[priceRef.id];
              if (!priceObj) continue;
              const fuelProduct = priceObj.fuelProduct;
              const creditObj = priceObj.credit ? state[priceObj.credit.id] : null;
              const cashObj = priceObj.cash ? state[priceObj.cash.id] : null;
              const priceVal = creditObj?.price || cashObj?.price;
              if (priceVal) {
                const parsedPrice = parseFloat(priceVal);
                if (fuelProduct === 'regular') {
                  result.regular = parsedPrice;
                } else if (fuelProduct === 'diesel') {
                  result.diesel = parsedPrice;
                }
              }
            }
          }
        }
      }
    } catch (e: any) {
      this.logger.error(`[GasBuddy] Failed to parse main station price: ${e.message}`);
    }
    return result;
  }

  private parseNearbyPricesFromDom(
    html: string,
    fuelType: 'regular' | 'diesel',
    pricingMap: Map<string, { regular: number | null; diesel: number | null }>,
  ): void {
    try {
      const $ = cheerio.load(html);

      const items = $('.GenericStationListItem-module__stationListItem___3Jmn4, [class*="stationListItem"]');
      this.logger.debug(`[GasBuddy] parseNearbyPricesFromDom matched ${items.length} items for fuelType: "${fuelType}"`);

      items.each((idx, el) => {
        const element = $(el);

        // 1. Extract station ID from the href anchor
        const anchor = element.find('a[href*="/station/"]').first();
        const href = anchor.attr('href') || '';
        const idMatch = href.match(/\/station\/(\d+)/);
        if (!idMatch) {
          this.logger.debug(`[GasBuddy] Item ${idx + 1}: No station ID match for href: "${href}"`);
          return;
        }
        const stationId = idMatch[1];

        // 2. Extract price card text and isolate the very first dollar price matching $X.XX
        const priceCard = element.find('[class*="priceCard"], [class*="PriceCard"]').first();
        const priceCardText = priceCard.text().trim();
        if (!priceCardText) {
          this.logger.debug(`[GasBuddy] Item ${idx + 1} (${stationId}): Empty priceCardText`);
          return;
        }
        if (priceCardText.includes('- - -')) {
          this.logger.debug(`[GasBuddy] Item ${idx + 1} (${stationId}): Price card has no price indicator (- - -)`);
          return;
        }

        const priceMatch = priceCardText.match(/\$([0-9]+\.[0-9]+)/);
        if (!priceMatch) {
          this.logger.debug(`[GasBuddy] Item ${idx + 1} (${stationId}): Price regex mismatch for: "${priceCardText}"`);
          return;
        }

        const price = parseFloat(priceMatch[1]);
        if (isNaN(price) || price <= 0.1) {
          this.logger.debug(`[GasBuddy] Item ${idx + 1} (${stationId}): Parsed price is invalid: ${price}`);
          return;
        }

        this.logger.debug(`[GasBuddy] Parsed price: ${price} for stationId: ${stationId} (fuel: ${fuelType})`);

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
