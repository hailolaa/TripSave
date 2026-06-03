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
    if (!imageUrl) return false;

    if (imageUrl.startsWith('data:')) return true;

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
    // If scraped item provided an image, prefer it as long as it's a valid URL (allow data/protocol-relative)
    if (existing && this.isValidImageUrl(existing)) {
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

      // Lookup order: Pexels -> Google Images -> Bing -> Open Food Facts -> seeded fallback.
      let imageUrl = await this.lookupBestPexelsImage(queryCandidates);
      if (!this.isValidImageUrl(imageUrl)) {
        imageUrl = await this.lookupGoogleImage(queryCandidates[0] || productName);
      }

      // If Google failed and Open Food found nothing, try Bing as a secondary web fallback
      if (!this.isValidImageUrl(imageUrl)) {
        imageUrl = await this.lookupBingImage(queryCandidates[0] || productName);
      }

      // If web fallbacks failed, try Open Food Facts as a last web data source
      if (!this.isValidImageUrl(imageUrl)) {
        imageUrl = await this.lookupBestImage(queryCandidates);
      }

      if (this.isValidImageUrl(imageUrl)) {
        // Cache only positive results to avoid caching failures and allow future retries
        this.cache.set(normalizedName, imageUrl);
        return imageUrl;
      }

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

  private async lookupGoogleImage(query: string): Promise<string> {
    try {
      const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
      const resp = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36',
        },
        timeout: 8000,
      });

      const body = String(resp.data || '');
      // Try to extract common image URL patterns (jpg/png/webp)
      const re = /(https?:\/\/[^"'<>\s]+?\.(?:png|jpg|jpeg|webp))(?:\?|\"|\'|\s|>)/gi;
      const matches = [] as string[];
      let m: RegExpExecArray | null;
      while ((m = re.exec(body)) !== null) {
        if (m[1]) matches.push(m[1]);
      }

      if (matches.length > 0) {
        // prefer https links
        const httpsMatch = matches.find((s) => s.startsWith('https://'));
        return httpsMatch || matches[0];
      }

      // Fallback: try a more permissive extraction of image urls
      const re2 = /(https?:\/\/[^"'<>\s]+?(?:png|jpg|jpeg|webp))/gi;
      const m2 = re2.exec(body);
      if (m2 && m2[1]) return m2[1];

      return '';
    } catch (err: any) {
      this.logger.debug(`Google Image lookup failed for "${query}": ${err.message}`);
      return '';
    }
  }

  private async lookupBingImage(query: string): Promise<string> {
    try {
      const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}`;
      const resp = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36',
        },
        timeout: 8000,
      });

      const body = String(resp.data || '');
      // Extract img srcs
      const re = /<img[^>]+?src=(?:"|')([^"']+?\.(?:png|jpg|jpeg|webp))(?:"|')/gi;
      const matches: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(body)) !== null) {
        if (m[1]) matches.push(m[1]);
      }

      if (matches.length > 0) {
        const httpsMatch = matches.find((s) => s.startsWith('https://'));
        return httpsMatch || matches[0];
      }

      return '';
    } catch (err: any) {
      this.logger.debug(`Bing Image lookup failed for "${query}": ${err.message}`);
      return '';
    }
  }

  private async lookupBestPexelsImage(queryCandidates: string[]): Promise<string> {
    for (const query of queryCandidates) {
      const pexelsImage = await this.lookupPexelsImage(query);
      if (this.isValidImageUrl(pexelsImage)) {
        return pexelsImage;
      }
    }
    return '';
  }

  private async lookupPexelsImage(query: string): Promise<string> {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      this.logger.debug('Pexels API key not provided; skipping Pexels lookup');
      return '';
    }

    try {
      // Try plain query first, then fallback to focused "product" search
      const searchQueries = [query, `${query} product`];
      for (const q of searchQueries) {
        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=5`;
        const resp = await axios.get(url, {
          headers: {
            Authorization: apiKey,
          },
          timeout: 8000,
        });

        const photos = resp?.data?.photos;
        if (!Array.isArray(photos) || photos.length === 0) continue;

        // Prefer photos where the 'alt' text contains product tokens from the query
        const tokens = query
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length > 2);

        const scored: { url: string; score: number }[] = [];
        for (const p of photos) {
          const alt = (p?.alt || '').toLowerCase();
          let score = 0;
          for (const t of tokens) if (alt.includes(t)) score += 2;
          if (alt.includes('product') || alt.includes('pack') || alt.includes('box')) score += 1;
          const candidate = p?.src?.medium || p?.src?.small || p?.src?.original || '';
          if (candidate) scored.push({ url: candidate, score });
        }

        scored.sort((a, b) => b.score - a.score);
        const best = scored.find((s) => s.score > 0) || scored[0];
        if (best && best.url) return this.sanitizeImageUrl(best.url);
      }

      return '';
    } catch (err: any) {
      this.logger.debug(`Pexels lookup failed for "${query}": ${err.message}`);
      return '';
    }
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

    let url = value.trim();

    // Accept data URIs directly
    if (url.startsWith('data:')) return url;

    // Convert protocol-relative URLs to https
    if (url.startsWith('//')) url = 'https:' + url;

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
