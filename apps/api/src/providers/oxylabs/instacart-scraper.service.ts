import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OxylabsBaseService, ScrapedProduct } from './oxylabs-base.service';

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
      const html = await this.scrape('', {
        source: 'instacart_search',
        query,
        render: true,
        geo_location: zip ? `US-${zip}` : undefined,
      });

      return this.parse(html);
    } catch (err: any) {
      this.logger.error(`Instacart scrape failed: ${err.message}`);
      return [];
    }
  }

  private parse(html: string): ScrapedProduct[] {
    const products: ScrapedProduct[] = [];

    if (html.includes('captcha') || html.includes('challenge') || html.includes('Press & Hold')) {
       this.logger.warn(`Instacart returned a Captcha/Challenge page. Oxylabs proxy was blocked.`);
       return [];
    }

    // Instacart embeds product data in __NEXT_DATA__ or window.__APOLLO_STATE__
    try {
      const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextDataMatch) {
        const data = JSON.parse(nextDataMatch[1]);
        // Navigate Instacart's nested structure
        const pageProps = data?.props?.pageProps;
        const items = pageProps?.searchData?.items ||
                      pageProps?.initialData?.data?.search?.items ||
                      [];
        for (const item of items) {
          const price = this.parsePrice(item.price || item.viewSection?.itemPrice || item.pricing?.price);
          const storeName = item.retailerName || item.storeName || item.retailer?.name || '';
          if (price > 0 && storeName) {
            products.push({
              store: storeName,
              product: item.name || item.title || '',
              price,
              image: item.imageUrl || item.image?.url || '',
              source: 'instacart',
            });
          }
        }
      }
    } catch { /* ignore JSON parse errors */ }

    // Fallback: Apollo state cache
    if (products.length === 0) {
      try {
        const apolloMatch = html.match(/window\.__APOLLO_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/);
        if (apolloMatch) {
          const apolloData = JSON.parse(apolloMatch[1]);
          for (const key of Object.keys(apolloData)) {
            const entry = apolloData[key];
            if (entry?.name && entry?.price && entry?.retailerName) {
              products.push({
                store: entry.retailerName,
                product: entry.name,
                price: this.parsePrice(entry.price),
                image: entry.imageUrl || '',
                source: 'instacart',
              });
            }
          }
        }
      } catch { /* ignore */ }
    }

    // Fallback: New Instacart DOM Structure (Screen Reader Spans)
    if (products.length === 0) {
      try {
        const blocks = html.match(/<li[^>]*data-testid="item_list_item[^>]*>([\s\S]+?)<\/li>/gi) || [];
        const seen = new Set();
        for (const block of blocks) {
          if (products.length >= 20) break;
          const priceMatch = block.match(/Current price: \$(\d+\.\d{2})/);
          let price = 0;
          if (priceMatch) {
            price = parseFloat(priceMatch[1]);
          }

          let nameMatch = block.match(/alt="([^"]+)"/);
          let name = '';
          if (nameMatch && nameMatch[1] && !nameMatch[1].includes('logo')) {
            name = nameMatch[1];
          } else {
            const headingMatch = block.match(/<div[^>]*role="heading"[^>]*>([^<]+)<\/div>/);
            if (headingMatch) name = headingMatch[1];
          }

          let storeMatch = html.match(/alt="([^"]+) logo"/);
          let storeName = storeMatch ? storeMatch[1] : 'Instacart';

          if (price > 0 && name && !seen.has(name)) {
            seen.add(name);
            products.push({
              store: storeName,
              product: name,
              price,
              image: '',
              source: 'instacart',
            });
          }
        }
      } catch { /* ignore */ }
    }

    // Generic HTML fallback (Extremely Loose Regex)
    if (products.length === 0) {
      const looseRegex = /(?:Current price: \$|"price":|itemPrice":)(\d+\.\d{2})[\s\S]{0,300}?(?:alt="([^"]+)"|role="heading"[^>]*>([^<]+)<\/div>|"name":"([^"]+)")/gi;
      let match;
      const seen = new Set();
      while ((match = looseRegex.exec(html)) !== null) {
        if (products.length >= 20) break;
        const name = (match[2] || match[3] || match[4] || '').replace(/\\u[0-9A-Fa-f]{4}/g, '').trim();
        if (name && !name.includes('logo') && !seen.has(name)) {
          seen.add(name);
          products.push({
            store: 'Instacart',
            product: name,
            price: parseFloat(match[1]),
            image: '',
            source: 'instacart',
          });
        }
      }
    }

    this.logger.log(`Instacart: parsed ${products.length} products`);
    return products.slice(0, 20);
  }
}
