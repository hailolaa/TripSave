import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import NodeCache from 'node-cache';

@Injectable()
export class ProductImageService {
  private readonly logger = new Logger(ProductImageService.name);
  private readonly cache = new NodeCache({ stdTTL: 86400, useClones: false });

  private isFallbackImage(url?: string): boolean {
    const imageUrl = url?.trim() ?? '';
    if (!imageUrl) {
      return true;
    }

    return (
      imageUrl.includes('images.unsplash.com') ||
      imageUrl.includes('placeholder') ||
      imageUrl.includes('storage.com')
    );
  }

  async resolveImage(productName: string, existingImageUrl?: string): Promise<string> {
    const existing = existingImageUrl?.trim();
    if (existing && !this.isFallbackImage(existing)) {
      return existing;
    }

    const normalizedName = productName.toLowerCase().trim();
    if (!normalizedName) {
      return existing || '';
    }

    const cached = this.cache.get<string>(normalizedName);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const response = await axios.get('https://world.openfoodfacts.org/cgi/search.pl', {
        params: {
          search_terms: productName,
          json: 1,
          page_size: 1,
          fields: 'image_url',
        },
        timeout: 8000,
      });

      const imageUrl = this.extractImageUrl(response.data);
      this.cache.set(normalizedName, imageUrl);
      return imageUrl || existing || '';
    } catch (error: any) {
      this.logger.debug(`Open Food Facts lookup failed for "${productName}": ${error.message}`);
      this.cache.set(normalizedName, '');
      return existing || '';
    }
  }

  private extractImageUrl(data: any): string {
    const products = Array.isArray(data?.products) ? data.products : [];

    for (const product of products) {
      const imageUrl = typeof product?.image_url === 'string' ? product.image_url.trim() : '';
      if (imageUrl) {
        return imageUrl;
      }
    }

    return '';
  }
}