import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OxylabsBaseService, ScrapedProduct } from './oxylabs-base.service';
import { geocodePlace } from '../../utils/geocoding.util';

/**
 * Scrapes Instacart.com search results via Oxylabs.
 * This covers secondary stores: Aldi, Costco, Sam's Club, Publix,
 * Albertsons, Safeway, Sprouts, Meijer, H-E-B, Food Lion, Giant,
 * Stop & Shop, ShopRite, etc.
 */
@Injectable()
export class InstacartScraperService extends OxylabsBaseService {
  protected readonly logger = new Logger(InstacartScraperService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  async search(query: string, zip?: string): Promise<ScrapedProduct[]> {
    const url = `https://www.instacart.com/store/s?k=${encodeURIComponent(query)}`;
    this.logger.log(`Scraping Instacart for "${query}"`);

    try {
      let geoLocation: string | undefined = zip;
      
      // If ZIP is numeric (5 digits), try to resolve to a city name for Instacart
      // as Instacart search often fails with raw numeric ZIPs in Oxylabs geo_location.
      if (zip && /^\d{5}$/.test(zip)) {
        try {
          const geo = await geocodePlace(zip);
          if (geo && geo.displayName) {
            // Extract "City, State" from Nominatim display name
            const parts = geo.displayName.split(',').map(p => p.trim());
            // Nominatim often starts with the house number or zip if searched by zip
            const cityPart = /^\d+$/.test(parts[0]) ? parts[1] : parts[0];
            const statePart = /^\d+$/.test(parts[0]) ? parts[3] || parts[2] : parts[1];
            
            if (cityPart && statePart) {
              geoLocation = `${cityPart},${statePart},United States`;
              this.logger.debug(`Resolved ZIP ${zip} to "${geoLocation}" for Instacart`);
            }
          }
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          this.logger.warn(`Failed to resolve ZIP ${zip} to city: ${message}`);
        }
      }

      this.logger.log(`Instacart: scraping "${query}" in ${geoLocation || 'default'}...`);
      const html = await this.scrape('', {
        source: 'instacart_search',
        query,
        render: true,
        geo_location: geoLocation || undefined,
      });

      return this.parse(html);
    } catch (err: unknown) {
      const status = (err as any)?.response?.status;
      if (status === 401) {
        this.logger.warn(
          `Instacart scraper returned 401 for "${query}" — keeping existing DB data.`,
        );
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      const responseData = (err as any)?.response?.data;
      this.logger.error(
        `Instacart scrape failed: ${message} - ${responseData ? JSON.stringify(responseData) : ''}`,
      );
      return [];
    }
  }

  private parse(html: any): ScrapedProduct[] {
    const products: ScrapedProduct[] = [];

    // 1. Try to handle Oxylabs Structured Results (if parse: true succeeded)
    if (typeof html === 'object' && html !== null) {
      try {
        const items = html.results || [];
        for (const item of items) {
          const price = this.parsePrice(item.price);
          let storeName = this.cleanStoreName(item.retailer || 'Instacart');
          
          if (price > 0 && item.title) {
            products.push({
              store: storeName,
              product: item.title,
              price,
              image: item.image || '',
              source: 'instacart',
            });
          }
        }
        if (products.length > 0) {
          this.logger.log(`Instacart: parsed ${products.length} products from structured data`);
          return products;
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        this.logger.warn(`Failed to parse Instacart structured data: ${message}`);
      }
      return [];
    }

    if (typeof html !== 'string' || !html) return [];

    // 2. Handle Raw HTML using Cheerio (much more robust than regex)
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);

    // Check for real Instacart bot blocks
    const isBlocked = ($('title').text().includes('Security') || html.includes('Press & Hold')) && 
                     !$('li[data-testid^="item_list_item"]').length;

    if (isBlocked) {
       this.logger.warn(`Instacart returned a Captcha/Challenge page. Oxylabs proxy was blocked.`);
       return [];
    }

    // Find all item list items
    $('li[data-testid^="item_list_item"]').each((_: number, el: any) => {
      const block = $(el);
      
      // Extract Price (usually in screen-reader-only span)
      let priceText = block.find('.screen-reader-only').text() || 
                      block.find('[aria-label*="price"]').attr('aria-label') ||
                      block.text();
      
      const priceMatch = priceText.match(/price:? \$(\d+\.\d{2})/i) || priceText.match(/\$(\d+\.\d{2})/);
      const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

      // Extract Name
      let name = block.find('img[data-testid="item-card-image"]').attr('alt') || 
                 block.find('div[role="heading"]').text() ||
                 block.find('h3').text();
      
      // Clean up name (remove "Image of ")
      if (name) name = name.replace(/^Image of /i, '').trim();

      // Extract Store/Retailer
      let storeName = '';
      
      // 1. Try to find retailer slug in the item's own links (most accurate for cross-retailer search)
      const itemLink = block.find('a[href*="retailerSlug="]').first().attr('href');
      if (itemLink) {
        const slugMatch = itemLink.match(/retailerSlug=([^&?]+)/);
        if (slugMatch) {
          storeName = slugMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        }
      }

      // 2. Fallback: look for a logo img within the block
      if (!storeName) {
        const blockLogo = block.find('img[alt*=" logo"]').first().attr('alt');
        if (blockLogo) {
          storeName = blockLogo.replace(/ logo$/i, '');
        }
      }

      // 3. Last resort: look for a global logo on the page (might be a single-retailer search)
      if (!storeName) {
        const globalLogo = $('img[alt*=" logo"]').first().attr('alt');
        if (globalLogo) {
          storeName = globalLogo.replace(/ logo$/i, '');
        }
      }

      if (price > 0 && name) {
        products.push({
          store: this.cleanStoreName(storeName || 'Instacart'),
          product: name,
          price,
          image: block.find('img').attr('src') || '',
          source: 'instacart',
        });
      }
    });

    if (products.length === 0) {
      this.logger.warn(`Instacart: failed to parse any products from ${html.length} chars of HTML. Title: ${$('title').text()}`);
    } else {
      this.logger.log(`Instacart: successfully parsed ${products.length} products using Cheerio`);
    }

    return products.slice(0, 20);
  }
}
