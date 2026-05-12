import { Injectable, Logger } from '@nestjs/common';
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
import { ScrapedProduct } from '../providers/oxylabs/oxylabs-base.service';
import { calculateDriveCost, calculateTrueCost, metersToMiles, haversineDistanceMiles } from '../utils/geo.util';
import { geocodePlaceNear } from '../utils/geocoding.util';
import { GasSyncService } from '../services/gas-sync.service';

@Injectable()
export class ComparisonService {
  private readonly logger = new Logger(ComparisonService.name);

  constructor(
    private readonly osrmService: OsrmService,
    private readonly storesService: StoresService,
    private readonly aggregatorService: AggregatorService,
    private readonly productsService: ProductsService,
    private readonly gasSyncService: GasSyncService,
    @InjectRepository(StoreProduct)
    private storeProductsRepository: Repository<StoreProduct>,
    @InjectRepository(GasPrice)
    private gasPriceRepository: Repository<GasPrice>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Store)
    private storesRepository: Repository<Store>,
  ) {}

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
  ) {
    const resolvedZip = zipCode || '75201';

    // ── Step 1: Check DB for fresh data (< 24 hours old) ────────────
    this.logger.log(`Checking DB for fresh data: "${itemName}" in ZIP ${resolvedZip}`);
    const dbResults = await this.productsService.searchFromDb(itemName, resolvedZip);

    if (dbResults && dbResults.length > 0 && !forceRefresh) {
      this.logger.log(`DB cache hit: ${dbResults.length} fresh results for "${itemName}". Skipping scrape.`);
      let items = await this.formatScrapedForUI(dbResults, resolvedZip, 'database', userLat, userLng, userMpg, gasPrice, isRoundTrip);

      // Apply store type filter if provided
      if (storeType && storeType !== 'all' as any) {
        items = items.filter(item => 
          item.store.chain?.type === storeType || 
          (item.category && item.category.toLowerCase() === (storeType as string).toLowerCase())
        );
      }

      return this.sortComparisons(items, sortBy);
    }

    // ── Step 2: No fresh DB data — scrape live ──────────────────────
    this.logger.log(`No fresh DB data for "${itemName}". Running live scrape for ZIP ${resolvedZip}...`);

    try {
      const scraperResult = await this.aggregatorService.search(itemName, resolvedZip, undefined, { bypassCache: forceRefresh });

      if (scraperResult.data.length === 0) {
        this.logger.warn(`All scrapers returned 0 results for "${itemName}".`);
        return [];
      }

      this.logger.log(`Live scrape returned ${scraperResult.data.length} results for "${itemName}".`);

      // ── Step 3: Background-save to DB (don't await — keep response fast) ──
      this.productsService.upsertScrapedProducts(scraperResult.data, resolvedZip)
        .then(() => this.logger.log(`Background DB save completed for "${itemName}"`))
        .catch(err => this.logger.error(`Background DB save failed for "${itemName}": ${err.message}`));

      let items = await this.formatScrapedForUI(scraperResult.data, resolvedZip, 'live', userLat, userLng, userMpg, gasPrice, isRoundTrip);

      // Apply store type filter if provided
      if (storeType && storeType !== 'all' as any) {
        items = items.filter(item => 
          item.store.chain?.type === storeType || 
          (item.category && item.category.toLowerCase() === (storeType as string).toLowerCase())
        );
      }

      return this.sortComparisons(items, sortBy);
    } catch (error: any) {
      this.logger.error(`Live scrape failed entirely for "${itemName}": ${error.message}`);

      // Last resort: check if we have ANY DB data (even stale) rather than returning nothing
      const staleProducts = await this.productRepository.createQueryBuilder('p')
        .where('p.name LIKE :name OR p.normalized_name LIKE :name', { name: `%${itemName}%` })
        .getMany();

      if (staleProducts.length > 0) {
        this.logger.log(`Falling back to stale DB data: ${staleProducts.length} products for "${itemName}".`);
        return this.getBestTrueCost(
          userLat, userLng,
          staleProducts.map(p => ({ productId: p.id, quantity: 1 })),
          userMpg, gasPrice, storeType, isRoundTrip, sortBy
        );
      }

      return [];
    }
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
  ) {
    // Get nearby stores once to avoid multiple DB calls
    const nearbyStores = await this.storesService.findNearbyStores(userLat, userLng, 15);
    
    // Get all gas prices for these stores if they are gas stations
    const storeIds = nearbyStores.map(ns => ns.store.id);
    const gasPrices = await this.gasPriceRepository.find({
      where: { store_id: In(storeIds) }
    });

    // If DB-cached items don't include coordinates and we don't have a local DB store match,
    // enrich store coordinates via bounded geocoding near the user's current location.
    // This prevents "0,0" coords and removes the jitter fallback for real users.
    const missingCoordStoreNames = [
      ...new Set(
        products
          .filter(p => (!p.lat || !p.lng))
          .map(p => (p.store || '').trim())
          .filter(Boolean),
      ),
    ];

    const storeCoordOverrides = new Map<string, { lat: number; lng: number; address?: string }>();
    const MAX_GEOCODE = 10; // keep requests bounded and responsive
    await Promise.allSettled(
      missingCoordStoreNames.slice(0, MAX_GEOCODE).map(async (storeName) => {
        // If we already have a nearby DB store match by name, no need to geocode
        const localMatch = nearbyStores.find(ns =>
          ns.store.name.toLowerCase().includes(storeName.toLowerCase()) ||
          storeName.toLowerCase().includes(ns.store.name.toLowerCase())
        );
        if (localMatch) return;

        const geo = await geocodePlaceNear(storeName, userLat, userLng, 0.35);
        if (geo) {
          storeCoordOverrides.set(storeName.toLowerCase(), { lat: geo.lat, lng: geo.lng, address: geo.displayName });
          
          // PERSISTENCE: If we have a store in the DB with 0,0 coords, update it now
          // so we don't have to geocode it again next time.
          try {
            const storeToUpdate = await this.storesRepository.findOne({
              where: { name: storeName, lat: 0, lng: 0 }
            });
            if (storeToUpdate) {
              this.logger.log(`Fixing 0,0 coordinates for store "${storeName}" -> ${geo.lat}, ${geo.lng}`);
              storeToUpdate.lat = geo.lat;
              storeToUpdate.lng = geo.lng;
              if (!storeToUpdate.address) storeToUpdate.address = geo.displayName;
              await this.storesRepository.save(storeToUpdate);
            }
          } catch (e) {
            this.logger.warn(`Failed to persist geocoded coordinates for ${storeName}: ${e.message}`);
          }
        }
      }),
    );

    return products.map((item: any) => {
      const storeName = typeof item.store === 'string' ? item.store : (item.store?.name || '');
      const productName = typeof item.product === 'string' ? item.product : (item.product?.name || '');
      const itemCategory = (item as any).category || this.aggregatorService.determineCategory('', productName, storeName);

      // Find the nearest local store that matches this retailer's name
      const localMatch = nearbyStores.find(ns => 
        ns.store.name.toLowerCase().includes(storeName.toLowerCase()) ||
        storeName.toLowerCase().includes(ns.store.name.toLowerCase())
      );

      let distance = 0;
      let driveCost = 0;
      let storeData: any = {
        name: storeName,
        chain: { 
          name: storeName, 
          type: localMatch?.store.chain?.type || itemCategory || 'grocery',
          logo_url: localMatch?.store.chain?.logo_url || this.resolveLogoUrl(storeName)
        },
        address: (item as any).address || localMatch?.store.address || '',
        lat: (item as any).lat || Number(localMatch?.store.lat) || 0,
        lng: (item as any).lng || Number(localMatch?.store.lng) || 0,
        zip,
      };

      if (localMatch) {
        distance = localMatch.distance;
        storeData = {
          ...localMatch.store,
          chain: {
            ...localMatch.store.chain,
            logo_url: localMatch.store.chain?.logo_url || this.resolveLogoUrl(storeName)
          }
        };
      } else {
        const override = storeCoordOverrides.get(item.store.toLowerCase());
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
          distance = haversineDistanceMiles(userLat, userLng, storeData.lat, storeData.lng);
        } else {
          // Final fallback for development/unknown locations
          // Adding a bit of jitter (0.8 to 2.5 miles) so stores don't all look identical
          const jitter = (item.store.length % 10) / 5; // Deterministic jitter based on store name length
          distance = 1.2 + jitter;
        }
      }

      driveCost = calculateDriveCost(distance, userMpg, gasPrice, isRoundTrip);

      // Enrich with gas prices if available if we have a store ID
      if (storeData.id) {
        const stationGas = gasPrices.find(gp => gp.store_id === storeData.id);
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
      const displayDistance =
        distance > 0 && distance < 0.1
          ? 0.1
          : distance;

      return {
        store: storeData,
        item_total: Number(item.price.toFixed(2)),
        driving_distance: Number((displayDistance * (isRoundTrip ? 2 : 1)).toFixed(2)),
        driving_cost: Number(driveCost.toFixed(2)),
        true_cost: Number(trueCost.toFixed(2)),
        items_found: 1,
        missing_items: 0,
        products: [{ name: productName, price: item.price, image: (item as any).image, category: itemCategory }],
        source: source === 'database' ? 'database' : (item as any).source,
        category: itemCategory,
      };
    });
  }

  /**
   * Evaluates the true cost of items including transit
   */
  async getBestTrueCost(
    userLat: number, 
    userLng: number, 
    items: { productId: string, quantity: number }[], 
    userMpg: number, 
    gasPrice: number,
    storeType?: StoreChainType,
    isRoundTrip: boolean = true,
    sortBy: string = 'true_cost',
    zipCode?: string
  ) {
    this.logger.log(`DEBUG: Entering getBestTrueCost with lat: ${userLat}, lng: ${userLng}`);
    
    const resolvedZip = zipCode || '75201'; // Fallback
    
    // 1. Get the products to know their names for generic search
    const productIds = items.map(i => i.productId);
    const products = await this.productRepository.find({
      where: { id: In(productIds) }
    });

    if (products.length === 0) return [];

    // Map items to names and quantities
    const searchItems = items.map(item => {
      const p = products.find(prod => prod.id === item.productId);
      return {
        name: p?.normalized_name || p?.name || 'Unknown Item',
        quantity: item.quantity
      };
    });

    this.logger.log(`DEBUG: Cart contains items: ${searchItems.map(i => `${i.quantity}x ${i.name}`).join(', ')}`);

    // 2. Run the compareItem logic for EACH item to find fresh prices
    const storeMap = new Map<string, any>();

    await Promise.all(searchItems.map(async (item) => {
      try {
        const results = await this.compareItem(
          item.name, userLat, userLng, userMpg, gasPrice, resolvedZip, storeType, isRoundTrip, 'true_cost', false
        );

        // Keep track of which stores we've already added THIS item for.
        // Since compareItem results are sorted by true_cost, the first match per store is the cheapest.
        const fulfilledStoreIds = new Set<string>();

        for (const result of results) {
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
              products: []
            });
          }

          // Add this product to the store's cart
          const storeCart = storeMap.get(storeId);
          if (result.products && result.products.length > 0) {
            const productMatch = result.products[0];
            storeCart.products.push({ ...productMatch, quantity: item.quantity });
            storeCart.item_total += (productMatch.price * item.quantity);
            storeCart.items_found += 1;
            fulfilledStoreIds.add(storeId); // Mark as fulfilled for this store
          }
        }
      } catch (error) {
        this.logger.error(`Failed to get comparisons for cart item "${item.name}": ${error.message}`);
      }
    }));

    // 3. Finalize the calculations for each store
    const totalItemsRequested = searchItems.length;
    let comparisons = Array.from(storeMap.values()).map(cart => {
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
    locationName: string = 'TX',
  ) {
    // 1. Find nearby gas stations within 15 miles
    let nearbyStores = await this.storesService.findNearbyStores(userLat, userLng, 15);
    nearbyStores = nearbyStores.filter(ns => ns.store.chain?.type === StoreChainType.GAS);

    if (!nearbyStores.length) {
      this.logger.warn(`[SYNC TRIGGER] No gas stations found within 15 miles of ${userLat}, ${userLng}. Triggering live sync for region: ${locationName}...`);
      await this.gasSyncService.syncGasPrices(locationName, userLat, userLng);
      
      // Re-query after sync
      nearbyStores = await this.storesService.findNearbyStores(userLat, userLng, 15);
      nearbyStores = nearbyStores.filter(ns => ns.store.chain?.type === StoreChainType.GAS);
      
      if (!nearbyStores.length) {
        this.logger.warn('Still no gas stations found after live sync.');
        return [];
      }
    }

    const storeIds = nearbyStores.map(ns => ns.store.id);

    // 2. Get gas prices for these stations
    const gasPrices = await this.gasPriceRepository.find({
      where: { store_id: In(storeIds) },
    });


    const comparisons = await Promise.all(nearbyStores.map(async (ns) => {
      const gp = gasPrices.find(g => g.store_id === ns.store.id);
      if (!gp) return null;

      // Pick the right fuel type price
      const pricePerGallon = Number(
        fuelType === 'diesel' ? gp.diesel_price :
        fuelType === 'premium' ? gp.premium_price :
        fuelType === 'midgrade' ? gp.midgrade_price :
        gp.regular_price
      );

      if (!pricePerGallon || pricePerGallon <= 0) return null;

      // 3. Calculate costs
      const fillUpCost = pricePerGallon * gallons;

      let distanceMiles = ns.distance;
      try {
        const routeInfo = await this.osrmService.getRouteInfo(
          userLng, userLat, ns.store.lng, ns.store.lat,
        );
        if (routeInfo) distanceMiles = metersToMiles(routeInfo.distanceMeters);
      } catch {
        // OSRM failure: fall back to haversine if coordinates exist
        if (ns.store.lat && ns.store.lng) {
          distanceMiles = haversineDistanceMiles(userLat, userLng, Number(ns.store.lat), Number(ns.store.lng));
        }
      }

      // Final safety: if routing + haversine still failed, fall back to haversine using any coords we have
      if (!distanceMiles || distanceMiles <= 0) {
        if (ns.store.lat && ns.store.lng) {
          distanceMiles = haversineDistanceMiles(userLat, userLng, Number(ns.store.lat), Number(ns.store.lng));
        }
      }

      const driveCost = calculateDriveCost(distanceMiles, userMpg, userGasPrice, isRoundTrip);
      const trueCost = fillUpCost + driveCost;

      return {
        store: {
          ...ns.store,
          chain: {
            ...ns.store.chain,
            logo_url: ns.store.chain?.logo_url || this.resolveLogoUrl(ns.store.name)
          },
          gasPrices: {
            regular: gp.regular_price ? Number(gp.regular_price) : null,
            midgrade: gp.midgrade_price ? Number(gp.midgrade_price) : null,
            premium: gp.premium_price ? Number(gp.premium_price) : null,
            diesel: gp.diesel_price ? Number(gp.diesel_price) : null,
          },
        },
        price_per_gallon: pricePerGallon,
        gallons,
        fill_up_cost: Number(fillUpCost.toFixed(2)),
        item_total: Number(fillUpCost.toFixed(2)),
        driving_distance: Number((distanceMiles * (isRoundTrip ? 2 : 1)).toFixed(1)),
        driving_cost: Number(driveCost.toFixed(2)),
        true_cost: Number(trueCost.toFixed(2)),
        fuel_type: fuelType,
        items_found: 1,
        missing_items: 0,
        products: [{ name: `${fuelType.charAt(0).toUpperCase() + fuelType.slice(1)} Gas`, price: pricePerGallon }],
      };
    }));

    return this.sortComparisons(comparisons.filter(Boolean) as any[], sortBy);
  }

  /**
   * Helper to sort comparisons based on requested criteria
   */
  private sortComparisons(comparisons: any[], sortBy: string) {
    const mostExpensive = comparisons.length > 0 
      ? Math.max(...comparisons.map(c => c.true_cost)) 
      : 0;

    const results = comparisons.map(c => ({
      ...c,
      savings: Number((mostExpensive - c.true_cost).toFixed(2))
    }));

    switch (sortBy) {
      case 'item_total':
        return results.sort((a, b) => a.item_total - b.item_total);
      case 'driving_cost':
        return results.sort((a, b) => a.driving_cost - b.driving_cost);
      case 'distance':
      case 'driving_distance':
        return results.sort((a, b) => a.driving_distance - b.driving_distance);
      case 'savings':
        return results.sort((a, b) => b.savings - a.savings);
      case 'true_cost':
      default:
        return results.sort((a, b) => a.true_cost - b.true_cost);
    }
  }

  /**
   * Helper to resolve a logo URL based on store name
   */
  private resolveLogoUrl(name: string): string | null {
    const n = name.toLowerCase();
    if (n.includes('walmart')) return 'https://logo.clearbit.com/walmart.com';
    if (n.includes('target')) return 'https://logo.clearbit.com/target.com';
    if (n.includes('aldi')) return 'https://logo.clearbit.com/aldi.us';
    if (n.includes('costco')) return 'https://logo.clearbit.com/costco.com';
    if (n.includes('kroger')) return 'https://logo.clearbit.com/kroger.com';
    if (n.includes('whole foods')) return 'https://logo.clearbit.com/wholefoodsmarket.com';
    if (n.includes('publix')) return 'https://logo.clearbit.com/publix.com';
    if (n.includes('heb') || n.includes('h-e-b')) return 'https://logo.clearbit.com/heb.com';
    if (n.includes('cvs')) return 'https://logo.clearbit.com/cvs.com';
    if (n.includes('walgreens')) return 'https://logo.clearbit.com/walgreens.com';
    if (n.includes('shell')) return 'https://logo.clearbit.com/shell.com';
    if (n.includes('exxon')) return 'https://logo.clearbit.com/exxon.com';
    if (n.includes('chevron')) return 'https://logo.clearbit.com/chevron.com';
    if (n.includes('mobil')) return 'https://logo.clearbit.com/exxonmobil.com';
    if (n.includes('7-eleven')) return 'https://logo.clearbit.com/7-eleven.com';
    
    return null;
  }
}
