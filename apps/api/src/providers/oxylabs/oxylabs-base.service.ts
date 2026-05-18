import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * Normalized product shape returned by all scrapers.
 */
export interface ScrapedProduct {
  store: string;
  product: string;
  price: number;
  image: string;
  source: 'oxylabs' | 'instacart' | 'direct' | 'google_maps' | 'gasbuddy';
  category?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

/**
 * Base Oxylabs HTTP client.
 * All individual store scrapers extend this to share auth and configuration.
 */
@Injectable()
export class OxylabsBaseService {
  protected readonly logger = new Logger(OxylabsBaseService.name);
  protected readonly httpClient: AxiosInstance;
  private readonly username: string;
  private readonly password: string;

  constructor(protected readonly configService: ConfigService) {
    this.username = this.configService.get<string>('OXYLABS_USERNAME', '');
    this.password = this.configService.get<string>('OXYLABS_PASSWORD', '');

    this.httpClient = axios.create({
      baseURL: 'https://realtime.oxylabs.io/v1/queries',
      timeout: 150000, // Increase to 150s for slow rendering + retries
      auth: {
        username: this.username,
        password: this.password,
      },
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /** Check if Oxylabs credentials are configured */
  isConfigured(): boolean {
    return !!(this.username && this.password);
  }

  /**
   * Execute an Oxylabs Web Scraper request.
   * Returns raw HTML content for parsing.
   */
  protected async scrape(url: string, options: {
    render?: boolean;
    geo_location?: string;
    parse?: boolean;
    source?: string;
    query?: string;
    render_parameters?: any;
    browser_instructions?: any[];
    method?: string;
    post_data?: string;
    headers?: Record<string, string>;
  } = {}): Promise<string> {
    const payload: any = {
      source: options.source || 'universal',
      url: url || undefined, // URL might be empty if using query
      query: options.query,
      render: options.render ? 'html' : undefined,
      parse: options.parse || undefined,
      geo_location: options.geo_location,
      browser_instructions: options.browser_instructions,
      method: options.method,
      post_data: options.post_data,
      headers: options.headers,
    };

    // Remove undefined keys
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    this.logger.debug(`Oxylabs Payload: ${JSON.stringify(payload)}`);

    this.logger.debug(`Sending Oxylabs request: ${url || options.query}`);

    let lastError: any;
    for (let i = 0; i < 2; i++) { // Try up to 2 times
      try {
        const response = await this.httpClient.post('', payload);

        // Oxylabs returns results array; take first result's content
        const results = response.data?.results;
        if (!results || results.length === 0) {
          throw new Error('Oxylabs returned no results');
        }

        return results[0].content || '';
      } catch (err: any) {
        lastError = err;
        const isRetryable = err.response?.status === 429 || 
                            err.code === 'ECONNRESET' || 
                            err.code === 'ETIMEDOUT' ||
                            !err.response; // Generic network error

        if (isRetryable && i < 1) { // Only retry once
          this.logger.warn(`Oxylabs request failed (${err.code || err.response?.status}), retrying in 5s...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  /**
   * Parse a price string like "$3.97" or "3.97" into a float.
   */
  protected parsePrice(raw: any): number {
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const cleaned = raw.replace(/[^0-9.]/g, '');
      return parseFloat(cleaned) || 0;
    }
    return 0;
  }

  /**
   * Clean a store name by removing trademark symbols and trimming.
   */
  protected cleanStoreName(name: string): string {
    if (!name) return 'Unknown';
    return name.replace(/[®™©]/g, '').trim();
  }
}
