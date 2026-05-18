import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class EiaDieselService {
  private readonly logger = new Logger(EiaDieselService.name);
  // Cache prices by PADD code to avoid hitting the EIA API repeatedly
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

  constructor(private readonly configService: ConfigService) {}

  /**
   * Maps a standard US State code to the correct EIA PADD/Region code
   */
  private getStateRegionCode(stateCode: string): string {
    const code = stateCode.toUpperCase().trim();
    
    // Exact state matches that have dedicated EIA codes
    if (code === 'CA' || code === 'CALIFORNIA') return 'SCA'; // California has its own distinct market
    
    // PADD 1: East Coast
    if (['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'PA', 'NJ', 'DE', 'MD', 'VA', 'NC', 'SC', 'GA', 'FL', 'WV'].includes(code)) return 'R10';
    // PADD 2: Midwest
    if (['ND', 'SD', 'NE', 'KS', 'OK', 'MN', 'IA', 'MO', 'WI', 'IL', 'MI', 'IN', 'OH', 'KY', 'TN'].includes(code)) return 'R20';
    // PADD 3: Gulf Coast
    if (['TX', 'NM', 'AR', 'LA', 'MS', 'AL'].includes(code)) return 'R30';
    // PADD 4: Rocky Mountain
    if (['MT', 'ID', 'WY', 'UT', 'CO'].includes(code)) return 'R40';
    // PADD 5: West Coast (Excluding CA which is handled above)
    if (['WA', 'OR', 'NV', 'AZ', 'AK', 'HI'].includes(code)) return 'R50';

    return 'NUS'; // Default to U.S. National Average if state is unknown
  }

  /**
   * Fetches the official Weekly Retail Diesel Price from the EIA API for a given region.
   */
  async getRegionalDieselPrice(stateCode: string): Promise<number | null> {
    const apiKey = this.configService.get<string>('EIA_API_KEY') || 'IeDIPOo0GoQdYp093SkVmsdFS6ZainwYYta3lQfZ';
    if (!apiKey) {
      this.logger.warn('No EIA_API_KEY found, unable to fetch official diesel prices.');
      return null;
    }

    const regionCode = this.getStateRegionCode(stateCode);

    // Check Cache
    const cached = this.priceCache.get(regionCode);
    if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL_MS)) {
      return cached.price;
    }

    try {
      const url = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${apiKey}&frequency=weekly&data[]=value&facets[product][]=EPD2DXL0&facets[duoarea][]=${regionCode}&sort[0][column]=period&sort[0][direction]=desc&length=1`;
      
      const response = await axios.get(url, { timeout: 10000 });
      const data = response.data?.response?.data;
      
      if (data && data.length > 0 && data[0].value) {
        const price = parseFloat(data[0].value);
        if (!isNaN(price)) {
          this.priceCache.set(regionCode, { price, timestamp: Date.now() });
          this.logger.debug(`Cached EIA Diesel Price for Region ${regionCode}: $${price}`);
          return price;
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to fetch EIA Diesel price for ${regionCode}: ${error.message}`);
    }

    return null;
  }
}
