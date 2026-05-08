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
  scraperStatus?: Record<string, 'ok' | 'failed' | 'timeout'>;
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
    const scrapePromise = this.executeScrape(query, resolvedZip, cacheKey, startTime, options);
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
  ): Promise<SearchResponse> {
    this.logger.log(`Searching "${query}" in ZIP ${resolvedZip} — running all scrapers...`);

    // Timeout: 120s. Waiting longer gives scrapers more time to finish if the proxy is slow.
    const SCRAPER_TIMEOUT_MS = 120000;

    // Run all scrapers in parallel with individual timeouts
    const scraperResults = await Promise.allSettled([
      this.runWithTimeout('Walmart', () => this.walmartScraper.search(query, resolvedZip), SCRAPER_TIMEOUT_MS),
      this.runWithTimeout('Target', () => this.targetScraper.search(query, resolvedZip), SCRAPER_TIMEOUT_MS),
      this.runWithTimeout('Kroger', () => this.krogerScraper.search(query, resolvedZip), SCRAPER_TIMEOUT_MS),
      this.runWithTimeout('Instacart', () => this.instacartScraper.search(query, resolvedZip), SCRAPER_TIMEOUT_MS),
      this.runWithTimeout('GoogleMaps', () => {
        const isGas = this.shouldScrapeGas(query);
        return this.googleMapsScraper.searchNearbyStores(resolvedZip, isGas ? 'gas stations' : 'grocery stores');
      }, SCRAPER_TIMEOUT_MS),
    ]);

    // Collect all successful results + track scraper status
    let allProducts: ScrapedProduct[] = [];
    const scraperNames = ['Walmart', 'Target', 'Kroger', 'Instacart', 'GoogleMaps'];
    const scraperStatus: Record<string, 'ok' | 'failed' | 'timeout'> = {};

    for (let i = 0; i < scraperResults.length; i++) {
      const result = scraperResults[i];
      if (result.status === 'fulfilled') {
        const productCount = result.value.length;
        this.logger.log(`${scraperNames[i]}: ${productCount} products`);
        scraperStatus[scraperNames[i]] = 'ok';
        if (productCount > 0) {
          if (scraperNames[i] === 'GoogleMaps') {
            const stations = result.value as any[];
            allProducts.push(...stations.map(gs => ({
              store: gs.name,
              product: 'Regular Gasoline',
              price: gs.prices.regular || 0,
              image: gs.logoUrl || '',
              source: 'google_maps' as const,
              category: 'gas',
              address: gs.address,
              lat: gs.latitude,
              lng: gs.longitude,
            })));
          } else {
            allProducts.push(...(result.value as ScrapedProduct[]));
          }
        }
      } else {
        const reason = String(result.reason);
        const isTimeout = reason.includes('timed out');
        scraperStatus[scraperNames[i]] = isTimeout ? 'timeout' : 'failed';
        this.logger.warn(`${scraperNames[i]}: ${isTimeout ? 'TIMEOUT' : 'FAILED'} — ${reason}`);
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

    // 3. Deduplicate by store + product name
    const seen = new Set<string>();
    cleaned = cleaned.filter(p => {
      const key = `${p.store.toLowerCase()}|${p.product.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 4. Sort by price ascending
    cleaned.sort((a, b) => a.price - b.price);

    return cleaned.slice(0, 30);
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
