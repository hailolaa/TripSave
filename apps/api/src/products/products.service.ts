import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Product, ProductCategory } from './product.entity';
import { StoreProduct } from './store-product.entity';
import { Store } from '../stores/store.entity';
import { StoreChain, StoreChainType } from '../stores/store-chain.entity';
import { ScrapedProduct } from '../providers/oxylabs/oxylabs-base.service';

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
  ) {}

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

    return products.map(sp => ({
      store: sp.store.name,
      product: sp.product.name,
      price: Number(sp.price),
      image: sp.product.image_url || '',
      source: sp.source as any,
    }));
  }

  /**
   * Search for products in the local database, allowing stale data (older than 24h).
   * Returns whether the data is stale, allowing stale-while-revalidate patterns.
   */
  async searchFromDbWithStaleness(query: string, zip: string): Promise<{ products: ScrapedProduct[], isStale: boolean } | null> {
    const products = await this.storeProductsRepository.createQueryBuilder('sp')
      .leftJoinAndSelect('sp.product', 'p')
      .leftJoinAndSelect('sp.store', 's')
      .where('s.zip = :zip', { zip })
      .andWhere('(p.name LIKE :q OR p.normalized_name LIKE :q)', { q: `%${query}%` })
      .orderBy('sp.price', 'ASC')
      .getMany();

    if (products.length === 0) return null;

    const freshnessThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const isStale = products.some(sp => !sp.last_verified_at || sp.last_verified_at < freshnessThreshold);

    return {
      isStale,
      products: products.map(sp => ({
        store: sp.store.name,
        product: sp.product.name,
        price: Number(sp.price),
        image: sp.product.image_url || '',
        source: sp.source as any,
      }))
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

  /**
   * Upsert scraped data into the database.
   */
  async upsertScrapedProducts(scrapedData: ScrapedProduct[], zip: string) {
    // Deduplicate noisy scraper rows in-memory first (same store + product).
    const deduped = new Map<string, ScrapedProduct>();
    for (const item of scrapedData) {
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

          // Create dummy store if not exists
          store = await this.storesRepository.save({
            name: cleanedStoreName,
            zip,
            lat: 0,
            lng: 0,
            source: item.source as any,
            is_active: true,
            chain_id: chain.id
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
          product = await this.productsRepository.save({
            name: item.product,
            normalized_name: item.product.toLowerCase().trim(),
            category: category,
            image_url: item.image || this.getFallbackImage(item.product, category)
          });
        } else {
          // UPGRADE LOGIC: If the current product has a fallback image 
          // and the scraper found a REAL image, upgrade it!
          if (item.image && this.isProductFallback(product.image_url)) {
            await this.productsRepository.update(product.id, { image_url: item.image });
          }
        }

        // 3. Upsert StoreProduct atomically (avoids duplicate-key races)
        await this.storeProductsRepository.upsert(
          {
            store_id: store.id,
            product_id: product.id,
            price: item.price,
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
    
    // 1. Ensure a generic product exists for exactly what the user typed
    let genericProduct = await this.productsRepository.findOne({
      where: { name: ILike(cleanQuery) }
    });

    if (!genericProduct) {
      // Create it if it doesn't exist so it can be added to the cart
      const category = this.resolveCategory(cleanQuery);
      genericProduct = await this.productsRepository.save({
        name: query.trim(), // Keep original casing for display
        normalized_name: cleanQuery,
        category: category,
        image_url: this.getFallbackImage(cleanQuery, category)
      });
    } else if (!genericProduct.image_url) {
      // Backfill missing image for generic product
      genericProduct.image_url = this.getFallbackImage(genericProduct.name);
      await this.productsRepository.save(genericProduct);
    }

    // 2. Find other matching products
    const dbResults = await this.productsRepository.find({
      where: [
        { name: ILike(`%${cleanQuery}%`) },
        { normalized_name: ILike(`%${cleanQuery}%`) },
      ],
      take: 20, // limit to 20 results for dropdown autocomplete
    });

    // 3. Remove the generic product from dbResults if it's there to avoid duplicates
    const filteredResults = dbResults.filter(p => p.id !== genericProduct!.id).map(p => {
      if (!p.image_url) p.image_url = this.getFallbackImage(p.name);
      return p;
    });

    // 4. Return generic product at the top
    return [genericProduct, ...filteredResults];
  }

  async findByCategory(category: string): Promise<Product[]> {
    return this.productsRepository.find({
      where: { category: category as any },
      take: 50,
    });
  }

  async getDeals(zip?: string): Promise<any[]> {
    const query = this.storeProductsRepository.createQueryBuilder('sp')
      .leftJoinAndSelect('sp.product', 'p')
      .leftJoinAndSelect('sp.store', 's')
      .leftJoinAndSelect('s.chain', 'c')
      .addSelect('(CASE WHEN sp.sale_price IS NOT NULL THEN (sp.price - sp.sale_price) / sp.price ELSE 0 END)', 'savings_score')
      .orderBy('savings_score', 'DESC')
      .addOrderBy('sp.last_verified_at', 'DESC')
      .take(50);

    if (zip) {
      query.where('s.zip = :zip', { zip });
    }
    
    const items = await query.getMany();

    return items.map(sp => {
      const price = Number(sp.price);
      const salePrice = sp.sale_price ? Number(sp.sale_price) : price;
      const savings = Number((price - salePrice).toFixed(2));
      const savingsPercentage = price > 0 ? Math.round((savings / price) * 100) : 0;

      return {
        id: sp.id,
        productId: sp.product_id,
        name: sp.product.name,
        brand: sp.product.brand,
        category: sp.product.category,
        image_url: sp.product.image_url,
        price: price,
        sale_price: salePrice,
        savings: savings,
        savings_percentage: savingsPercentage,
        store: {
          id: sp.store.id,
          name: sp.store.name,
          chain: sp.store.chain ? {
            type: sp.store.chain.type,
            logo_url: sp.store.chain.logo_url,
          } : null,
        }
      };
    });
  }
}
