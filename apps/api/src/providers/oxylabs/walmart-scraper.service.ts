import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OxylabsBaseService, ScrapedProduct } from './oxylabs-base.service';

/**
 * Scrapes Walmart.com product search results via Oxylabs.
 */
@Injectable()
export class WalmartScraperService extends OxylabsBaseService {
  protected readonly logger = new Logger(WalmartScraperService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  async search(query: string, zip?: string): Promise<ScrapedProduct[]> {
    const url = `https://www.walmart.com/search?q=${encodeURIComponent(query)}`;
    this.logger.log(`Scraping Walmart for "${query}"`);

    try {
      const html = await this.scrape(url, {
        render: true,
        geo_location: zip || undefined,
      });

      return this.parse(html);
    } catch (err: unknown) {
      const status = (err as any)?.response?.status;
      if (status === 401) {
        this.logger.warn(
          `Walmart scraper returned 401 for "${query}" — keeping existing DB data.`,
        );
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Walmart scrape failed: ${message}`);
      return [];
    }
  }

  private parse(html: string): ScrapedProduct[] {
    const products: ScrapedProduct[] = [];

    // 1. Try __NEXT_DATA__ (Reliable JSON source)
    try {
      const nextDataMatch = html.match(
        /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
      );
      if (nextDataMatch) {
        const data = JSON.parse(nextDataMatch[1]);

        // Walmart path: props.pageProps.initialData.searchResult.itemStacks
        const itemStacks =
          data?.props?.pageProps?.initialData?.searchResult?.itemStacks ||
          data?.props?.pageProps?.searchResult?.itemStacks ||
          [];

        for (const stack of itemStacks) {
          const items = stack.items || [];
          for (const item of items) {
            const price =
              item.priceInfo?.currentPrice?.price ||
              item.price ||
              item.itemPrice ||
              0;
            const name = item.name || item.title || item.text || '';

            if (price > 0 && name) {
              products.push({
                store: 'Walmart',
                product: name,
                price:
                  typeof price === 'string'
                    ? parseFloat(price.replace(/[^0-9.]/g, ''))
                    : price,
                image: item.image || item.thumbnailUrl || '',
                source: 'oxylabs',
              });
            }
          }
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.debug(
        `Walmart JSON parse failed, falling back to regex: ${message}`,
      );
    }

    // 2. Fallback Regex
    if (products.length === 0) {
      const regex = /"name":"([^"]+)","type":"REGULAR","price":(\d+\.?\d*)/g;
      let match;
      while ((match = regex.exec(html)) !== null) {
        products.push({
          store: 'Walmart',
          product: match[1],
          price: parseFloat(match[2]),
          image: '',
          source: 'oxylabs',
        });
      }
    }

    // 3. Last Resort: Structured Data
    if (products.length === 0) {
      const priceRegex = /itemprop="price"[^>]*content="(\d+\.?\d*)"/g;
      const titleRegex = /itemprop="name"[^>]*>([^<]+)</g;
      let pMatch, tMatch;
      while (
        (pMatch = priceRegex.exec(html)) &&
        (tMatch = titleRegex.exec(html))
      ) {
        products.push({
          store: 'Walmart',
          product: tMatch[1].trim(),
          price: parseFloat(pMatch[1]),
          image: '',
          source: 'oxylabs',
        });
      }
    }

    this.logger.log(`Walmart: parsed ${products.length} products`);
    return products.slice(0, 15);
  }
}
