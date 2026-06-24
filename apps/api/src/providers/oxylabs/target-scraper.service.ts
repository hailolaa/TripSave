import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OxylabsBaseService, ScrapedProduct } from './oxylabs-base.service';

/**
 * Scrapes Target.com product search results via Oxylabs.
 * Target is a heavy SPA — requires render:true.
 */
@Injectable()
export class TargetScraperService extends OxylabsBaseService {
  protected readonly logger = new Logger(TargetScraperService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  async search(query: string, zip?: string): Promise<ScrapedProduct[]> {
    const url = `https://www.target.com/s?searchTerm=${encodeURIComponent(query)}`;
    this.logger.log(`Scraping Target for "${query}"`);

    try {
      const html = await this.scrape(url, {
        render: true,
        geo_location: zip ? `US-${zip}` : undefined,
      });

      return this.parse(html);
    } catch (err: unknown) {
      const status = (err as any)?.response?.status;
      if (status === 401) {
        this.logger.warn(
          `Target scraper returned 401 for "${query}" — keeping existing DB data.`,
        );
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Target scrape failed: ${message}`);
      return [];
    }
  }

  private parseOptionalPrice(value: string | undefined | null): number | null {
    if (!value) return null;
    const match = value.match(/\d+(?:\.\d{1,2})?/);
    const parsed = match ? parseFloat(match[0]) : 0;
    return parsed > 0 ? parsed : null;
  }

  private parse(html: string): ScrapedProduct[] {
    const products: ScrapedProduct[] = [];

    // Target embeds product data in __TGT_DATA__ or similar JSON script blocks
    try {
      const jsonBlocks = html.match(/"current_retail":(\d+\.?\d*)[^}]*?"title":"([^"]+)"/g);
      if (jsonBlocks) {
        for (const block of jsonBlocks) {
          const priceM = block.match(/"current_retail":(\d+\.?\d*)/);
          const regularM = block.match(/"(?:reg_retail|regular_retail|comparison_retail)":(\d+\.?\d*)/);
          const titleM = block.match(/"title":"([^"]+)"/);
          const imageM = block.match(/"(?:primary_image_url|image_url|base_url)":"([^"]+)"/);
          const currentPrice = this.parseOptionalPrice(priceM?.[1]);
          const regularPrice = this.parseOptionalPrice(regularM?.[1]);
          const hasDiscount = Boolean(currentPrice && regularPrice && regularPrice > currentPrice);
          if (currentPrice && titleM) {
            products.push({
              store: 'Target',
              product: titleM[1].trim(),
              price: currentPrice,
              salePrice: hasDiscount ? currentPrice : undefined,
              originalPrice: hasDiscount ? regularPrice! : undefined,
              image: this.normalizeProductImageUrl(imageM?.[1], 'https://www.target.com'),
              source: 'oxylabs',
            });
          }
        }
      }
    } catch { /* ignore */ }

    // Fallback: regex on rendered HTML
    if (products.length === 0) {
      const regex = /<a[^>]*data-test="product-title"[^>]*>([^<]+)<\/a>[\s\S]*?\$(\d+\.?\d*)/gi;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(html)) !== null) {
        products.push({
          store: 'Target',
          product: match[1].trim(),
          price: parseFloat(match[2]),
          image: '',
          source: 'oxylabs',
        });
      }
    }

    // Generic fallback
    if (products.length === 0) {
      const genericRegex = /\$(\d+\.?\d*)\s*[\s\S]*?<[^>]*>([A-Z][^<]{5,80})<\//gi;
      let match: RegExpExecArray | null;
      while ((match = genericRegex.exec(html)) !== null) {
        const price = parseFloat(match[1]);
        const name = match[2].trim();
        if (price > 0.5 && price < 500 && name.length > 4) {
          products.push({ store: 'Target', product: name, price, image: '', source: 'oxylabs' });
        }
        if (products.length >= 15) break;
      }
    }

    this.logger.log(`Target: parsed ${products.length} products`);
    return products.slice(0, 15);
  }
}
