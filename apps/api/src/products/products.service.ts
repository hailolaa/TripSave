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
        // 1. Resolve Store (find by name + zip)
        let store = await this.storesRepository.findOne({ 
          where: { name: ILike(item.store), zip } 
        });

        if (!store) {
          // Resolve or create a default chain to avoid foreign key failure
          let chain = await this.chainsRepository.findOne({ 
            where: { slug: item.store.toLowerCase().replace(/\s+/g, '-') } 
          });

          if (!chain) {
            // Try to find any grocery chain or fallback
            chain = await this.chainsRepository.findOne({ where: { type: StoreChainType.GROCERY } });
          }

          if (!chain) {
            // Create default chain in a race-safe way.
            // Concurrent scrapes may attempt this simultaneously.
            try {
              chain = await this.chainsRepository.save({
                name: 'Default Store Chain',
                slug: 'default-chain',
                type: StoreChainType.GROCERY,
              });
            } catch {
              chain = await this.chainsRepository.findOne({ where: { slug: 'default-chain' } });
            }
          }

          if (!chain) {
            throw new Error('Unable to resolve store chain for scraped store');
          }

          // Create dummy store if not exists
          store = await this.storesRepository.save({
            name: item.store,
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
          product = await this.productsRepository.save({
            name: item.product,
            normalized_name: item.product.toLowerCase().trim(),
            category: ProductCategory.OTHER,
            image_url: item.image
          });
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

  private getFallbackImage(query: string): string {
    const q = query.toLowerCase();
    if (q.includes('milk')) return 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=200&q=80';
    if (q.includes('egg')) return 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?auto=format&fit=crop&w=200&q=80';
    if (q.includes('bread')) return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=200&q=80';
    if (q.includes('cheese')) return 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=200&q=80';
    if (q.includes('meat') || q.includes('chicken') || q.includes('beef')) return 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=200&q=80';
    if (q.includes('fruit') || q.includes('apple') || q.includes('banana')) return 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=200&q=80';
    if (q.includes('veg') || q.includes('carrot') || q.includes('tomato')) return 'https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?auto=format&fit=crop&w=200&q=80';
    if (q.includes('med') || q.includes('pill') || q.includes('drug') || q.includes('vitamin') || q.includes('tylenol')) return 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=200&q=80';
    if (q.includes('clean') || q.includes('soap') || q.includes('wash') || q.includes('detergent')) return 'https://images.unsplash.com/photo-1584820927498-cafe4c1ebf95?auto=format&fit=crop&w=200&q=80';
    if (q.includes('water') || q.includes('drink') || q.includes('juice') || q.includes('soda')) return 'https://images.unsplash.com/photo-1548839140-29a749e1bc4c?auto=format&fit=crop&w=200&q=80';
    
    // Default grocery image
    return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80';
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
      genericProduct = await this.productsRepository.save({
        name: query.trim(), // Keep original casing for display
        normalized_name: cleanQuery,
        category: ProductCategory.OTHER,
        image_url: this.getFallbackImage(cleanQuery)
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
