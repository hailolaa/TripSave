import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import NodeCache from 'node-cache';

@Injectable()
export class ProductImageService {
  private readonly logger = new Logger(ProductImageService.name);
  private readonly cache = new NodeCache({ stdTTL: 86400, useClones: false });
  private readonly seededFallbackImages: Record<string, string> = {
    produce: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&q=80&w=400',
    meat: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&q=80&w=400',
    dairy: 'https://images.unsplash.com/photo-1550583724-125581f77833?auto=format&fit=crop&q=80&w=400',
    bakery: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400',
    beverages: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=400',
    snacks: 'https://images.unsplash.com/photo-1599490659213-e2b9527bb087?auto=format&fit=crop&q=80&w=400',
    medicine: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400',
    cleaning: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=400',
    pet: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=400',
    baby: 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?auto=format&fit=crop&q=80&w=400',
    personalCare: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&q=80&w=400',
    household: 'https://images.unsplash.com/photo-1528740561666-dc2479bd08bc?auto=format&fit=crop&q=80&w=400',
    gas: 'https://images.unsplash.com/photo-1614732414444-096e5f1122d5?auto=format&fit=crop&q=80&w=400',
    canned: 'https://images.unsplash.com/photo-1534483509719-3feaee7c30da?auto=format&fit=crop&q=80&w=400',
    condiments: 'https://images.unsplash.com/photo-1607604668248-f0143ad3964f?auto=format&fit=crop&q=80&w=400',
    frozen: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=400',
    other: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
  };

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

  private isValidImageUrl(url?: string): boolean {
    const imageUrl = this.sanitizeImageUrl(url);
    if (!imageUrl) {
      return false;
    }

    try {
      const parsed = new URL(imageUrl);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async resolveImage(
    productName: string,
    existingImageUrl?: string,
    fallbackImageUrl?: string,
  ): Promise<string> {
    const seededFallback = this.resolveSeededFallbackImage(productName);
    const existing = this.sanitizeImageUrl(existingImageUrl);
    if (existing && this.isValidImageUrl(existing) && !this.isFallbackImage(existing)) {
      return existing;
    }

    const fallback = this.isValidImageUrl(fallbackImageUrl)
      ? fallbackImageUrl!.trim()
      : seededFallback;
    const queryCandidates = this.buildQueryCandidates(productName);

    const normalizedName = productName.toLowerCase().trim();
    if (!normalizedName) {
      return fallback;
    }

    try {
      const cached = this.cache.get<string>(normalizedName);
      if (cached !== undefined) {
        return this.isValidImageUrl(cached) ? cached : fallback;
      }

      // Lookup order: Open Food Facts only, then seeded fallback.
      const imageUrl = await this.lookupBestImage(queryCandidates);

      if (this.isValidImageUrl(imageUrl)) {
        this.cache.set(normalizedName, imageUrl);
        return imageUrl;
      }

      // Cache misses too so we avoid repeatedly calling external API for the same product.
      this.cache.set(normalizedName, '');

      return fallback;
    } catch (error: any) {
      this.logger.debug(`Open Food Facts lookup failed for "${productName}": ${error.message}`);
      return fallback;
    }
  }

  private async lookupBestImage(queryCandidates: string[]): Promise<string> {
    for (const query of queryCandidates) {
      const openFoodFactsImage = await this.lookupOpenFoodFactsImage(query);
      if (openFoodFactsImage) {
        return openFoodFactsImage;
      }
    }

    return '';
  }

  private async lookupOpenFoodFactsImage(productName: string): Promise<string> {
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

      return this.extractImageUrl(response.data);
    } catch (error: any) {
      this.logger.debug(`Open Food Facts lookup failed for "${productName}": ${error.message}`);
      return '';
    }
  }

  private extractImageUrl(data: any): string {
    const products = Array.isArray(data?.products) ? data.products : [];

    for (const product of products) {
      const imageUrl = this.sanitizeImageUrl(product?.image_url);
      if (this.isValidImageUrl(imageUrl)) {
        return imageUrl;
      }
    }

    return '';
  }

  private sanitizeImageUrl(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    const url = value.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return '';
    }

    return url;
  }

  private resolveSeededFallbackImage(productName: string): string {
    const name = productName.toLowerCase();

    if (this.matches(name, ['milk', 'cheese', 'yogurt', 'butter', 'dairy', 'egg'])) return this.seededFallbackImages.dairy;
    if (this.matches(name, ['meat', 'beef', 'chicken', 'pork', 'steak', 'turkey'])) return this.seededFallbackImages.meat;
    if (this.matches(name, ['fruit', 'veg', 'apple', 'banana', 'carrot', 'tomato', 'produce'])) return this.seededFallbackImages.produce;
    if (this.matches(name, ['bread', 'bakery', 'cake', 'muffin', 'bagel'])) return this.seededFallbackImages.bakery;
    if (this.matches(name, ['water', 'drink', 'juice', 'soda', 'beverage', 'coke', 'pepsi'])) return this.seededFallbackImages.beverages;
    if (this.matches(name, ['snack', 'chip', 'cookie', 'candy', 'chocolate'])) return this.seededFallbackImages.snacks;
    if (this.matches(name, ['med', 'pill', 'drug', 'vitamin', 'tylenol', 'pharmacy', 'advil'])) return this.seededFallbackImages.medicine;
    if (this.matches(name, ['clean', 'soap', 'wash', 'detergent'])) return this.seededFallbackImages.cleaning;
    if (this.matches(name, ['baby', 'diaper', 'infant'])) return this.seededFallbackImages.baby;
    if (this.matches(name, ['dog', 'cat', 'pet', 'bird'])) return this.seededFallbackImages.pet;
    if (this.matches(name, ['fuel', 'gas', 'unleaded', 'diesel'])) return this.seededFallbackImages.gas;
    if (this.matches(name, ['frozen', 'ice cream', 'pizza'])) return this.seededFallbackImages.frozen;

    return this.seededFallbackImages.other;
  }

  private matches(name: string, keywords: string[]): boolean {
    return keywords.some((keyword) => name.includes(keyword));
  }

  private buildQueryCandidates(productName: string): string[] {
    const normalized = productName
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[®™]/g, ' ')
      .replace(/\b(\d+\s?(ct|count|pack|pk|oz|lb|lbs|g|kg|ml|l|liter|litre|fl oz|floz|x\s?\d+|\d+x))\b/gi, ' ')
      .replace(/[-|/@·]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const original = productName.trim();
    const words = normalized.split(' ').filter((word) => word.length > 2);
    const shortened = words.slice(0, 5).join(' ').trim();
    const categoryHint = this.resolveSeededFallbackImage(productName);

    const candidates = [
      original,
      normalized,
      shortened,
    ];

    if (categoryHint) {
      candidates.push(`${shortened} product`);
    }

    return Array.from(new Set(candidates.filter((candidate) => candidate && candidate.trim().length > 0)));
  }
}
