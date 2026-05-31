import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { WalmartScraperService } from './walmart-scraper.service';
import { TargetScraperService } from './target-scraper.service';
import { KrogerScraperService } from './kroger-scraper.service';
import { InstacartScraperService } from './instacart-scraper.service';
import { GoogleMapsGasScraperService } from './google-maps-gas-scraper.service';

import { SearchCacheService } from './search-cache.service';
import { OxylabsBaseService, ScrapedProduct } from './oxylabs-base.service';
import { StoresService } from '../../stores/stores.service';
import { resolveZipFromRequest } from '../../utils/location.util';
import { combinedSimilarity } from '../../utils/string-similarity.util';
import { geocodePlace, geocodePlaceNear } from '../../utils/geocoding.util';
import { isLikelyUnrelatedProduct } from '../../utils/relevance.util';

/** Search response shape */
export interface SearchResponse {
  success: boolean;
  query: string;
  zip: string;
  count: number;
  cheapest: ScrapedProduct | null;
  responseTimeMs: number;
  data: ScrapedProduct[];
  /** Which scrapers succeeded vs failed */
  scraperStatus?: Record<string, 'ok' | 'failed' | 'timeout' | 'unauthorized'>;
}

/**
 * Master aggregator service.
 * Runs all scrapers in parallel, merges, deduplicates, sorts by price,
 * and returns a unified response. Uses in-memory caching.
 *
 * Key optimizations:
 * - In-flight deduplication: concurrent identical requests share the same Promise
 * - Reduced scraper timeouts (30s) so results come back faster
 * - Partial success: if 1 of 4 scrapers works, those results are returned
 */
@Injectable()
export class AggregatorService {
  private readonly logger = new Logger(AggregatorService.name);
  private readonly DEFAULT_ZIP = '75201';
  private readonly TARGETED_GMAPS_LIMIT = 6;
  private readonly TARGETED_GMAPS_TIMEOUT_MS = 12000;

  /**
   * In-flight request deduplication.
   * If a scrape for "milk:10001" is already running, new callers
   * get the same Promise instead of spawning a duplicate scrape.
   */
  private readonly inFlightRequests = new Map<string, Promise<SearchResponse>>();
  private readonly scraperFailCount = new Map<string, number>();
  private readonly scraperFailTime = new Map<string, number>();

  constructor(
    private readonly walmartScraper: WalmartScraperService,
    private readonly targetScraper: TargetScraperService,
    private readonly krogerScraper: KrogerScraperService,
    private readonly instacartScraper: InstacartScraperService,
    private readonly googleMapsScraper: GoogleMapsGasScraperService,

    private readonly storesService: StoresService,
    private readonly cache: SearchCacheService,
  ) {}

  /**
   * Main search entry point.
   * Resolves ZIP, checks cache, deduplicates in-flight requests,
   * runs scrapers in parallel, cleans results.
   */
  async search(
    query: string,
    zip?: string,
    req?: any,
    options?: { bypassCache?: boolean },
    userLat?: number,
    userLng?: number,
  ): Promise<SearchResponse> {
    const startTime = Date.now();
    const resolvedZip = zip || await resolveZipFromRequest(req, this.DEFAULT_ZIP);
    const cacheKey = this.cache.makeKey(query, resolvedZip);

    // 1. Check in-memory cache first (instant)
    const cached = options?.bypassCache ? null : this.cache.get<SearchResponse>(cacheKey);
    if (cached && !options?.bypassCache) {
      this.logger.log(`Returning cached results for "${query}" in ${resolvedZip}`);
      return { ...cached, responseTimeMs: Date.now() - startTime };
    }

    // 2. Check if an identical request is already in-flight (deduplication)
    const existingRequest = this.inFlightRequests.get(cacheKey);
    if (existingRequest) {
      this.logger.log(`Joining in-flight request for "${query}" in ${resolvedZip}`);
      try {
        const result = await existingRequest;
        return { ...result, responseTimeMs: Date.now() - startTime };
      } catch {
        // If the in-flight request failed, we'll proceed to start a new one
        this.logger.warn(`In-flight request for "${query}" failed, starting new scrape`);
      }
    }

    // 3. Start a new scrape and register it as in-flight
    const scrapePromise = this.executeScrape(query, resolvedZip, cacheKey, startTime, options, userLat, userLng);
    this.inFlightRequests.set(cacheKey, scrapePromise);

    try {
      const result = await scrapePromise;
      return result;
    } finally {
      // Clean up in-flight tracker once done (whether success or failure)
      this.inFlightRequests.delete(cacheKey);
    }
  }

  /**
   * Actual scrape execution — separated so we can deduplicate concurrent calls.
   */
  private async executeScrape(
    query: string, 
    resolvedZip: string, 
    cacheKey: string, 
    startTime: number,
    options?: { bypassCache?: boolean },
    userLat?: number,
    userLng?: number,
  ): Promise<SearchResponse> {
    this.logger.log(`Searching "${query}" in ZIP ${resolvedZip} — running all scrapers...`);

    // 1. Determine which GMaps searches to run
    const isGas = this.shouldScrapeGas(query);
    const isPharmacy = this.shouldScrapePharmacy(query);
    const isAll = query.toLowerCase() === 'all' || query.toLowerCase() === 'stores' || (!isGas && !isPharmacy);

    const gMapsTypes: string[] = [];
    if (isPharmacy || isAll) gMapsTypes.push('pharmacies');
    if (!isGas || isAll) {
      gMapsTypes.push(
        'grocery stores',
        'supermarket',
        'supercenter',
        'food market',
        'warehouse club',
        'discount store'
      );
    }

    // Check Kroger Circuit Breaker
    const krogerFailKey = `kroger:${resolvedZip}`;
    const krogerFails = this.scraperFailCount.get(krogerFailKey) ?? 0;
    const krogerLastFail = this.scraperFailTime.get(krogerFailKey) ?? 0;
    let skipKroger = false;
    
    if (krogerFails >= 3) {
      // 1 hour cooldown
      if (Date.now() - krogerLastFail < 60 * 60 * 1000) {
        this.logger.warn(`Kroger scraper disabled for ZIP ${resolvedZip} for 1 hour — 3 consecutive 0-result responses`);
        skipKroger = true;
      } else {
        // Reset after 1 hour
        this.scraperFailCount.delete(krogerFailKey);
      }
    }

    // 2. Prepare all scraper promises
    const scraperPromises: Promise<any>[] = [
      this.runWithTimeout('Walmart', () => this.walmartScraper.search(query, resolvedZip), 15000),
      this.runWithTimeout('Target', () => this.targetScraper.search(query, resolvedZip), 15000),
      skipKroger ? Promise.resolve([]) : this.runWithTimeout('Kroger', () => this.krogerScraper.search(query, resolvedZip), 15000),
      this.runWithTimeout('Instacart', () => this.instacartScraper.search(query, resolvedZip), 20000),
      // Run multiple GMaps searches in parallel — use coords-based search when available for accuracy
      Promise.all(gMapsTypes.map(type => 
        this.runWithTimeout(
          `GoogleMaps (${type})`,
          () => (userLat && userLng)
            ? this.googleMapsScraper.searchNearbyStoresByCoords(userLat, userLng, type)
            : this.googleMapsScraper.searchNearbyStores(resolvedZip, type),
          this.TARGETED_GMAPS_TIMEOUT_MS
        ).catch(() => [])
      )).then(results => {
        const allStores = results.flat();
        const seen = new Set<string>();
        return allStores.filter(store => {
          if (seen.has(store.stationId)) return false;
          seen.add(store.stationId);
          return true;
        });
      }),
    ];

    const scraperNames = ['Walmart', 'Target', 'Kroger', 'Instacart', 'GoogleMaps'];
    const scraperResults = await Promise.allSettled(scraperPromises);

    // 3. Collect and tag results
    let allProducts: ScrapedProduct[] = [];
    const scraperStatus: Record<string, 'ok' | 'failed' | 'timeout' | 'unauthorized'> = {};

    for (let i = 0; i < scraperResults.length; i++) {
      const result = scraperResults[i];
      const scraperName = scraperNames[i];

      // Kroger Circuit Breaker Logic
      if (scraperName === 'Kroger' && !skipKroger) {
        const isFailed = result.status === 'rejected' || (result.status === 'fulfilled' && Array.isArray(result.value) && result.value.length === 0);
        if (isFailed) {
          const fails = (this.scraperFailCount.get(krogerFailKey) ?? 0) + 1;
          this.scraperFailCount.set(krogerFailKey, fails);
          this.scraperFailTime.set(krogerFailKey, Date.now());
        } else {
          this.scraperFailCount.delete(krogerFailKey);
        }
      }

      if (result.status === 'fulfilled') {
        scraperStatus[scraperName] = 'ok';
        if (result.value) {
          if (scraperName === 'GoogleMaps') {
            const stations = result.value as any[];
            allProducts.push(...stations.map(gs => {
              const name = gs.name.toLowerCase();
              let category: 'gas' | 'grocery' | 'pharmacy' = 'grocery';
              if (name.includes('gas') || name.includes('fuel') || name.includes('chevron') || name.includes('shell')) {
                category = 'gas';
              } else if (name.includes('pharmacy') || name.includes('cvs') || name.includes('walgreens') || name.includes('rite aid')) {
                category = 'pharmacy';
              }

              return {
                store: gs.name,
                product: category === 'gas' ? 'Regular Gasoline' : (category === 'pharmacy' ? 'Pharmacy' : 'Grocery Store'),
                price: gs.prices?.regular || 0,
                image: gs.logoUrl || '',
                source: 'google_maps' as const,
                category,
                address: gs.address,
                lat: gs.latitude,
                lng: gs.longitude,
              };
            }));
          } else {
            const products = (result.value as ScrapedProduct[]).map(p => ({
              ...p,
              category: p.category || this.determineCategory(query, p.product, p.store),
            }));
            allProducts.push(...products);
          }
        }
      } else {
        const reason = result.reason as any;
        const statusCode = reason?.response?.status;
        const message = String(reason);
        if (statusCode === 401) {
          scraperStatus[scraperName] = 'unauthorized';
          this.logger.warn(`${scraperName}: UNAUTHORIZED — ${message}`);
          continue;
        }
        const reasonText = String(reason);
        const isTimeout = reasonText.includes('timed out');
        scraperStatus[scraperName] = isTimeout ? 'timeout' : 'failed';
        this.logger.warn(`${scraperName}: ${isTimeout ? 'TIMEOUT' : 'FAILED'} — ${reasonText}`);
      }
    }

    // 4. Enrich products with real coordinates from our database OR Google Maps
    const dbStores = await this.storesService.findAll();
    const gMapsResults = scraperResults[scraperNames.indexOf('GoogleMaps')];
    const discoveredStores = (gMapsResults.status === 'fulfilled' && gMapsResults.value.length > 0) 
      ? gMapsResults.value as any[] 
      : [];
      
    // Step 4a: First pass enrichment from DB and initial GMaps results
    allProducts = allProducts.map(p => {
      if (!p.lat || !p.lng) {
        // Try DB first (only stores with real coordinates, and match by store name OR chain name)
        const storeKey = p.store.toLowerCase();
        const candidates = dbStores
          .filter((s: any) => Number(s.lat) !== 0 && Number(s.lng) !== 0)
          .filter((s: any) => {
            const storeName = (s.name || '').toLowerCase();
            const chainName = (s.chain?.name || '').toLowerCase();
            return (
              storeName.includes(storeKey) ||
              storeKey.includes(storeName) ||
              chainName.includes(storeKey) ||
              storeKey.includes(chainName)
            );
          })
          .map((s: any) => ({
            store: s,
            score: Math.max(
              combinedSimilarity(s.name || '', p.store),
              combinedSimilarity(s.chain?.name || '', p.store),
            ),
          }))
          .sort((a, b) => b.score - a.score);

        const dbMatch = candidates[0]?.store;
        if (dbMatch) return { ...p, lat: Number(dbMatch.lat), lng: Number(dbMatch.lng), address: dbMatch.address };

        // Try initial GMaps results
        const mapMatch = discoveredStores.find(ds => 
          ds.name.toLowerCase().includes(p.store.toLowerCase()) || 
          p.store.toLowerCase().includes(ds.name.toLowerCase())
        );
        if (mapMatch && mapMatch.latitude !== 0) {
          return { ...p, lat: mapMatch.latitude, lng: mapMatch.longitude, address: mapMatch.address };
        }
      }
      return p;
    });

    // Step 4b: Proactive GMaps search for remaining stores without coordinates
    // Keep this bounded so compare responses stay fast on mobile.
    const missingStores = [
      ...new Set(
        allProducts
          .filter(p => !p.lat || !p.lng)
          .map(p => (p.store || '').trim())
          .filter(name => this.isValidTargetedStoreName(name)),
      ),
    ];
    if (missingStores.length > 0) {
      this.logger.log(`Proactively searching Google Maps for ${missingStores.length} missing store locations: ${missingStores.join(', ')}`);
      const zipCenter = await geocodePlace(resolvedZip);
      
      // Search only top missing stores and enforce timeout per lookup.
      const searchPromises = missingStores.slice(0, this.TARGETED_GMAPS_LIMIT).map(async (storeName) => {
        try {
          const targetedResults = await this.runWithTimeout(
            `GoogleMaps targeted (${storeName})`,
            () => this.googleMapsScraper.searchNearbyStores(resolvedZip, storeName),
            this.TARGETED_GMAPS_TIMEOUT_MS,
          );
          if (targetedResults.length > 0) {
            // Find the best match using fuzzy name matching
            const bestMatch = targetedResults.find(tr => 
              tr.name.toLowerCase().includes(storeName.toLowerCase()) || 
              storeName.toLowerCase().includes(tr.name.toLowerCase())
            ) || targetedResults[0];

            if (bestMatch && bestMatch.latitude !== 0) {
              this.logger.log(`Found location for ${storeName}: (${bestMatch.latitude}, ${bestMatch.longitude})`);
              allProducts = allProducts.map(p => {
                if (p.store === storeName && (!p.lat || !p.lng)) {
                  return { 
                    ...p, 
                    lat: bestMatch.latitude, 
                    lng: bestMatch.longitude, 
                    address: bestMatch.address || p.address 
                  };
                }
                return p;
              });
            } else {
              this.logger.warn(`Could not find coordinates for ${storeName} even with targeted GMaps search.`);
            }
          } 

          // If Google Maps scraping fails (often due to provider errors), fall back to Nominatim geocoding.
          // This is less precise than place-level results but gives real (non-jitter) coordinates.
          const stillMissing = allProducts.some(p => p.store === storeName && (!p.lat || !p.lng));
          if (stillMissing) {
            const geo = zipCenter
              ? await geocodePlaceNear(storeName, zipCenter.lat, zipCenter.lng)
              : await geocodePlace(`${storeName} ${resolvedZip}`);
            if (geo) {
              this.logger.log(`Geocoded ${storeName} near ${resolvedZip}: (${geo.lat}, ${geo.lng})`);
              allProducts = allProducts.map(p => {
                if (p.store === storeName && (!p.lat || !p.lng)) {
                  return {
                    ...p,
                    lat: geo.lat,
                    lng: geo.lng,
                    address: p.address || geo.displayName,
                  };
                }
                return p;
              });
            } else {
              this.logger.warn(`Geocoding fallback failed for ${storeName} near ${resolvedZip}`);
            }
          }
        } catch (e) {
          this.logger.error(`Targeted GMaps search failed for ${storeName}: ${e.message}`);
        }
      });

      await Promise.all(searchPromises);
    }

    // Step 4c: Fire-and-forget — persist newly discovered stores to DB so next request hits DB not Google Maps
    const storesByName = new Map<string, ScrapedProduct>();
    for (const p of allProducts) {
      if (!p.lat || !p.lng || p.lat === 0 || p.lng === 0) continue;
      const key = (p.store || '').toLowerCase().trim();
      if (!storesByName.has(key)) storesByName.set(key, p);
    }
    if (storesByName.size > 0) {
      this.storesService.upsertDiscoveredStores(Array.from(storesByName.values()))
        .catch(err => this.logger.error(`Failed to upsert discovered stores: ${err.message}`));
    }

    // If all scrapers failed, use fallback
    if (allProducts.length === 0) {
      this.logger.warn(`All scrapers failed for "${query}". Using fallback data.`);
      allProducts = this.getFallbackProducts(query);
    }

    // Clean, deduplicate, sort
    const cleaned = this.cleanResults(allProducts, query);

    const response: SearchResponse = {
      success: true,
      query,
      zip: resolvedZip,
      count: cleaned.length,
      cheapest: cleaned[0] || null,
      responseTimeMs: Date.now() - startTime,
      data: cleaned,
      scraperStatus,
    };

    // Cache for 1 hour
    if (!options?.bypassCache) {
      this.cache.set(cacheKey, response);
    }

    this.logger.log(`Search "${query}" completed in ${response.responseTimeMs}ms — ${cleaned.length} results`);
    return response;
  }


  // ─── Data Cleaning ──────────────────────────────────────────

  private cleanResults(products: ScrapedProduct[], query: string): ScrapedProduct[] {
    // 1. Normalize product names
    let cleaned = products.map(p => ({
      ...p,
      product: this.normalizeName(p.product),
      price: typeof p.price === 'number' ? p.price : parseFloat(String(p.price)) || 0,
    }));

    // 2. Remove items with no price, irrelevant names, or junk
    cleaned = cleaned.filter(p =>
      p.price > 0.1 &&
      p.price < 500 &&
      p.product.length > 3 &&
      p.store.length > 0 &&
      !p.product.includes('{') &&
      !p.product.includes('window.') &&
      !p.product.includes('function(') &&
      !p.product.includes('typeof') &&
      !p.product.includes('null') &&
      !p.product.toLowerCase().includes('new at') &&
      !p.product.toLowerCase().includes('when purchased online') &&
      !p.product.toLowerCase().includes('see terms')
    );

    // 2b. Drop obviously unrelated products that happen to contain the query term.
    cleaned = cleaned.filter(p => !isLikelyUnrelatedProduct(p.product, query));

    // 3. Deduplicate by store + product name
    const seen = new Set<string>();
    cleaned = cleaned.filter(p => {
      const key = `${p.store.toLowerCase()}|${p.product.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 4. Cap per store at 5 results to prevent one retailer flooding the list and crowding out others
    const byStore = new Map<string, ScrapedProduct[]>();
    for (const p of cleaned) {
      const key = (p.store || '').toLowerCase().trim();
      if (!byStore.has(key)) byStore.set(key, []);
      const storeProducts = byStore.get(key)!;
      if (storeProducts.length < 5) storeProducts.push(p);
    }

    // Flatten and sort by price ascending — no global cap, radius filtering happens downstream
    const balanced = Array.from(byStore.values()).flat();
    balanced.sort((a, b) => a.price - b.price);
    return balanced;
  }

  private shouldScrapePharmacy(query: string): boolean {
    const q = query.toLowerCase();
    return q.includes('pharmacy') || q.includes('cvs') || q.includes('walgreens') || 
           q.includes('medicine') || q.includes('drug') || q.includes('health') ||
           q.includes('vitamin') || q.includes('relief') || q.includes('care') ||
           q.includes('thermometer') || q.includes('test') || q.includes('bandage');
  }

  public determineCategory(query: string, productName: string, storeName?: string): 'grocery' | 'gas' | 'pharmacy' {
    const combined = `${query} ${productName} ${storeName || ''}`.toLowerCase();
    
    if (combined.includes('gasoline') || combined.includes('fuel') || combined.includes('diesel') || combined.includes('gas station')) {
      return 'gas';
    }

    // Exempt common grocery items that might trigger pharmacy keywords
    if (combined.includes('milk') || combined.includes('bread') || combined.includes('egg') || combined.includes('cheese')) {
      return 'grocery';
    }

    // Ignore 'vitamin d' and 'vitamin c' (e.g., milk with vitamin D) when checking for generic 'vitamin'
    const cleanCombined = combined.replace('vitamin d', '').replace('vitamin c', '').replace('health & wellness', '');
    
    if (
      cleanCombined.includes('pharmacy') || cleanCombined.includes('medicine') || cleanCombined.includes('pill') || 
      cleanCombined.includes('health') || cleanCombined.includes('drug') || cleanCombined.includes('prescription') ||
      cleanCombined.includes('tylenol') || cleanCombined.includes('advil') || cleanCombined.includes('claritin') ||
      cleanCombined.includes('vitamin') || cleanCombined.includes('relief') || cleanCombined.includes('care') ||
      cleanCombined.includes('thermometer') || cleanCombined.includes('bandage') || cleanCombined.includes('mask') ||
      cleanCombined.includes('test kit') || cleanCombined.includes('cvs') || cleanCombined.includes('walgreens') ||
      cleanCombined.includes('rite aid') || cleanCombined.includes('pharm')
    ) {
      return 'pharmacy';
    }
    
    return 'grocery';
  }

  private shouldScrapeGas(query: string): boolean {
    const q = query.toLowerCase();
    return q.includes('gas') || q.includes('fuel') || q.includes('diesel') || q.includes('station');
  }

  private isValidTargetedStoreName(name: string): boolean {
    const normalized = name.toLowerCase().trim();
    if (!normalized) return false;
    if (normalized.length < 3) return false;
    if (normalized === 'sponsored') return false;
    if (normalized.startsWith('sponsored')) return false;
    return true;
  }

  private normalizeName(name: string): string {
    if (!name) return '';
    return name
      .replace(/\s+/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
      .trim();
  }

  // ─── Timeout Wrapper ───────────────────────────────────────

  private async runWithTimeout<T>(
    name: string,
    fn: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${name} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(err => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  // ─── Fallback Data ─────────────────────────────────────────

  private getFallbackProducts(query: string): ScrapedProduct[] {
    const q = query.toLowerCase();

    if (q.includes('milk')) {
      return [
        { store: 'Walmart', product: 'Great Value Whole Milk 1 Gallon', price: 3.36, image: '', source: 'direct' },
        { store: 'Target', product: 'Good & Gather Whole Milk 1 Gallon', price: 3.59, image: '', source: 'direct' },
        { store: 'Kroger', product: 'Kroger Vitamin D Whole Milk 1 Gallon', price: 3.49, image: '', source: 'direct' },
        { store: 'Aldi', product: 'Friendly Farms Whole Milk 1 Gallon', price: 2.95, image: '', source: 'instacart' },
        { store: 'Costco', product: 'Kirkland Organic Whole Milk 1 Gallon', price: 4.99, image: '', source: 'instacart' },
      ];
    }

    if (q.includes('bread')) {
      return [
        { store: 'Walmart', product: 'Great Value White Bread 20 oz', price: 1.18, image: '', source: 'direct' },
        { store: 'Target', product: "Nature's Own Butter Bread 20 oz", price: 3.99, image: '', source: 'direct' },
        { store: 'Kroger', product: 'Kroger White Bread 20 oz', price: 1.49, image: '', source: 'direct' },
        { store: 'Aldi', product: "L'oven Fresh White Bread 20 oz", price: 0.95, image: '', source: 'instacart' },
      ];
    }

    if (q.includes('coca') || q.includes('coke') || q.includes('cola')) {
      return [
        { store: 'Walmart', product: 'Coca-Cola 12 Pack 12 oz Cans', price: 5.98, image: '', source: 'direct' },
        { store: 'Target', product: 'Coca-Cola 12 Pack 12 oz Cans', price: 7.49, image: '', source: 'direct' },
        { store: 'Kroger', product: 'Coca-Cola 12 Pack 12 oz Cans', price: 6.49, image: '', source: 'direct' },
        { store: 'Costco', product: 'Coca-Cola 35 Pack 12 oz Cans', price: 15.99, image: '', source: 'instacart' },
      ];
    }

    if (q.includes('egg')) {
      return [
        { store: 'Walmart', product: 'Great Value Large Eggs 12 ct', price: 2.62, image: '', source: 'direct' },
        { store: 'Aldi', product: 'Goldhen Large Eggs 12 ct', price: 2.15, image: '', source: 'instacart' },
        { store: 'Kroger', product: 'Kroger Large Eggs 12 ct', price: 2.79, image: '', source: 'direct' },
      ];
    }

    // Generic fallback
    return [
      { store: 'Walmart', product: `${query} (Sample)`, price: 3.99, image: '', source: 'direct' },
      { store: 'Target', product: `${query} (Sample)`, price: 4.49, image: '', source: 'direct' },
      { store: 'Kroger', product: `${query} (Sample)`, price: 4.29, image: '', source: 'direct' },
    ];
  }
}
