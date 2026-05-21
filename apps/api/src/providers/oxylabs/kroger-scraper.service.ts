import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OxylabsBaseService, ScrapedProduct } from './oxylabs-base.service';

/**
 * Scrapes Kroger.com product search results via Oxylabs.
 */
@Injectable()
export class KrogerScraperService extends OxylabsBaseService {
  protected readonly logger = new Logger(KrogerScraperService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  async search(query: string, zip?: string): Promise<ScrapedProduct[]> {
    const url = `https://www.kroger.com/search?query=${encodeURIComponent(query)}&searchType=default_search`;
    this.logger.log(`Scraping Kroger for "${query}"`);

    try {
      const html = await this.scrape(url, {
        source: 'universal',
        render: true,
        geo_location: zip || undefined,
      });

      return this.parse(html);
    } catch (err: any) {
      this.logger.error(`Kroger scrape failed: ${err.message}`);
      return [];
    }
  }

  private parse(html: string): ScrapedProduct[] {
    const products: ScrapedProduct[] = [];

    // Kroger has changed their SPA structure. They often embed product data in __INITIAL_STATE__
    // or as raw JSON chunks scattered in the HTML.
    
    // New Kroger SSR DOM Structure
    try {
      // Split the HTML into individual product cells
      const cells = html.split('data-testid="auto-grid-cell"');
      const seen = new Set();
      
      for (let i = 1; i < cells.length; i++) {
        if (products.length >= 15) break;
        const cell = cells[i];
        
        // Skip non-product cards like "Guaranteed Fresh" banners
        if (cell.includes('NonProductCard')) continue;

        // Extract Price: <data value="2.49" typeof="Price"
        const priceMatch = cell.match(/<data value="(\d+\.\d{2})"/);
        let price = 0;
        if (priceMatch) {
          price = parseFloat(priceMatch[1]);
        }

        // Extract Name: <img ... alt="Product Name" ...> or aria-label on the link
        let nameMatch = cell.match(/<img[^>]*alt="([^"]+)"/);
        let name = '';
        if (nameMatch && nameMatch[1] && !nameMatch[1].includes('Image of')) {
          name = nameMatch[1];
        } else {
          // Fallback to title link aria-label
          const titleMatch = cell.match(/data-testid="cart-page-item-description"[^>]*>([^<]+)</);
          if (titleMatch) name = titleMatch[1];
        }

        if (price > 0 && name && !seen.has(name)) {
          seen.add(name);
          products.push({
            store: 'Kroger',
            product: name.trim(),
            price,
            image: '',
            source: 'oxylabs'
          });
        }
      }
    } catch (e: any) {
      this.logger.debug(`Kroger DOM parsing failed: ${e.message}`);
    }

    // Fallback: Extremely loose regex looking for anything that looks like a product (JSON chunks)
    if (products.length === 0) {
      const looseRegex = /"description":"([^"]{5,80})"[^}]*?"(?:price|regular|promo)":(\d+\.\d{2})/gi;
      let match;
      const seen = new Set();
      while ((match = looseRegex.exec(html)) !== null) {
        if (products.length >= 15) break;
        const name = match[1].replace(/\\u[0-9A-Fa-f]{4}/g, '').trim();
        if (!seen.has(name) && !name.includes('Policy') && !name.includes('Center')) {
          seen.add(name);
          products.push({
            store: 'Kroger',
            product: name,
            price: parseFloat(match[2]),
            image: '',
            source: 'oxylabs'
          });
        }
      }
    }

    this.logger.log(`Kroger: parsed ${products.length} products`);
    return products.slice(0, 15);
  }
}
