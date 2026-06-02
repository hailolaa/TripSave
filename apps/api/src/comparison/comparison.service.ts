import { Injectable, Logger } from '@nestjs/common';
import NodeCache from 'node-cache';
import { OsrmService } from '../integrations/osrm/osrm.service';
import { StoresService } from '../stores/stores.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { StoreProduct } from '../products/store-product.entity';
import { StoreChainType } from '../stores/store-chain.entity';
import { GasPrice } from '../gas/gas-price.entity';
import { Product } from '../products/product.entity';
import { Store } from '../stores/store.entity';
import { AggregatorService } from '../providers/oxylabs/aggregator.service';
import { ProductsService } from '../products/products.service';
import { ProductImageService } from '../products/product-image.service';
import { ScrapedProduct } from '../providers/oxylabs/oxylabs-base.service';
import {
  calculateDriveCost,
  metersToMiles,
  haversineDistanceMiles,
} from '../utils/geo.util';
import { geocodePlaceNear, getNeighboringZips } from '../utils/geocoding.util';
import { GasSyncService } from '../services/gas-sync.service';
import {
  isBlocklisted,
  scoreProductRelevance,
  classifySearchIntent,
} from '../utils/relevance.util';
import { combinedSimilarity } from '../utils/string-similarity.util';
import { SearchActivity } from '../models/search-activity.entity';

@Injectable()
export class ComparisonService {
  private readonly logger = new Logger(ComparisonService.name);

  /** In-flight request deduplication — prevents duplicate DB/scrape calls for the same query+zip */
  private readonly inFlight = new Map<string, Promise<any>>();

  /** Short-lived lock to prevent repeated scrape fan-out while a query is warming */
  private readonly warmLocks = new NodeCache({ stdTTL: 30, useClones: false });

  /** In-memory L1 cache (24h default TTL) to avoid DB trips for repeated identical searches */
  private readonly l1Cache = new NodeCache({ stdTTL: 86400 });

  constructor(
    private readonly osrmService: OsrmService,
    private readonly storesService: StoresService,
    private readonly aggregatorService: AggregatorService,
    private readonly productsService: ProductsService,
    private readonly gasSyncService: GasSyncService,
    private readonly productImageService: ProductImageService,
    @InjectRepository(StoreProduct)
    private storeProductsRepository: Repository<StoreProduct>,
    @InjectRepository(GasPrice)
    private gasPriceRepository: Repository<GasPrice>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Store)
    private storesRepository: Repository<Store>,
    @InjectRepository(SearchActivity)
    private searchActivityRepository: Repository<SearchActivity>,
  ) {}

  private async recordSearchActivity(zip: string, query: string) {
    try {
      const cleanQuery = query.toLowerCase().trim();
      await this.searchActivityRepository.upsert(
        { zip, query: cleanQuery, searched_at: new Date() },
        ['zip', 'query'],
      );
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to record search activity for ${query} in ${zip}: ${message}`,
      );
    }
  }

  /**
   * Compare prices for a single item across all nearby stores.
   *
   * Flow:
   * 1. Check DB for fresh data (< 24h) — if found, return instantly (no scraping).
   * 2. If stale/missing, run live scrape via AggregatorService.
   *    - AggregatorService uses Promise.allSettled(), so partial failures
   *      (e.g. Kroger down but Walmart/Target succeed) are handled gracefully.
   * 3. Background-save scraped results to DB so the next request within 24h
   *    hits the DB cache instead of scraping again.
   */
  async compareItem(
    itemName: string,
    userLat: number,
    userLng: number,
    userMpg: number,
    gasPrice: number,
    zipCode?: string,
    storeType?: StoreChainType,
    isRoundTrip: boolean = true,
    sortBy: string = 'true_cost',
    forceRefresh: boolean = false,
    preferredRadius: number = 20,
  ) {
    const resolvedZip = zipCode || '75201';
    const dedupeKey = `${itemName.toLowerCase().trim()}:${resolvedZip}:${storeType || 'all'}:${isRoundTrip}:${preferredRadius}`;

    if (!forceRefresh) {
      const hit = this.l1Cache.get<any>(dedupeKey);
      if (hit) {
        this.logger.log(`L1 Cache hit for "${itemName}" in ${resolvedZip}`);
        return hit;
      }
    }

    // ── In-flight deduplication — join existing request if identical ──
    const existingRequest = this.inFlight.get(dedupeKey);
    if (existingRequest && !forceRefresh) {
      this.logger.log(
        `Joining in-flight compareItem for "${itemName}" in ${resolvedZip}`,
      );
      return existingRequest;
    }

    const promise = this._executeCompareItem(
      dedupeKey,
      itemName,
      userLat,
      userLng,
      userMpg,
      gasPrice,
      resolvedZip,
      storeType,
      isRoundTrip,
      sortBy,
      forceRefresh,
      preferredRadius,
    ).then((result) => {
      if (result && result.status === 'ready' && result.results.length > 0) {
        const ttl =
          storeType === 'gas' || itemName.toLowerCase() === 'gas'
            ? 4 * 3600
            : 24 * 3600; // 4h gas, 24h grocery
        this.l1Cache.set(dedupeKey, result, ttl);
      }
      return result;
    });
    this.inFlight.set(dedupeKey, promise);

    try {
      return await promise;
    } finally {
      this.inFlight.delete(dedupeKey);
    }
  }

  /**
   * Applies blocklist and relevance scoring to raw products.
   * Discards products below the threshold (default 40).
   * Gracefully degrades threshold to 20 if less than 5 products pass.
   */
  private applyRelevanceFilter(
    products: ScrapedProduct[],
    query: string,
  ): ScrapedProduct[] {
    const intent = classifySearchIntent(query);
    const searchWord = intent ? intent.canonical : query;

    const scored = products
      .filter((p) => !isBlocklisted(p.product, searchWord))
      .map((p) => ({
        ...p,
        relevanceScore: scoreProductRelevance(p.product, searchWord),
      }));

    let filtered = scored.filter((p) => p.relevanceScore! >= 40);

    // Graceful degradation
    if (filtered.length < 5) {
      filtered = scored.filter((p) => p.relevanceScore! >= 20);
      if (filtered.length < scored.length) {
        this.logger.warn(
          `[ComparisonService] Relevance filter relaxed for query: "${query}" — only ${filtered.length} results passed strict filter.`,
        );
      }
    }

    return filtered.sort((a, b) => b.relevanceScore! - a.relevanceScore!);
  }

  /**
   * Internal execution of compareItem, separated for in-flight dedup.
   */
  private async _executeCompareItem(
    dedupeKey: string,
    itemName: string,
    userLat: number,
    userLng: number,
    userMpg: number,
    gasPrice: number,
    resolvedZip: string,
    storeType?: StoreChainType,
    isRoundTrip: boolean = true,
    sortBy: string = 'true_cost',
    forceRefresh: boolean = false,
    preferredRadius: number = 20,
  ) {
    // ── Step 1: Check DB for data (allow stale) ────────────
    this.logger.log(
      `Checking DB for data: "${itemName}" in ZIP ${resolvedZip} and its neighbors`,
    );

    // Record search activity so cron knows this is active
    this.recordSearchActivity(resolvedZip, itemName);

    // Get all neighboring ZIPs
    const zipsToSearch = await getNeighboringZips(
      userLat,
      userLng,
      resolvedZip,
    );

    let isStale = false;
    let cachedAt = new Date();
    let mergedDbProducts: ScrapedProduct[] = [];

    if (!forceRefresh) {
      const allResults = await Promise.all(
        zipsToSearch.map((z) =>
          this.productsService.searchFromDbWithStaleness(itemName, z),
        ),
      );

      const validResults = allResults.filter(Boolean);
      if (validResults.length > 0) {
        const allProducts = validResults.flatMap((r) => r!.products);
        // Deduplicate products from overlapping ZIP caches
        const seen = new Set<string>();
        mergedDbProducts = allProducts.filter((p) => {
          const storeName =
            typeof p.store === 'string'
              ? p.store
              : (p.store as any)?.name || '';
          const productName =
            typeof p.product === 'string'
              ? p.product
              : (p.product as any)?.name || '';
          const key = `${storeName.toLowerCase().trim()}|${productName.toLowerCase().trim()}|${p.price}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        this.logger.log(
          `Multi-ZIP merge: ${allProducts.length} total → ${mergedDbProducts.length} after dedup`,
        );
        // Determine staleness and cachedAt from the combined results
        isStale = validResults.some((r) => r!.isStale);
        cachedAt = validResults.reduce(
          (max, r) => (r!.newestVerifiedAt > max ? r!.newestVerifiedAt : max),
          new Date(0),
        );
      }
    }

    if (mergedDbProducts.length > 0) {
      const filteredDbProducts = this.applyRelevanceFilter(
        mergedDbProducts,
        itemName,
      );

      this.logger.log(
        `DB cache hit: ${filteredDbProducts.length} relevant results for "${itemName}" across ${zipsToSearch.length} ZIPs (Stale: ${isStale}).`,
      );
      let items = await this.formatScrapedForUI(
        filteredDbProducts,
        resolvedZip,
        'database',
        userLat,
        userLng,
        userMpg,
        gasPrice,
        isRoundTrip,
        preferredRadius,
        itemName,
      );

      items = this.filterComparisonItems(items, itemName, storeType);

      if (isStale) {
        this.logger.log(
          `Data for "${itemName}" is stale but serving from cache. Cron will refresh.`,
        );
      }

      return {
        status: 'ready',
        results: this.sortComparisons(items, sortBy),
        meta: {
          cachedAt: cachedAt.toISOString(),
          ageHours: Math.floor((Date.now() - cachedAt.getTime()) / 3600000),
          label:
            Math.floor((Date.now() - cachedAt.getTime()) / 3600000) < 1
              ? 'Prices updated just now'
              : Math.floor((Date.now() - cachedAt.getTime()) / 3600000) < 24
                ? `Prices updated ${Math.floor((Date.now() - cachedAt.getTime()) / 3600000)}h ago`
                : 'Prices updated yesterday',
        },
      };
    }

    // ── Step 2: No DB data — fire scrape as background job ─────
    const warmLockKey = `warm:${dedupeKey}`;
    if (this.warmLocks.get(warmLockKey)) {
      this.logger.log(
        `Warm lock hit for "${itemName}" in ${resolvedZip}; reusing in-progress scrape.`,
      );
      return { status: 'warming', results: [] };
    }

    this.warmLocks.set(warmLockKey, true);
    this.logger.log(
      `No DB data for "${itemName}". Firing background scrapes for ZIPs: ${zipsToSearch.join(', ')}...`,
    );

    // Fire the scrape as a background job for all neighboring ZIPs
    zipsToSearch.forEach((zip) => {
      this.aggregatorService
        .search(
          itemName,
          zip,
          undefined,
          { bypassCache: forceRefresh },
          userLat,
          userLng,
        )
        .then(async (scraperResult) => {
          if (scraperResult.data.length > 0) {
            const filtered = this.applyRelevanceFilter(
              scraperResult.data,
              itemName,
            );
            this.logger.log(
              `Background scrape for ZIP ${zip} returned ${scraperResult.data.length} results, ${filtered.length} passed relevance for "${itemName}".`,
            );
            if (filtered.length > 0) {
              await this.productsService
                .upsertScrapedProducts(filtered, zip)
                .catch((err) =>
                  this.logger.error(
                    `Background DB save failed for "${itemName}" in ${zip}: ${err.message}`,
                  ),
                );
            }
          }
        })
        .catch((err) =>
          this.logger.error(
            `Background scrape failed for "${itemName}" in ${zip}: ${err.message}`,
          ),
        );
    });

    // Return warming status immediately — client will poll
    return { status: 'warming', results: [] };
  }

  /**
   * Converts ScrapedProduct[] into the UI-compatible comparison shape
   * that the mobile app expects.
   */
  private async formatScrapedForUI(
    products: ScrapedProduct[],
    zip: string,
    source: 'database' | 'live',
    userLat: number,
    userLng: number,
    userMpg: number,
    gasPrice: number,
    isRoundTrip: boolean = true,
    preferredRadius: number = 20,
    query: string = '',
  ) {
    const normalizedQuery = query.toLowerCase().trim();
    const isGasSearch = ['gas', 'fuel', 'diesel'].includes(normalizedQuery);

    // Get nearby stores once to avoid multiple DB calls
    const nearbyStores = await this.storesService.findNearbyStores(
      userLat,
      userLng,
      preferredRadius,
    );

    // Get all gas prices for these stores if they are gas stations
    const storeIds = nearbyStores.map((ns) => ns.store.id);
    const gasPrices = await this.gasPriceRepository.find({
      where: { store_id: In(storeIds) },
    });

    // If DB-cached items don't include coordinates and we don't have a local DB store match,
    // enrich store coordinates via bounded geocoding near the user's current location.
    // This prevents "0,0" coords and removes the jitter fallback for real users.
    const missingCoordStoreNames = [
      ...new Set(
        products
          .filter((p) => !p.lat || !p.lng)
          .map((p) => (p.store || '').trim())
          .filter(Boolean),
      ),
    ];

    const storeCoordOverrides = new Map<
      string,
      { lat: number; lng: number; address?: string }
    >();
    const MAX_GEOCODE = 10; // keep requests bounded and responsive
    await Promise.allSettled(
      missingCoordStoreNames.slice(0, MAX_GEOCODE).map(async (storeName) => {
        // If we already have a nearby DB store match by name within 8 miles, no need to geocode
        const localMatch = nearbyStores.find((ns) => {
          const score = Math.max(
            combinedSimilarity(ns.store.name, storeName),
            combinedSimilarity(ns.store.chain?.name || '', storeName),
          );
          return score >= 0.6 && ns.distance <= preferredRadius;
        });
        if (localMatch) return;

        const geo = await geocodePlaceNear(storeName, userLat, userLng, 0.35);
        if (geo) {
          storeCoordOverrides.set(storeName.toLowerCase(), {
            lat: geo.lat,
            lng: geo.lng,
            address: geo.displayName,
          });

          // PERSISTENCE: If we have a store in the DB with 0,0 coords, update it now
          // so we don't have to geocode it again next time.
          try {
            const storeToUpdate = await this.storesRepository.findOne({
              where: { name: storeName, lat: 0, lng: 0 },
            });
            if (storeToUpdate) {
              this.logger.log(
                `Fixing 0,0 coordinates for store "${storeName}" -> ${geo.lat}, ${geo.lng}`,
              );
              storeToUpdate.lat = geo.lat;
              storeToUpdate.lng = geo.lng;
              if (!storeToUpdate.address)
                storeToUpdate.address = geo.displayName;
              await this.storesRepository.save(storeToUpdate);
            }
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            this.logger.warn(
              `Failed to persist geocoded coordinates for ${storeName}: ${message}`,
            );
          }
        }
      }),
    );

    const comparisons = await Promise.all(
      products.map(async (item: any) => {
        const storeName =
          typeof item.store === 'string' ? item.store : item.store?.name || '';
        const productName =
          typeof item.product === 'string'
            ? item.product
            : item.product?.name || '';
        const itemCategory =
          (item as any).category ||
          this.aggregatorService.determineCategory('', productName, storeName);

        // Find the nearest local store using fuzzy similarity — handles apostrophes, abbreviations, chain suffixes
        let localMatch = nearbyStores.find((ns) => {
          const score = Math.max(
            combinedSimilarity(ns.store.name, storeName),
            combinedSimilarity(ns.store.chain?.name || '', storeName),
          );
          return score >= 0.6 && ns.distance <= preferredRadius;
        });

        const override = storeCoordOverrides.get(storeName.toLowerCase());

        // If no fuzzy match and no geocoded override, try a looser chain-prefix match within full radius
        if (!localMatch && !override) {
          localMatch = nearbyStores.find((ns) => {
            const score = Math.max(
              combinedSimilarity(ns.store.name, storeName),
              combinedSimilarity(ns.store.chain?.name || '', storeName),
            );
            return score >= 0.4 && ns.distance <= preferredRadius;
          });
        }

        let distance = 0;
        let driveCost = 0;
        let storeData: any = {
          name: storeName,
          chain: {
            name: storeName,
            type: localMatch?.store.chain?.type || itemCategory || 'grocery',
            logo_url:
              localMatch?.store.chain?.logo_url ||
              this.resolveLogoUrl(storeName),
          },
          address: (item as any).address || localMatch?.store.address || '',
          lat: (item as any).lat || Number(localMatch?.store.lat) || 0,
          lng: (item as any).lng || Number(localMatch?.store.lng) || 0,
          zip,
        };

        if (localMatch) {
          distance =
            localMatch.distance !== null && localMatch.distance > 0
              ? localMatch.distance
              : haversineDistanceMiles(
                  userLat,
                  userLng,
                  Number(localMatch.store.lat),
                  Number(localMatch.store.lng),
                );
          storeData = {
            ...localMatch.store,
            chain: {
              ...localMatch.store.chain,
              logo_url:
                localMatch.store.chain?.logo_url ||
                this.resolveLogoUrl(storeName),
            },
          };
        } else {
          if (override && (storeData.lat === 0 || storeData.lng === 0)) {
            storeData = {
              ...storeData,
              lat: override.lat,
              lng: override.lng,
              address: storeData.address || override.address || '',
            };
          }

          // If not in our DB, calculate distance from scraped coordinates
          if (storeData.lat !== 0 && storeData.lng !== 0) {
            distance = haversineDistanceMiles(
              userLat,
              userLng,
              storeData.lat,
              storeData.lng,
            );
          } else {
            // Try chain-name prefix match from nearby stores as a last-resort coordinate source
            const chainMatch = nearbyStores.find((ns) => {
              const chainName = (ns.store.chain?.name || '').toLowerCase();
              const firstWord = storeName.toLowerCase().split(' ')[0];
              return (
                storeName.toLowerCase().includes(chainName) ||
                chainName.includes(firstWord)
              );
            });
            if (chainMatch) {
              distance = haversineDistanceMiles(
                userLat,
                userLng,
                Number(chainMatch.store.lat),
                Number(chainMatch.store.lng),
              );
            } else if (override) {
              distance = haversineDistanceMiles(
                userLat,
                userLng,
                override.lat,
                override.lng,
              );
            } else {
              // Last resort: show just inside radius rather than silently hiding this store
              distance = preferredRadius - 0.1;
              this.logger.warn(
                `No coords found for "${storeName}" — showing with estimated distance (${(preferredRadius - 0.1).toFixed(1)} mi)`,
              );
            }
          }
        }

        driveCost = calculateDriveCost(
          distance,
          userMpg,
          gasPrice,
          isRoundTrip,
        );

        // Enrich with gas prices if available if we have a store ID
        if (storeData.id) {
          const stationGas = gasPrices.find(
            (gp) => gp.store_id === storeData.id,
          );
          if (stationGas) {
            (storeData as any).gasPrices = {
              regular: stationGas.regular_price,
              midgrade: stationGas.midgrade_price,
              premium: stationGas.premium_price,
              diesel: stationGas.diesel_price,
            };
          }
        }

        const trueCost = item.price + driveCost;
        const displayDistance = distance > 0 && distance < 0.1 ? 0.1 : distance;

        const resolvedImage = isGasSearch
          ? this.isValidImageUrl((item as any).image) ? (item as any).image.trim() : ''
          : await this.productImageService.resolveImage(
              productName,
              (item as any).image,
            );
        const finalImage =
          resolvedImage || this.resolveFallbackProductImage(itemCategory);

        return {
          store: storeData,
          item_total: Number(item.price.toFixed(2)),
          driving_distance: Number(
            (displayDistance * (isRoundTrip ? 2 : 1)).toFixed(2),
          ),
          driving_cost: Number(driveCost.toFixed(2)),
          true_cost: Number(trueCost.toFixed(2)),
          items_found: 1,
          missing_items: 0,
          products: [
            {
              name: productName,
              price: item.price,
              image: finalImage,
              category: itemCategory,
            },
          ],
          source: source === 'database' ? 'database' : (item as any).source,
          category: itemCategory,
          relevance_score: item.relevanceScore || 0,
        };
      }),
    );

    return this.filterComparisonItems(comparisons, query).filter(
      (item: any) => {
        // Filter out stores that are beyond the preferred radius
        // distance is distance from user to store (one-way)
        const dist = item.driving_distance / (isRoundTrip ? 2 : 1);
        return dist <= preferredRadius;
      },
    );
  }

  private filterComparisonItems(
    items: any[],
    query: string,
    storeType?: StoreChainType,
  ) {
    const normalizedQuery = query.toLowerCase().trim();
    const isGasSearch = ['gas', 'fuel', 'diesel'].includes(normalizedQuery);

    return items.filter((item) => {
      if (!isGasSearch && item.store?.chain?.type === StoreChainType.GAS) {
        return false;
      }

      if (storeType && storeType !== ('all' as any)) {
        return (
          item.store.chain?.type === storeType ||
          (item.category &&
            item.category.toLowerCase() === (storeType as string).toLowerCase())
        );
      }

      return true;
    });
  }

  /**
   * Evaluates the true cost of items including transit
   */
  async getBestTrueCost(
    userLat: number,
    userLng: number,
    items: { productId: string; quantity: number }[],
    userMpg: number,
    gasPrice: number,
    storeType?: StoreChainType,
    isRoundTrip: boolean = true,
    sortBy: string = 'true_cost',
    zipCode?: string,
    preferredRadius: number = 20,
  ) {
    this.logger.log(
      `DEBUG: Entering getBestTrueCost with lat: ${userLat}, lng: ${userLng}`,
    );

    const resolvedZip = zipCode || '75201'; // Fallback

    // 1. Get the products to know their names for generic search
    const productIds = items.map((i) => i.productId);
    const products = await this.productRepository.find({
      where: { id: In(productIds) },
    });

    if (products.length === 0) return [];

    // Map items to names and quantities
    const searchItems = items.map((item) => {
      const p = products.find((prod) => prod.id === item.productId);
      return {
        name: p?.normalized_name || p?.name || 'Unknown Item',
        quantity: item.quantity,
      };
    });

    this.logger.log(
      `DEBUG: Cart contains items: ${searchItems.map((i) => `${i.quantity}x ${i.name}`).join(', ')}`,
    );

    // 2. Run the compareItem logic for EACH item to find fresh prices
    const storeMap = new Map<string, any>();

    await Promise.all(
      searchItems.map(async (item) => {
        try {
          const compareResponse = await this.compareItem(
            item.name,
            userLat,
            userLng,
            userMpg,
            gasPrice,
            resolvedZip,
            storeType,
            isRoundTrip,
            'true_cost',
            false,
            preferredRadius,
          );

          // compareItem returns { status: 'ready'|'warming', results: [...] }
          const resultItems = compareResponse?.results;
          if (!Array.isArray(resultItems) || resultItems.length === 0) {
            this.logger.warn(
              `No results available for cart item "${item.name}" (status: ${compareResponse?.status})`,
            );
            return;
          }

          // Keep track of which stores we've already added THIS item for.
          // Since compareItem results are sorted by true_cost, the first match per store is the cheapest.
          const fulfilledStoreIds = new Set<string>();

          for (const result of resultItems) {
            const storeId = result.store.id;

            if (fulfilledStoreIds.has(storeId)) {
              continue; // We already added the cheapest version of this item for this store
            }

            if (!storeMap.has(storeId)) {
              // Initialize this store's cart
              storeMap.set(storeId, {
                store: result.store,
                item_total: 0,
                driving_distance: result.driving_distance,
                driving_cost: result.driving_cost,
                true_cost: 0,
                items_found: 0,
                missing_items: 0,
                products: [],
              });
            }

            // Add this product to the store's cart
            const storeCart = storeMap.get(storeId);
            if (result.products && result.products.length > 0) {
              const productMatch = result.products[0];
              storeCart.products.push({
                ...productMatch,
                quantity: item.quantity,
              });
              storeCart.item_total += productMatch.price * item.quantity;
              storeCart.items_found += 1;
              fulfilledStoreIds.add(storeId); // Mark as fulfilled for this store
            }
          }
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to get comparisons for cart item "${item.name}": ${message}`,
          );
        }
      }),
    );

    // 3. Finalize the calculations for each store
    const totalItemsRequested = searchItems.length;
    const comparisons = Array.from(storeMap.values()).map((cart) => {
      cart.item_total = Number(cart.item_total.toFixed(2));
      cart.true_cost = Number((cart.item_total + cart.driving_cost).toFixed(2));
      cart.missing_items = totalItemsRequested - cart.items_found;
      return cart;
    });

    // 4. Sort the final list
    return this.sortComparisons(comparisons, sortBy);
  }

  /**
   * Compare gas stations by True Cost for a full 15-gallon fill-up.
   *
   * Formula:
   *   fill_up_cost = price_per_gallon × 15
   *   drive_cost   = (distance ÷ mpg) × gas_price × 2 (round trip)
   *   true_cost    = fill_up_cost + drive_cost
   *
   * This answers: "Is the cheaper gas station worth the extra drive?"
   */
  async compareGasStations(
    userLat: number,
    userLng: number,
    userMpg: number,
    userGasPrice: number,
    gallons: number = 15,
    fuelType: 'regular' | 'midgrade' | 'premium' | 'diesel' = 'regular',
    isRoundTrip: boolean = true,
    sortBy: string = 'true_cost',
    preferredRadius: number = 20,
    locationName: string = 'Dallas, TX',
  ) {
    // 1. Find nearby gas stations within the search radius
    let nearbyStores = await this.storesService.findNearbyStores(
      userLat,
      userLng,
      preferredRadius,
    );
    nearbyStores = nearbyStores.filter(
      (ns) => ns.store.chain?.type === StoreChainType.GAS,
    );

    if (!nearbyStores.length) {
      this.logger.warn(
        `[SYNC TRIGGER] No gas stations found within 15 miles of ${userLat}, ${userLng}. Triggering live sync for region: ${locationName}...`,
      );
      await this.gasSyncService.syncGasPrices(locationName, userLat, userLng);

      // Re-query after sync
      nearbyStores = await this.storesService.findNearbyStores(
        userLat,
        userLng,
        preferredRadius,
      );
      nearbyStores = nearbyStores.filter(
        (ns) => ns.store.chain?.type === StoreChainType.GAS,
      );

      if (!nearbyStores.length) {
        this.logger.warn('Still no gas stations found after live sync.');
        return [];
      }
    }

    const storeIds = nearbyStores.map((ns) => ns.store.id);

    // 2. Get gas prices for these stations
    const gasPrices = await this.gasPriceRepository.find({
      where: { store_id: In(storeIds) },
    });

    const comparisons = await Promise.all(
      nearbyStores.map(async (ns) => {
        const gp = gasPrices.find((g) => g.store_id === ns.store.id);
        if (!gp) return null;

        // Calculate dynamic fallback for missing diesel if needed
        let dieselPrice = gp.diesel_price ? Number(gp.diesel_price) : null;
        if (gp.regular_price && !dieselPrice) {
          dieselPrice = await this.gasSyncService.calculateFallbackDieselPrice(
            Number(gp.regular_price),
            locationName,
          );
        }

        // Pick the right fuel type price
        const pricePerGallon = Number(
          fuelType === 'diesel'
            ? dieselPrice
            : fuelType === 'premium'
              ? gp.premium_price
              : fuelType === 'midgrade'
                ? gp.midgrade_price
                : gp.regular_price,
        );

        if (!pricePerGallon || pricePerGallon <= 0) return null;

        // 3. Calculate costs
        const fillUpCost = pricePerGallon * gallons;

        let distanceMiles = ns.distance;
        try {
          const routeInfo = await this.osrmService.getRouteInfo(
            userLng,
            userLat,
            ns.store.lng,
            ns.store.lat,
          );
          if (routeInfo)
            distanceMiles = metersToMiles(routeInfo.distanceMeters);
        } catch {
          // OSRM failure: fall back to haversine if coordinates exist
          if (ns.store.lat && ns.store.lng) {
            distanceMiles = haversineDistanceMiles(
              userLat,
              userLng,
              Number(ns.store.lat),
              Number(ns.store.lng),
            );
          }
        }

        // Final safety: if routing + haversine still failed, fall back to haversine using any coords we have
        if (!distanceMiles || distanceMiles <= 0) {
          if (ns.store.lat && ns.store.lng) {
            distanceMiles = haversineDistanceMiles(
              userLat,
              userLng,
              Number(ns.store.lat),
              Number(ns.store.lng),
            );
          }
        }

        const driveCost = calculateDriveCost(
          distanceMiles,
          userMpg,
          userGasPrice,
          isRoundTrip,
        );
        const trueCost = fillUpCost + driveCost;

        return {
          store: {
            ...ns.store,
            chain: {
              ...ns.store.chain,
              logo_url:
                ns.store.chain?.logo_url || this.resolveLogoUrl(ns.store.name),
            },
            gasPrices: {
              regular: gp.regular_price ? Number(gp.regular_price) : null,
              midgrade: gp.midgrade_price ? Number(gp.midgrade_price) : null,
              premium: gp.premium_price ? Number(gp.premium_price) : null,
              diesel: dieselPrice,
            },
          },
          price_per_gallon: pricePerGallon,
          gallons,
          fill_up_cost: Number(fillUpCost.toFixed(2)),
          item_total: Number(fillUpCost.toFixed(2)),
          driving_distance: Number(
            (distanceMiles * (isRoundTrip ? 2 : 1)).toFixed(1),
          ),
          driving_cost: Number(driveCost.toFixed(2)),
          true_cost: Number(trueCost.toFixed(2)),
          fuel_type: fuelType,
          items_found: 1,
          missing_items: 0,
          products: [
            {
              name: `${fuelType.charAt(0).toUpperCase() + fuelType.slice(1)} Gas`,
              price: pricePerGallon,
            },
          ],
        };
      }),
    );

    const filtered = (comparisons.filter(Boolean) as any[]).filter(
      (item: any) => {
        const dist = isRoundTrip
          ? item.driving_distance / 2
          : item.driving_distance;
        return dist <= preferredRadius;
      },
    );

    return this.sortComparisons(filtered, sortBy);
  }

  /**
   * Helper to sort comparisons based on requested criteria
   */
  private sortComparisons(comparisons: any[], sortBy: string) {
    const mostExpensive =
      comparisons.length > 0
        ? Math.max(...comparisons.map((c) => c.true_cost))
        : 0;

    const results = comparisons.map((c) => ({
      ...c,
      savings: Number((mostExpensive - c.true_cost).toFixed(2)),
    }));

    // First sort by missing items (fewer missing items is better), then by selected criteria
    return results.sort((a, b) => {
      const missingA = a.missing_items ?? 0;
      const missingB = b.missing_items ?? 0;

      if (missingA !== missingB) {
        return missingA - missingB; // Ascending: 0 missing items comes before 1 missing item
      }

      // Fallback to chosen criteria
      switch (sortBy) {
        case 'item_total':
          return a.item_total - b.item_total;
        case 'driving_cost':
          return a.driving_cost - b.driving_cost;
        case 'distance':
        case 'driving_distance':
          return a.driving_distance - b.driving_distance;
        case 'savings':
          return b.savings - a.savings; // Descending for savings (higher is better)
        case 'true_cost':
        default:
          return a.true_cost - b.true_cost; // Ascending for true cost (lower is better)
      }
    });
  }

  /**
   * Helper to resolve a logo URL based on store name
   */
  private resolveLogoUrl(name: string): string | null {
    const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const token = process.env.LOGO_DEV_TOKEN || 'pk_UUfT4NowQ-GmCHtVoknvfg';
    const baseUrl = `https://img.logo.dev`;

    const brands = [
      { key: 'walmart', domain: 'walmart.com' },
      { key: 'target', domain: 'target.com' },
      { key: 'aldi', domain: 'aldi.us' },
      { key: 'costco', domain: 'costco.com' },
      { key: 'kroger', domain: 'kroger.com' },
      { key: 'wholefoods', domain: 'wholefoodsmarket.com' },
      { key: 'publix', domain: 'publix.com' },
      { key: 'heb', domain: 'heb.com' },
      { key: 'cvs', domain: 'cvs.com' },
      { key: 'walgreens', domain: 'walgreens.com' },
      { key: 'shell', domain: 'shell.com' },
      { key: 'exxon', domain: 'exxon.com' },
      { key: 'chevron', domain: 'chevron.com' },
      { key: 'mobil', domain: 'mobil.com' },
      { key: 'valero', domain: 'valero.com' },
      { key: 'quiktrip', domain: 'quiktrip.com' },
      { key: 'racetrac', domain: 'racetrac.com' },
      { key: 'circlek', domain: 'circlek.com' },
      { key: 'murphy', domain: 'murphyusa.com' },
      { key: '76', domain: '76.com' },
      { key: 'bp', domain: 'bp.com' },
      { key: 'sunoco', domain: 'sunoco.com' },
      { key: 'texaco', domain: 'texaco.com' },
      { key: 'citgo', domain: 'citgo.com' },
      { key: '7eleven', domain: '7-eleven.com' },
      { key: 'riteaid', domain: 'riteaid.com' },
      { key: 'samsclub', domain: 'samsclub.com' },
      { key: 'meijer', domain: 'meijer.com' },
      { key: 'safeway', domain: 'safeway.com' },
    ];

    for (const brand of brands) {
      if (n.includes(brand.key)) {
        return `${baseUrl}/${brand.domain}?token=${token}`;
      }
    }

    return null;
  }

  private resolveFallbackProductImage(category?: string): string {
    const normalizedCategory = (category || '').toLowerCase();
    const fallbackImages: Record<string, string> = {
      grocery:
        'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
      pharmacy:
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400',
      gas: 'https://images.unsplash.com/photo-1614732414444-096e5f1122d5?auto=format&fit=crop&q=80&w=400',
      produce:
        'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&q=80&w=400',
      meat: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&q=80&w=400',
      dairy:
        'https://images.unsplash.com/photo-1550583724-125581f77833?auto=format&fit=crop&q=80&w=400',
      bakery:
        'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400',
      beverages:
        'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=400',
      snacks:
        'https://images.unsplash.com/photo-1599490659213-e2b9527bb087?auto=format&fit=crop&q=80&w=400',
      medicine:
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400',
      cleaning:
        'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=400',
      pet: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=400',
      baby: 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?auto=format&fit=crop&q=80&w=400',
      household:
        'https://images.unsplash.com/photo-1528740561666-dc2479bd08bc?auto=format&fit=crop&q=80&w=400',
      other:
        'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
    };

    return fallbackImages[normalizedCategory] || fallbackImages.other;
  }

  private isValidImageUrl(url?: string | null): boolean {
    let imageUrl = typeof url === 'string' ? url.trim() : '';
    if (!imageUrl) return false;

    if (imageUrl.startsWith('data:')) return true;
    if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;

    try {
      const parsed = new URL(imageUrl);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
