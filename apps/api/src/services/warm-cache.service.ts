import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AggregatorService } from '../providers/oxylabs/aggregator.service';
import { ProductsService } from '../products/products.service';
import { User } from '../users/user.entity';
import { CRON_SCHEDULES } from '../common/constants/cache-ttl.constants';

/**
 * Pre-warms the search cache for the 50 most popular grocery products.
 *
 * Strategy:
 * 1. Query distinct ZIP codes from real user locations stored in the DB.
 * 2. For each ZIP, iterate through all 50 popular products.
 * 3. Call AggregatorService.search() — this populates the **in-memory** cache (1h TTL).
 * 4. Call ProductsService.upsertScrapedProducts() — populates the **DB** cache (24h freshness).
 * 5. Stagger requests (30s between each) to avoid slamming the Oxylabs API.
 *
 * Result: When a user searches for "milk", "eggs", etc. the response is instant
 * from either the in-memory or DB cache, instead of waiting 1-2 min for a cold scrape.
 */
@Injectable()
export class WarmCacheService {
  private readonly logger = new Logger(WarmCacheService.name);
  private isRunning = false;

  /** The 50 most popular grocery search queries */
  static readonly POPULAR_PRODUCTS: string[] = [
    'Eggs',
    'Milk',
    'Bread',
    'Chicken Breast',
    'Ground Beef',
    'Cheese',
    'Yogurt',
    'Butter',
    'Steak',
    'Salmon',
    'Bananas',
    'Tomatoes',
    'Apples',
    'Strawberries',
    'Blueberries',
    'Cucumbers',
    'Potatoes',
    'Onions',
    'Garlic',
    'Lettuce',
    'Coffee',
    'Pasta',
    'Rice',
    'Cereal',
    'Peanut Butter',
    'Olive Oil',
    'Honey',
    'Salt',
    'Canned Tomatoes',
    'Instant Noodles',
    'Potato Chips',
    'Soda',
    'Bottled Water',
    'Energy Drinks',
    'Chocolate',
    'Probiotic Soda',
    'Cookies',
    'Mixed Nuts',
    'Ice Cream',
    'Sparkling Water',
    'Frozen Meals',
    'Paper Towels',
    'Toilet Paper',
    'Frozen Peas',
    'Tea',
    'Mayonnaise',
    'Ketchup',
    'Laundry Detergent',
    'Diapers',
    'Dish Soap',
    // ── Pharmacy Staples ─────────────────────────────────────────
    'Tylenol',
    'Advil',
    'Ibuprofen',
    'Claritin',
    'Zyrtec',
    'Vitamin C',
    'Multivitamin',
    'Fish Oil',
    'Melatonin',
    'Digital Thermometer',
    'Band-Aids',
    'Aspirin',
    'Cough Syrup',
    'Allergy Relief',
    'Eye Drops',
    'Antacid',
    'Probiotics',
    'Magnesium',
    'Zinc',
    'Hand Sanitizer',
  ];

  /** Delay between scraping each product (ms) — prevents API rate-limiting */
  private readonly STAGGER_DELAY_MS = 30_000; // 30 seconds

  /** Fallback ZIP if no users have set a location yet */
  private readonly DEFAULT_ZIP = '75201';

  private readonly top15Items = [
    'milk', 'eggs', 'bread', 'chicken', 'rice', 
    'water', 'gas', 'bananas', 'butter', 'cheese', 
    'orange juice', 'pasta', 'cooking oil', 'diapers', 'tylenol'
  ];

  constructor(
    private readonly aggregatorService: AggregatorService,
    private readonly productsService: ProductsService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Fast, priority cache warm for a newly registered user's ZIP code.
   * Only does the top 15 items with a 2-second stagger.
   * Runs as a background process.
   */
  async warmNewUser(zip: string): Promise<void> {
    if (!zip) return;
    
    this.logger.log(`Starting priority cache warm for new user in ZIP ${zip}...`);
    
    // Process top 15 items asynchronously with 2-second stagger
    (async () => {
      let successCount = 0;
      
      for (let i = 0; i < this.top15Items.length; i++) {
        const item = this.top15Items[i];
        try {
          // Bypass cache to force a fresh live scrape
          const result = await this.aggregatorService.search(item, zip, undefined, { bypassCache: true });
          if (result && result.data.length > 0) {
            successCount++;
          }
        } catch (err: any) {
          this.logger.warn(`Priority warm fail for ${item} in ${zip}: ${err.message}`);
        }
        
        // 2-second stagger (vs 30s for the main cron job)
        if (i < this.top15Items.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      this.logger.log(`Priority cache warm complete for ZIP ${zip}. Warmed ${successCount}/${this.top15Items.length} items.`);
    })().catch(err => this.logger.error(`Priority warm process crashed: ${err.message}`));
  }

  /**
   * Cron job: runs every 6 hours.
   * If the previous cycle is still running, the new invocation is skipped
   * to prevent overlapping heavy scrape loads.
   */
  @Cron('0 */6 * * *')
  async onCron(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('⏭ Warm-cache cycle already in progress — skipping this tick.');
      return;
    }
    await this.runWarmCycle();
  }

  /**
   * Public trigger for manual invocation via admin API.
   * Returns a summary of the cycle.
   */
  async triggerManual(): Promise<{ success: boolean; zips: string[]; productsWarmed: number; durationMs: number }> {
    if (this.isRunning) {
      return { success: false, zips: [], productsWarmed: 0, durationMs: 0 };
    }
    return this.runWarmCycle();
  }

  /**
   * Core warm-cache loop.
   */
  private async runWarmCycle(): Promise<{ success: boolean; zips: string[]; productsWarmed: number; durationMs: number }> {
    this.isRunning = true;
    const startTime = Date.now();
    let totalWarmed = 0;

    try {
      // ── Resolve ZIP codes from real user locations ──────────────
      const zips = await this.resolveUserZipCodes();
      this.logger.log(`🔥 Warm-cache cycle starting for ${zips.length} ZIP(s): ${zips.join(', ')} — ${this.top15Items.length} priority products each`);

      for (const zip of zips) {
        for (let i = 0; i < this.top15Items.length; i++) {
          const product = this.top15Items[i];
          try {
            this.logger.log(`[${zip}] Warming ${i + 1}/${this.top15Items.length}: "${product}"`);

            // This populates the in-memory cache (SearchCacheService, 1h TTL)
            const result = await this.aggregatorService.search(product, zip);

            // Also persist to DB so the 24h DB cache is fresh
            if (result.data.length > 0) {
              await this.productsService.upsertScrapedProducts(result.data, zip);
            }

            totalWarmed++;
            this.logger.log(`[${zip}] ✓ "${product}" — ${result.data.length} results cached`);
          } catch (err: any) {
            this.logger.error(`[${zip}] ✗ "${product}" failed: ${err.message}`);
          }

          // Stagger to avoid Oxylabs rate-limits (skip delay after the last product)
          if (i < this.top15Items.length - 1) {
            await this.sleep(this.STAGGER_DELAY_MS);
          }
        }
      }

      const durationMs = Date.now() - startTime;
      this.logger.log(`🔥 Warm-cache cycle complete: ${totalWarmed} products warmed in ${(durationMs / 60000).toFixed(1)} min`);
      return { success: true, zips, productsWarmed: totalWarmed, durationMs };
    } catch (err: any) {
      this.logger.error(`Warm-cache cycle crashed: ${err.message}`);
      return { success: false, zips: [], productsWarmed: totalWarmed, durationMs: Date.now() - startTime };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Query distinct ZIP codes from users who have set a real location.
   * Falls back to DEFAULT_ZIP if no users have a ZIP set.
   */
  private async resolveUserZipCodes(): Promise<string[]> {
    try {
      // Query top 20 most popular ZIP codes based on user count
      const rows: { zip_code: string, count: string }[] = await this.userRepository
        .createQueryBuilder('u')
        .select('u.zip_code', 'zip_code')
        .addSelect('COUNT(u.id)', 'count')
        .where('u.zip_code IS NOT NULL')
        .andWhere("u.zip_code != ''")
        .groupBy('u.zip_code')
        .orderBy('count', 'DESC')
        .limit(20)
        .getRawMany();

      const zips = rows.map(r => r.zip_code).filter(Boolean);

      if (zips.length === 0) {
        this.logger.warn('No user ZIP codes found in DB — using default ZIP');
        return [this.DEFAULT_ZIP];
      }

      this.logger.log(`Resolved ${zips.length} unique user ZIP code(s) for warm-cache`);
      return zips;
    } catch (err: any) {
      this.logger.error(`Failed to resolve user ZIPs: ${err.message}. Falling back to default.`);
      return [this.DEFAULT_ZIP];
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
