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

  async searchProducts(query: string): Promise<Product[]> {
    if (!query || query.trim() === '') {
      return [];
    }
    
    // ILike is case-insensitive search
    return this.productsRepository.find({
      where: [
        { name: ILike(`%${query}%`) },
        { normalized_name: ILike(`%${query}%`) },
      ],
      take: 20, // limit to 20 results for dropdown autocomplete
    });
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
