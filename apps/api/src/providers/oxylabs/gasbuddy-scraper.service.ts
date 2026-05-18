import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OxylabsBaseService } from './oxylabs-base.service';
import { NormalizedGasStation } from '../../common/interfaces/normalized-gas-price.interface';

/**
 * Scraper for GasBuddy using the Oxylabs Universal Scraper and direct GraphQL API integration.
 * Extremely fast, highly reliable, and resolves both Regular and Diesel prices in a single request.
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
    this.logger.log(`[GasBuddy] Querying GasBuddy GraphQL API for area: "${area}"`);

    try {
      const graphqlUrl = 'https://www.gasbuddy.com/graphql';

      // We query BOTH regular and diesel prices in parallel using GraphQL aliases to get pristine data in one go!
      const query = `
        query LocationByArea($area: String, $countryCode: String, $criteria: Criteria, $lang: String, $regionCode: String) {
          regularArea: locationByArea(area: $area, countryCode: $countryCode, criteria: $criteria, regionCode: $regionCode) {
            stations(fuel: 1) {
              results {
                id
                name
                latitude
                longitude
                address {
                  line1
                  line2
                  locality
                  postalCode
                  region
                  country
                }
                prices(fuel: 1) {
                  fuelType
                  cash { price }
                  credit { price }
                }
              }
            }
          }
          dieselArea: locationByArea(area: $area, countryCode: $countryCode, criteria: $criteria, regionCode: $regionCode) {
            stations(fuel: 4) {
              results {
                id
                prices(fuel: 4) {
                  fuelType
                  cash { price }
                  credit { price }
                }
              }
            }
          }
        }
      `;

      const variables = {
        area,
        countryCode: 'US',
        lang: 'en',
      };

      const responseStr = await this.scrape(graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        context: [
          {
            key: 'force_headers',
            value: true,
          },
        ],
        post_data: JSON.stringify({
          operationName: 'LocationByArea',
          query,
          variables,
        }),
        geo_location: 'United States',
      });

      if (!responseStr) {
        this.logger.warn(`[GasBuddy] Empty GraphQL response received for: "${area}"`);
        return [];
      }

      const dataObj = JSON.parse(responseStr);
      
      if (dataObj.errors) {
        this.logger.error(`[GasBuddy] GraphQL errors returned: ${JSON.stringify(dataObj.errors)}`);
        return [];
      }

      const regularStations = dataObj?.data?.regularArea?.stations?.results || [];
      const dieselStations = dataObj?.data?.dieselArea?.stations?.results || [];

      this.logger.log(`[GasBuddy] API returned ${regularStations.length} regular stations and ${dieselStations.length} diesel records.`);

      // Map diesel prices by station ID
      const dieselMap = new Map<string, number | null>();
      for (const ds of dieselStations) {
        if (!ds.id) continue;
        const prices = ds.prices || [];
        const dieselPriceObj = prices.find((p: any) => p.fuelType === 'diesel' || p.fuelType === 4 || String(p.fuelType).toLowerCase() === 'diesel');
        const priceVal = dieselPriceObj?.credit?.price || dieselPriceObj?.cash?.price || null;
        if (priceVal) {
          dieselMap.set(ds.id, parseFloat(priceVal));
        }
      }

      const stations: NormalizedGasStation[] = [];
      for (const rs of regularStations) {
        if (!rs.id || !rs.name) continue;

        const prices = rs.prices || [];
        const regPriceObj = prices.find((p: any) => p.fuelType === 'regular' || p.fuelType === 1 || String(p.fuelType).toLowerCase() === 'regular');
        const regPriceVal = regPriceObj?.credit?.price || regPriceObj?.cash?.price || null;
        const regPrice = regPriceVal ? parseFloat(regPriceVal) : null;
        const dieselPrice = dieselMap.get(rs.id) || null;

        // Build a formatted street address
        let addressStr = 'Address not found';
        if (rs.address) {
          const addr = rs.address;
          addressStr = `${addr.line1 || ''}, ${addr.locality || ''}, ${addr.region || ''} ${addr.postalCode || ''}`.replace(/\s+/g, ' ').trim();
          if (!addressStr || addressStr === ',') {
            addressStr = 'Address not found';
          }
        }

        stations.push({
          stationId: rs.id,
          name: rs.name,
          address: addressStr,
          latitude: rs.latitude ? Number(rs.latitude) : 0,
          longitude: rs.longitude ? Number(rs.longitude) : 0,
          logoUrl: null,
          prices: {
            regular: regPrice,
            midgrade: null,
            premium: null,
            diesel: dieselPrice,
          },
        });
      }

      // Filter out stations with zero prices to maintain pristine data quality
      const validStations = stations.filter(s => s.prices.regular !== null || s.prices.diesel !== null);

      if (validStations.length === 0) {
        this.logger.warn(`[GasBuddy] No stations had valid price data. Returning empty array to trigger Google Maps scraper fallback.`);
        return [];
      }

      this.logger.log(`[GasBuddy] Successfully resolved ${validStations.length}/${stations.length} stations with prices.`);
      return validStations;

    } catch (err: any) {
      this.logger.error(`[GasBuddy] Scraping via GraphQL failed: ${err.message}`);
      return [];
    }
  }
}
