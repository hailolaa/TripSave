import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AggregatorService } from '../providers/oxylabs/aggregator.service';
import { ProductsService } from '../products/products.service';
import { SearchActivity } from '../models/search-activity.entity';
import { User } from '../users/user.entity';
import { CRON_SCHEDULES } from '../common/constants/cache-ttl.constants';

/**
 * Pre-warms the search cache for the 50 most popular grocery products.
 *
 * Strategy:
 * 1. Query distinct ZIP codes from `search_activity` that were active in the last 24h.
 * 2. For each active ZIP, iterate through priority products + any custom user queries.
 * 3. Call AggregatorService.search() — populates the DB cache (24h freshness).
 * 4. Stagger requests (3s between each) to avoid slamming the Oxylabs API.
 *
 * Result: Users get instant cached results, and we only pay to scrape ZIPs that are actively used.
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
  private readonly STAGGER_DELAY_MS = 3000; // 3 seconds

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
    @InjectRepository(SearchActivity)
    private readonly searchActivityRepository: Repository<SearchActivity>,
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
   * Cron job: runs daily at 2am (off-peak).
   * Only refreshes ZIPs and queries that had user activity in the last 24 hours.
   */
  @Cron(CRON_SCHEDULES.GROCERY_REFRESH)
  async dailyGroceryCron(): Promise<void> {
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
      // ── Find active ZIPs and their custom queries from the last 24h ──────────────
      const activeData = await this.getActiveZipsAndQueries();
      const zips = Array.from(activeData.keys());

      if (zips.length === 0) {
        this.logger.log('No search activity in the last 24h. Skipping warm cycle.');
        return { success: true, zips: [], productsWarmed: 0, durationMs: Date.now() - startTime };
      }

      this.logger.log(`🔥 Daily Warm-cache starting for ${zips.length} active ZIP(s)`);

      for (const zip of zips) {
        const customQueries = activeData.get(zip) || [];
        // Deduplicate priority items + custom queries
        const itemsToScrape = Array.from(new Set([...this.top15Items, ...customQueries]));

        for (let i = 0; i < itemsToScrape.length; i++) {
          const product = itemsToScrape[i];
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

          // Stagger to avoid Oxylabs rate-limits
          if (i < itemsToScrape.length - 1) {
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
   * Queries search_activity to find ZIPs searched in the last 24 hours,
   * along with the distinct queries searched in each ZIP.
   */
  private async getActiveZipsAndQueries(): Promise<Map<string, string[]>> {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const activities = await this.searchActivityRepository
        .createQueryBuilder('sa')
        .where('sa.searched_at > :yesterday', { yesterday })
        .getMany();

      const map = new Map<string, Set<string>>();
      for (const act of activities) {
        if (!map.has(act.zip)) map.set(act.zip, new Set());
        map.get(act.zip)!.add(act.query);
      }

      // Convert Sets to Arrays
      const resultMap = new Map<string, string[]>();
      for (const [zip, queries] of map.entries()) {
        resultMap.set(zip, Array.from(queries));
      }

      return resultMap;
    } catch (err: any) {
      this.logger.error(`Failed to fetch active ZIPs from search_activity: ${err.message}.`);
      return new Map();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
