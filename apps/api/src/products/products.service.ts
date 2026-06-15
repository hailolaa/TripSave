import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Product, ProductCategory } from './product.entity';
import { StoreProduct } from './store-product.entity';
import { Store } from '../stores/store.entity';
import { StoreChain, StoreChainType } from '../stores/store-chain.entity';
import { ScrapedProduct } from '../providers/oxylabs/oxylabs-base.service';
import { geocodePlace } from '../utils/geocoding.util';
import { getQueryVariants, isLikelyUnrelatedProduct, scoreProductRelevance } from '../utils/relevance.util';
import { ProductImageService } from './product-image.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Store)
    private storesRepository: Repository<Store>,
    @InjectRepository(StoreChain)
    private chainsRepository: Repository<StoreChain>,
    @InjectRepository(StoreProduct)
    private storeProductsRepository: Repository<StoreProduct>,
    private readonly productImageService: ProductImageService,
  ) {}

  private async resolveProductImage(productName: string, existingImageUrl?: string): Promise<string> {
    return this.productImageService.resolveImage(productName, existingImageUrl);
  }

  /**
   * Search for products in the local database.
   * Returns empty if no results are fresh (< 24h).
   */
  async searchFromDb(query: string, zip: string): Promise<ScrapedProduct[] | null> {
    const products = await this.storeProductsRepository.createQueryBuilder('sp')
      .leftJoinAndSelect('sp.product', 'p')
      .leftJoinAndSelect('sp.store', 's')
      .where('s.zip = :zip', { zip })
      .andWhere('(p.name LIKE :q OR p.normalized_name LIKE :q)', { q: `%${query}%` })
      .andWhere('sp.last_verified_at > :freshness', { 
        freshness: new Date(Date.now() - 24 * 60 * 60 * 1000) 
      })
      .orderBy('sp.price', 'ASC')
      .getMany();

    if (products.length === 0) return null;

    return Promise.all(products.map(async sp => ({
      store: sp.store.name,
      product: sp.product.name,
      price: sp.sale_price ? Number(sp.sale_price) : Number(sp.price),
      originalPrice: sp.sale_price ? Number(sp.price) : undefined,
      salePrice: sp.sale_price ? Number(sp.sale_price) : undefined,
      brand: this.inferBrandName(sp.product.name, sp.product.brand) ?? undefined,
      image: await this.resolveProductImage(sp.product.name, sp.product.image_url || ''),
      source: sp.source as any,
    })));
  }

  /**
   * Search for products in the local database, allowing stale data (older than 24h).
   * Returns whether the data is stale, allowing stale-while-revalidate patterns.
   */
  async searchFromDbWithStaleness(query: string, zip: string): Promise<{ products: ScrapedProduct[], isStale: boolean, newestVerifiedAt: Date } | null> {
    const products = await this.storeProductsRepository.createQueryBuilder('sp')
      .leftJoinAndSelect('sp.product', 'p')
      .leftJoinAndSelect('sp.store', 's')
      .where('s.zip = :zip', { zip })
      .andWhere('(p.name LIKE :q OR p.normalized_name LIKE :q)', { q: `%${query}%` })
      .orderBy('sp.price', 'ASC')
      .getMany();

    if (products.length === 0) return null;

    const freshnessThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staleCount = products.filter(sp => !sp.last_verified_at || sp.last_verified_at < freshnessThreshold).length;
    const isStale = staleCount > (products.length / 2); // Only stale if majority (>50%) are stale

    // Find the most recent verification timestamp for cache age display
    const newestVerifiedAt = products.reduce((max, sp) =>
      sp.last_verified_at && sp.last_verified_at > max ? sp.last_verified_at : max,
      new Date(0)
    );

    return {
      isStale,
      newestVerifiedAt,
      products: await Promise.all(products.map(async sp => ({
        store: sp.store.name,
        product: sp.product.name,
        price: sp.sale_price ? Number(sp.sale_price) : Number(sp.price),
        originalPrice: sp.sale_price ? Number(sp.price) : undefined,
        salePrice: sp.sale_price ? Number(sp.sale_price) : undefined,
        brand: this.inferBrandName(sp.product.name, sp.product.brand) ?? undefined,
        image: await this.resolveProductImage(sp.product.name, sp.product.image_url || ''),
        source: sp.source as any,
      })))
    };
  }

  private cleanName(name: string): string {
    if (!name) return name;
    let cleaned = name.split('$')[0];
    const separators = [' - ', ' · ', ' | ', ' @ '];
    for (const sep of separators) {
      cleaned = cleaned.split(sep)[0];
    }
    cleaned = cleaned.replace(/\s(Regular|Premium|Diesel|Gas Station|Gas Stop).*$/i, '');
    return cleaned.trim().replace(/[*"']$/, '').trim();
  }

  private async findBrandChain(name: string): Promise<{ name: string; logo: string; domain: string } | null> {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const token = process.env.LOGO_DEV_TOKEN || 'pk_UUfT4NowQ-GmCHtVoknvfg';
    
    const brands = [
      { key: 'walmart', name: 'Walmart', domain: 'walmart.com' },
      { key: 'target', name: 'Target', domain: 'target.com' },
      { key: 'aldi', name: 'Aldi', domain: 'aldi.us' },
      { key: 'kroger', name: 'Kroger', domain: 'kroger.com' },
      { key: 'costco', name: 'Costco', domain: 'costco.com' },
      { key: 'heb', name: 'HEB', domain: 'heb.com' },
      { key: 'samsclub', name: "Sam's Club", domain: 'samsclub.com' },
      { key: 'wholefoods', name: 'Whole Foods', domain: 'wholefoodsmarket.com' },
      { key: 'publix', name: 'Publix', domain: 'publix.com' },
      { key: 'sprouts', name: 'Sprouts', domain: 'sprouts.com' },
      { key: 'cvs', name: 'CVS', domain: 'cvs.com' },
      { key: 'walgreens', name: 'Walgreens', domain: 'walgreens.com' },
    ];

    for (const brand of brands) {
      if (normalized.includes(brand.key)) {
        return { 
          ...brand, 
          logo: `https://img.logo.dev/${brand.domain}?token=${token}` 
        };
      }
    }
    return null;
  }

  private isProductFallback(url: string | null | undefined): boolean {
    if (!url) return true;
    // Check if it's one of our Unsplash category fallbacks
    return url.includes('images.unsplash.com') || url.includes('placeholder') || url.includes('storage.com');
  }

  private inferBrandName(productName: string, explicitBrand?: string | null): string | null {
    if (explicitBrand) return explicitBrand;

    const normalized = productName.toLowerCase();
    const knownBrands = [
      'Great Value',
      'Good & Gather',
      'Kroger',
      'Friendly Farms',
      'Goldhen',
      'Tylenol',
      'Equate',
      'Minute Maid',
      'SunnyD',
      'Simply Orange',
      'Tampico',
      'Pompeian',
      'California Olive Ranch',
      'Brami',
      'Daawat',
      'Four Elephants',
    ];

    return knownBrands.find((brand) => normalized.includes(brand.toLowerCase())) || null;
  }

  private shouldPersistScrapedProduct(item: ScrapedProduct): boolean {
    if (item.source !== 'direct') return true;

    const name = item.product.toLowerCase();
    const hasRealImage = Boolean(item.image?.trim());
    return hasRealImage && !name.includes('(sample)');
  }

  /**
   * Upsert scraped data into the database.
   */
  async upsertScrapedProducts(scrapedData: ScrapedProduct[], zip: string) {
    // Deduplicate noisy scraper rows in-memory first (same store + product).
    const deduped = new Map<string, ScrapedProduct>();
    for (const item of scrapedData) {
      if (!this.shouldPersistScrapedProduct(item)) continue;

      const key = `${item.store.toLowerCase().trim()}|${item.product.toLowerCase().trim()}`;
      deduped.set(key, item);
    }

    for (const item of deduped.values()) {
      try {
        const cleanedStoreName = this.cleanName(item.store);

        // 1. Resolve Store (find by name + zip)
        let store = await this.storesRepository.findOne({ 
          where: { name: ILike(cleanedStoreName), zip } 
        });

        if (!store) {
          // Check for a known brand first
          const brand = await this.findBrandChain(cleanedStoreName);
          const chainName = brand?.name || cleanedStoreName;
          const chainSlug = chainName.toLowerCase().replace(/\s+/g, '-');

          // Resolve or create chain
          let chain = await this.chainsRepository.findOne({ 
            where: { name: ILike(chainName) } 
          });

          if (!chain) {
            chain = await this.chainsRepository.save({
              name: chainName,
              slug: chainSlug,
              type: StoreChainType.GROCERY,
              logo_url: brand?.logo || null
            });
          } else if (brand?.logo && !chain.logo_url) {
            // Update missing logo for existing chain
            await this.chainsRepository.update(chain.id, { logo_url: brand.logo });
          }

          // Validate and heal coordinates
          let lat = item.lat || 0;
          let lng = item.lng || 0;
          let coordsConfident = true;

          const inUSA = lat > 24 && lat < 50 && lng > -125 && lng < -66;
          
          if (!lat || !lng || lat === 0 || lng === 0 || !inUSA) {
            console.warn(`Missing or invalid coords for ${cleanedStoreName} — geocoding address`);
            
            // First geocode the zip code to get a center location
            const zipCoords = await geocodePlace(zip);
            let coords = null;
            if (zipCoords && zipCoords.lat && zipCoords.lng) {
              // Dynamically require geocodePlaceNear to avoid circular deps if any
              const { geocodePlaceNear } = require('../utils/geocoding.util');
              // Geocode the store biased near the zip center to avoid getting a store in another city
              coords = await geocodePlaceNear(cleanedStoreName, zipCoords.lat, zipCoords.lng, 0.35);
            }
            
            // Fallback to plain geocoding if zip-biased geocoding fails or wasn't possible
            if (!coords) {
              coords = await geocodePlace(`${cleanedStoreName} ${zip}`);
            }

            if (coords && coords.lat && coords.lng) {
              lat = coords.lat;
              lng = coords.lng;
            } else {
              console.warn(`Failed to geocode coords for ${cleanedStoreName} — dropping confidence`);
              coordsConfident = false;
              // default to 0,0 if still invalid so it gets pushed down in distance sorting
              lat = 0;
              lng = 0;
            }
          }

          // Create dummy store if not exists
          store = await this.storesRepository.save({
            name: cleanedStoreName,
            zip,
            lat,
            lng,
            source: item.source as any,
            is_active: true,
            chain_id: chain.id,
            coords_confident: coordsConfident
          });
        }

        // 2. Resolve Product
        let product = await this.productsRepository.findOne({
          where: [
            { name: ILike(item.product) },
            { normalized_name: ILike(item.product) }
          ]
        });

        if (!product) {
          const category = this.resolveCategory(item.product);
          const brand = this.inferBrandName(item.product, item.brand);
          const resolvedImage = await this.resolveProductImage(
            item.product,
            item.image || this.getFallbackImage(item.product, category),
          );
          product = await this.productsRepository.save({
            name: item.product,
            normalized_name: item.product.toLowerCase().trim(),
            category: category,
            brand,
            image_url: resolvedImage || this.getFallbackImage(item.product, category)
          });
        } else {
          const resolvedImage = await this.resolveProductImage(
            item.product,
            item.image || product.image_url || undefined,
          );
          const updates: Partial<Product> = {};

          if (resolvedImage && resolvedImage !== product.image_url) {
            updates.image_url = resolvedImage;
          }
          if (!product.brand) {
            const brand = this.inferBrandName(item.product, item.brand);
            if (brand) updates.brand = brand;
          }

          if (Object.keys(updates).length > 0) {
            await this.productsRepository.update(product.id, updates);
          }
        }

        const currentPrice = Number(item.salePrice ?? item.price);
        const originalPrice = Number(item.originalPrice ?? item.price);
        const hasDiscount = currentPrice > 0 && originalPrice > currentPrice;

        // 3. Upsert StoreProduct atomically (avoids duplicate-key races)
        await this.storeProductsRepository.upsert(
          {
            store_id: store.id,
            product_id: product.id,
            price: hasDiscount ? originalPrice : Number(item.price),
            sale_price: (hasDiscount ? currentPrice : null) as any,
            in_stock: true,
            last_verified_at: new Date(),
            source: item.source as any,
          },
          ['store_id', 'product_id'],
        );
      } catch (err) {
        // Continue if one record fails
        console.error(`Failed to upsert product ${item.product}:`, err);
      }
    }
  }

  private resolveCategory(name: string): ProductCategory {
    const n = name.toLowerCase();
    if (n.includes('milk') || n.includes('cheese') || n.includes('yogurt') || n.includes('butter') || n.includes('dairy')) return ProductCategory.DAIRY;
    if (n.includes('meat') || n.includes('beef') || n.includes('chicken') || n.includes('pork') || n.includes('steak') || n.includes('turkey')) return ProductCategory.MEAT;
    if (n.includes('fruit') || n.includes('veg') || n.includes('apple') || n.includes('banana') || n.includes('carrot') || n.includes('tomato') || n.includes('produce')) return ProductCategory.PRODUCE;
    if (n.includes('bread') || n.includes('bakery') || n.includes('cake') || n.includes('muffin') || n.includes('bagel')) return ProductCategory.BAKERY;
    if (n.includes('water') || n.includes('drink') || n.includes('juice') || n.includes('soda') || n.includes('beverage') || n.includes('coke') || n.includes('pepsi')) return ProductCategory.BEVERAGES;
    if (n.includes('snack') || n.includes('chip') || n.includes('cookie') || n.includes('candy') || n.includes('chocolate')) return ProductCategory.SNACKS;
    if (n.includes('frozen') || n.includes('ice cream') || n.includes('pizza')) return ProductCategory.FROZEN;
    if (n.includes('med') || n.includes('pill') || n.includes('drug') || n.includes('vitamin') || n.includes('tylenol') || n.includes('pharmacy')) return ProductCategory.MEDICINE;
    if (n.includes('clean') || n.includes('soap') || n.includes('wash') || n.includes('detergent')) return ProductCategory.CLEANING;
    if (n.includes('baby') || n.includes('diaper') || n.includes('infant')) return ProductCategory.BABY;
    if (n.includes('dog') || n.includes('cat') || n.includes('pet') || n.includes('bird')) return ProductCategory.PET;
    if (n.includes('fuel') || n.includes('gas') || n.includes('unleaded') || n.includes('diesel')) return ProductCategory.GAS;
    
    return ProductCategory.OTHER;
  }

  private getFallbackImage(query: string, category?: ProductCategory): string {
    const q = query.toLowerCase();
    const cat = category || this.resolveCategory(q);

    // If category is known, use category-specific images from our collection
    const categoryImagesMap: Record<string, string> = {
      [ProductCategory.PRODUCE]: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&q=80&w=400',
      [ProductCategory.MEAT]: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&q=80&w=400',
      [ProductCategory.DAIRY]: 'https://images.unsplash.com/photo-1550583724-125581f77833?auto=format&fit=crop&q=80&w=400',
      [ProductCategory.BAKERY]: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400',
      [ProductCategory.BEVERAGES]: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=400',
      [ProductCategory.SNACKS]: 'https://images.unsplash.com/photo-1599490659213-e2b9527bb087?auto=format&fit=crop&q=80&w=400',
      [ProductCategory.MEDICINE]: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400',
      [ProductCategory.CLEANING]: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=400',
      [ProductCategory.PET]: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=400',
      [ProductCategory.BABY]: 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?auto=format&fit=crop&q=80&w=400',
      [ProductCategory.PERSONAL_CARE]: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&q=80&w=400',
      [ProductCategory.HOUSEHOLD]: 'https://images.unsplash.com/photo-1528740561666-dc2479bd08bc?auto=format&fit=crop&q=80&w=400',
      [ProductCategory.GAS]: 'https://images.unsplash.com/photo-1614732414444-096e5f1122d5?auto=format&fit=crop&q=80&w=400',
      [ProductCategory.CANNED]: 'https://images.unsplash.com/photo-1534483509719-3feaee7c30da?auto=format&fit=crop&q=80&w=400',
      [ProductCategory.CONDIMENTS]: 'https://images.unsplash.com/photo-1607604668248-f0143ad3964f?auto=format&fit=crop&q=80&w=400',
      [ProductCategory.FROZEN]: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=400',
      [ProductCategory.OTHER]: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
    };

    return categoryImagesMap[cat] || categoryImagesMap[ProductCategory.OTHER];
  }

  async searchProducts(query: string): Promise<Product[]> {
    if (!query || query.trim() === '') {
      return [];
    }
    
    const cleanQuery = query.trim().toLowerCase();
    const variants = getQueryVariants(cleanQuery);

    // Try to find an existing generic product that matches any variant exactly
    let genericProduct: Product | null = null;
    for (const variant of variants) {
      genericProduct = await this.productsRepository.findOne({
        where: [
          { name: ILike(variant) },
          { normalized_name: ILike(variant) }
        ]
      });
      if (genericProduct) break;
    }

    if (!genericProduct) {
      // Create it if it doesn't exist so it can be added to the cart
      const category = this.resolveCategory(cleanQuery);
      const resolvedImage = await this.resolveProductImage(
        query.trim(),
        this.getFallbackImage(cleanQuery, category),
      );
      genericProduct = await this.productsRepository.save({
        name: query.trim(), // Keep original casing for display
        normalized_name: cleanQuery,
        category: category,
        image_url: resolvedImage || this.getFallbackImage(cleanQuery, category)
      });
    } else if (!genericProduct.image_url || this.isProductFallback(genericProduct.image_url)) {
      // Resolve/backfill missing or fallback image
      const resolvedImage = await this.resolveProductImage(
        genericProduct.name,
        genericProduct.image_url || undefined,
      );
      if (resolvedImage && resolvedImage !== genericProduct.image_url) {
        genericProduct.image_url = resolvedImage;
        await this.productsRepository.save(genericProduct);
      }
    }

    return [genericProduct];
  }

  async findByCategory(category: string): Promise<Product[]> {
    const products = await this.productsRepository.find({
      where: { category: category as any },
      take: 50,
    });

    return Promise.all(products.map(async (product) => {
      if (product.image_url && !this.isProductFallback(product.image_url)) {
        return product;
      }

      const resolvedImage = await this.resolveProductImage(product.name, product.image_url || undefined);
      if (resolvedImage && resolvedImage !== product.image_url) {
        product.image_url = resolvedImage;
        await this.productsRepository.save(product);
      }

      return product;
    }));
  }

  private async findDealStoreProducts(zip?: string, limit: number = 50): Promise<StoreProduct[]> {
    const query = this.storeProductsRepository.createQueryBuilder('sp')
      .leftJoinAndSelect('sp.product', 'p')
      .leftJoinAndSelect('sp.store', 's')
      .leftJoinAndSelect('s.chain', 'c')
      .where('sp.in_stock = :inStock', { inStock: true })
      .andWhere('sp.source != :directSource', { directSource: 'direct' })
      .andWhere('p.name NOT LIKE :sampleFallback', { sampleFallback: '%(Sample)%' })
      .addSelect('(CASE WHEN sp.sale_price IS NOT NULL AND sp.sale_price < sp.price THEN (sp.price - sp.sale_price) / sp.price ELSE 0 END)', 'savings_score')
      .orderBy('savings_score', 'DESC')
      .addOrderBy('sp.last_verified_at', 'DESC')
      .take(limit);

    if (zip) {
      query.andWhere('s.zip = :zip', { zip });
    }

    return query.getMany();
  }

  async getDeals(zip?: string): Promise<any[]> {
    const resolvedZip = zip || '75201';
    const items = await this.findDealStoreProducts(resolvedZip, 50);

    return Promise.all(items.map(async (sp) => {
      const price = Number(sp.price);
      const salePrice = sp.sale_price ? Number(sp.sale_price) : price;
      const savings = Number((price - salePrice).toFixed(2));
      const savingsPercentage = price > 0 ? Math.round((savings / price) * 100) : 0;

      const resolvedImage = await this.resolveProductImage(sp.product.name, sp.product.image_url || '');
      const brand = this.inferBrandName(sp.product.name, sp.product.brand);

      return {
        id: sp.id,
        productId: sp.product_id,
        name: sp.product.name,
        brand,
        category: sp.product.category,
        image_url: resolvedImage,
        price,
        original_price: price,
        sale_price: salePrice,
        clearance_price: salePrice,
        savings: savings,
        savings_percentage: savingsPercentage,
        is_clearance: savings > 0,
        store: {
          id: sp.store.id,
          name: sp.store.name,
          chain: sp.store.chain ? {
            name: sp.store.chain.name,
            type: sp.store.chain.type,
            logo_url: sp.store.chain.logo_url,
          } : null,
        }
      };
    }));
  }

  /**
   * Backfill product images for products missing images or using seeded fallback.
   * Processes in batches to avoid long transactions.
   */
  async backfillMissingImages(
    batchSize: number = 200,
    forceAll: boolean = false,
    replaceRealImages: boolean = false,
  ) {
    let offset = 0;
    let updated = 0;
    while (true) {
      const qb = this.productsRepository.createQueryBuilder('p')
        .orderBy('p.id', 'ASC')
        .take(batchSize)
        .skip(offset);

      if (!forceAll) {
        qb.where('p.image_url IS NULL')
          .orWhere('p.image_url LIKE :u1', { u1: '%images.unsplash.com%' })
          .orWhere('p.image_url LIKE :u2', { u2: '%placeholder%' });
      }

      const products = await qb.getMany();
      if (!products || products.length === 0) break;

      for (const product of products) {
        try {
          const currentImage = product.image_url || undefined;
          const shouldRefresh =
            !currentImage ||
            this.isProductFallback(currentImage) ||
            replaceRealImages ||
            forceAll;
          if (!shouldRefresh) {
            continue;
          }

          // Preserve real scraped images unless explicitly told to replace them.
          if (!replaceRealImages && currentImage && !this.isProductFallback(currentImage)) {
            continue;
          }

          const resolved = await this.resolveProductImage(product.name, currentImage);
          if (resolved && resolved !== product.image_url) {
            await this.productsRepository.update(product.id, { image_url: resolved });
            updated++;
            console.log(`Updated image for product id=${product.id} name="${product.name}"`);
          }
        } catch (err) {
          console.warn(`Failed to backfill image for product id=${product.id}: ${err}`);
        }
      }

      offset += products.length;
      // safety: small sleep to avoid hammering external APIs
      await new Promise((r) => setTimeout(r, 250));

      if (!forceAll && products.length < batchSize) {
        break;
      }
    }

    console.log(`Backfill complete. Updated ${updated} products.`);
    return updated;
  }
}
