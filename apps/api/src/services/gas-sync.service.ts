import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GasBuddyScraperService } from '../providers/oxylabs/gasbuddy-scraper.service';
import { GoogleMapsGasScraperService } from '../providers/oxylabs/google-maps-gas-scraper.service';
import { EiaDieselService } from '../providers/eia/eia-diesel.service';
import { ProductNormalizerService } from '../providers/normalizer/product-normalizer.service';
import { GasPrice } from '../gas/gas-price.entity';
import { Store } from '../stores/store.entity';
import { DataSource } from '../common/enums/data-source.enum';
import { StoreChain, StoreChainType } from '../stores/store-chain.entity';
import { Product, ProductCategory } from '../products/product.entity';
import { StoreProduct } from '../products/store-product.entity';
import { NormalizedGasStation } from '../common/interfaces/normalized-gas-price.interface';
import { CACHE_TTL } from '../common/constants/cache-ttl.constants';
import { geocodePlace, reverseGeocode } from '../utils/geocoding.util';

/**
 * Gas price synchronization service.
 * Uses the GasProvider (provider layer) instead of directly calling external APIs.
 * Handles DB persistence, cache staleness, and fallback logic.
 */
@Injectable()
export class GasSyncService {
  private readonly logger = new Logger(GasSyncService.name);

  private readonly recentSyncs = new Map<string, number>();

  constructor(
    private readonly gasBuddyScraper: GasBuddyScraperService,
    private readonly googleMapsScraper: GoogleMapsGasScraperService,
    private readonly eiaDieselService: EiaDieselService,
    @InjectRepository(GasPrice) private readonly gasPriceRepo: Repository<GasPrice>,
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
    @InjectRepository(StoreChain) private readonly chainRepo: Repository<StoreChain>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(StoreProduct) private readonly storeProductRepo: Repository<StoreProduct>,
  ) {}

  /**
   * Sync gas prices from the provider into the database.
   * On failure, marks existing data as stale instead of crashing.
   */
  async syncGasPrices(regionCode: string = 'TX', lat?: number, lng?: number): Promise<{ success: boolean; count: number; stale: boolean }> {
    const now = Date.now();
    const cleanRegion = regionCode.trim().toLowerCase();
    const lastSyncTime = this.recentSyncs.get(cleanRegion);

    if (lastSyncTime && (now - lastSyncTime) < 30 * 60 * 1000) {
      this.logger.log(`[SYNC SKIP] Region "${regionCode}" was synced recently (${Math.round((now - lastSyncTime) / 1000)}s ago). Skipping to prevent duplicate scrapes.`);
      return { success: true, count: 0, stale: false };
    }

    this.recentSyncs.set(cleanRegion, now);
    this.logger.log(`[SYNC INIT] Starting Google Maps sync for region: ${regionCode} (Coordinates: ${lat || 'N/A'}, ${lng || 'N/A'})`);

    try {
      const mergedStations = new Map<string, NormalizedGasStation>();

      try {
        this.logger.log(`Fetching Regular gas prices via Google Maps...`);
        const regularStations = await this.googleMapsScraper.searchNearbyStores(regionCode, 'gas stations');
        for (const s of regularStations) {
          mergedStations.set(s.stationId, s);
        }
      } catch (err: any) {
        this.logger.error(`[Regular Gas Sync Fail] Scraper threw error: ${err.message}`);
      }

      try {
        this.logger.log(`Fetching Diesel gas prices via Google Maps...`);
        const dieselStations = await this.googleMapsScraper.searchNearbyStores(regionCode, 'diesel gas stations');
        for (const s of dieselStations) {
          if (mergedStations.has(s.stationId)) {
            const existing = mergedStations.get(s.stationId)!;
            if (s.prices.diesel !== null) existing.prices.diesel = s.prices.diesel;
            if (s.prices.regular !== null && existing.prices.regular === null) existing.prices.regular = s.prices.regular;
          } else {
            mergedStations.set(s.stationId, s);
          }
        }
      } catch (err: any) {
        this.logger.error(`[Diesel Gas Sync Fail] Scraper threw error: ${err.message}`);
      }

      const stations = Array.from(mergedStations.values());

      // Apply smart fallback calculation for missing diesel prices
      for (const station of stations) {
        if (station.prices.regular && !station.prices.diesel) {
          // We pass regionCode as the state (often it's a ZIP, but the calculation handles it safely)
          station.prices.diesel = await this.calculateFallbackDieselPrice(station.prices.regular, regionCode);
        }
      }

      if (stations.length === 0) {
        this.logger.warn('Google Maps scrapers returned 0 stations. Marking existing data as stale.');
        await this.markAllStale();
        return { success: false, count: 0, stale: true };
      }

      let synced = 0;
      for (const station of stations) {
        try {
          await this.processStation(station, regionCode, lat, lng);
          synced++;
          
          // Respect Nominatim's strict 1 request/sec limit
          // Await 1.2 seconds between geocoding requests to prevent 429 IP bans.
          await new Promise(resolve => setTimeout(resolve, 1200));
        } catch (err: any) {
          this.logger.error(`Failed to process station ${station.stationId}: ${err.message}`);
        }
      }

      this.logger.log(`Synced ${synced}/${stations.length} gas stations.`);
      return { success: true, count: synced, stale: false };

    } catch (error: any) {
      this.logger.error(`Gas sync failed entirely: ${error.message}`);
      await this.markAllStale();
      return { success: false, count: 0, stale: true };
    }
  }

  /**
   * Get nearby gas prices from the cached database.
   */
  async getNearbyGasPrices(lat: number, lng: number, radiusMiles: number = 20) {
    let results = await this.queryNearbyGas(lat, lng, radiusMiles);
    let region = 'TX';
    let geoResolved = false;

    // If no gas stations found, trigger a sync for the region and try again
    if (results.length === 0) {
      this.logger.warn(`[SYNC TRIGGER] No gas prices found within ${radiusMiles} miles of ${lat}, ${lng}. Triggering region sync...`);
      
      try {
        const geo = await reverseGeocode(lat, lng);
        if (geo) {
          region = geo.displayName;
          geoResolved = true;
          this.logger.log(`[GEO DETECT] Resolved coordinates ${lat}, ${lng} to region: ${region}`);
        }
      } catch (e) {
        this.logger.warn(`Failed to reverse geocode for sync: ${e.message}`);
      }

      await this.syncGasPrices(region, lat, lng);
      results = await this.queryNearbyGas(lat, lng, radiusMiles);
    }

    // Apply fallback for missing diesel prices dynamically before returning
    const needsFallback = results.some(r => r.regular_price && !r.diesel_price);
    if (needsFallback) {
      if (!geoResolved) {
        try {
          const geo = await reverseGeocode(lat, lng);
          if (geo) {
            region = geo.displayName;
            geoResolved = true;
          }
        } catch (e) { }
      }
      
      // Fetch EIA price once for the region
      const eiaPrice = await this.eiaDieselService.getRegionalDieselPrice(region);
      const stateUpper = region.toUpperCase().trim();
      const highTaxStates = ['CA', 'OR', 'WA', 'PA', 'IL', 'NY'];
      let spread = 0.58;
      if (highTaxStates.some(state => stateUpper.includes(state))) {
        spread = 0.75;
      }
      
      for (const r of results) {
        if (r.regular_price && !r.diesel_price) {
          if (eiaPrice) {
            r.diesel_price = eiaPrice;
          } else {
            r.diesel_price = Number((r.regular_price + spread).toFixed(2));
          }
        }
      }
    }

    return results;
  }

  private async queryNearbyGas(lat: number, lng: number, radiusMiles: number) {
    const query = this.storeRepo.createQueryBuilder('store')
      .leftJoinAndSelect('store.chain', 'chain')
      .innerJoinAndMapOne('store.gasPrice', GasPrice, 'gp', 'gp.store_id = store.id')
      .addSelect(`(3959 * acos(cos(radians(:lat)) * cos(radians(store.lat)) * cos(radians(store.lng) - radians(:lng)) + sin(radians(:lat)) * sin(radians(store.lat))))`, 'distance')
      .where('store.is_active = :isActive', { isActive: true })
      .andWhere('chain.type = :type', { type: StoreChainType.GAS })
      .having('distance <= :radiusMiles')
      .orderBy('distance', 'ASC')
      .setParameters({ lat, lng, radiusMiles });

    const results = await query.getRawAndEntities();

    return results.raw.map((raw: any) => ({
      stationId: raw.store_id,
      name: raw.store_name,
      chain: raw.chain_name,
      address: raw.store_address,
      lat: Number(raw.store_lat),
      lng: Number(raw.store_lng),
      distance: Number(parseFloat(raw.distance).toFixed(2)),
      regular_price: raw.gp_regular_price ? Number(raw.gp_regular_price) : null,
      midgrade_price: raw.gp_midgrade_price ? Number(raw.gp_midgrade_price) : null,
      premium_price: raw.gp_premium_price ? Number(raw.gp_premium_price) : null,
      diesel_price: raw.gp_diesel_price ? Number(raw.gp_diesel_price) : null,
      is_stale: raw.gp_is_stale === 1,
      last_updated: raw.gp_last_updated,
      logo_url: raw.chain_logo_url,
    }));
  }

  /**
   * Fetches official EIA diesel price, falling back to a dynamically weighted calculation 
   * when Google Maps scraping fails to return a native diesel value.
   */
  private async calculateFallbackDieselPrice(regularPrice: number | null, stateCode: string = ''): Promise<number | null> {
    if (!regularPrice) return null;
    
    // First, try EIA API for highly accurate regional pricing
    const eiaPrice = await this.eiaDieselService.getRegionalDieselPrice(stateCode);
    if (eiaPrice) {
      return eiaPrice; // Return the exact official diesel price for the region
    }

    this.logger.warn(`EIA API failed to return diesel price for ${stateCode}, falling back to static calculation.`);
    
    // Extract state code if a full region string was passed
    const stateUpper = stateCode.toUpperCase().trim();
    
    const highTaxStates = ['CA', 'OR', 'WA', 'PA', 'IL', 'NY'];
    let spread = 0.58; // Standard mid-market spread
    
    // Check if the state is in the high tax list
    if (highTaxStates.some(state => stateUpper.includes(state))) {
      spread = 0.75; // Diesel is historically taxed heavier on the West Coast/Northeast
    }
    
    return Number((regularPrice + spread).toFixed(2));
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

  private async findBrandLogo(name: string): Promise<{ logo?: string; brandName?: string }> {
    const token = process.env.LOGO_DEV_TOKEN || 'pk_UUfT4NowQ-GmCHtVoknvfg';
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const brands = [
      { key: 'shell', logo: 'shell.com' },
      { key: 'exxon', logo: 'exxon.com' },
      { key: 'chevron', logo: 'chevron.com' },
      { key: 'mobil', logo: 'mobil.com' },
      { key: 'valero', logo: 'valero.com' },
      { key: 'quiktrip', logo: 'quiktrip.com' },
      { key: 'racetrac', logo: 'racetrac.com' },
      { key: 'circlek', logo: 'circlek.com' },
      { key: 'murphy', logo: 'murphyusa.com' },
      { key: '76', logo: '76.com' },
      { key: 'bp', logo: 'bp.com' },
      { key: 'sunoco', logo: 'sunoco.com' },
      { key: 'texaco', logo: 'texaco.com' },
      { key: 'citgo', logo: 'citgo.com' },
      { key: 'pilot', logo: 'pilotflyingj.com' },
      { key: 'flyingj', logo: 'pilotflyingj.com' },
      { key: 'loves', logo: 'loves.com' },
      { key: 'marathon', logo: 'marathonbrand.com' },
      { key: 'costco', logo: 'costco.com' },
      { key: 'samsclub', logo: 'samsclub.com' },
      { key: 'walmart', logo: 'walmart.com' },
    ];

    for (const brand of brands) {
      if (normalized.includes(brand.key)) {
        return { 
          logo: `https://img.logo.dev/${brand.logo}?token=${token}`,
          brandName: brand.key.charAt(0).toUpperCase() + brand.key.slice(1)
        };
      }
    }
    return {};
  }

  private async processStation(station: NormalizedGasStation, regionCode: string = '', lat?: number, lng?: number): Promise<void> {
    const cleanedName = this.cleanName(station.name);
    const brandInfo = await this.findBrandLogo(cleanedName);
    const finalChainName = brandInfo.brandName || cleanedName;

    // 1. Find or create chain
    let chain = await this.chainRepo.findOne({ where: { name: finalChainName } });
    if (!chain) {
      const slug = finalChainName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 190);
      const newChain = this.chainRepo.create({
        name: finalChainName,
        slug,
        type: StoreChainType.GAS,
        logo_url: brandInfo.logo || station.logoUrl || `https://img.logo.dev/gasbuddy.com?token=${process.env.LOGO_DEV_TOKEN || 'pk_UUfT4NowQ-GmCHtVoknvfg'}`,
      });
      chain = await this.chainRepo.save(newChain);
    } else if (brandInfo.logo && (!chain.logo_url || chain.logo_url.includes('gasbuddy.com'))) {
      // Upgrade fallback to brand logo if found
      await this.chainRepo.update(chain.id, { logo_url: brandInfo.logo });
      chain.logo_url = brandInfo.logo;
    }

    if (!chain) {
      this.logger.error(`Could not find or create chain for station ${station.stationId}`);
      return;
    }

    // 2. Find or create store
    let store = await this.storeRepo.findOne({ where: { external_id: station.stationId } });
    
    let finalLat = station.latitude;
    let finalLng = station.longitude;
    let finalAddress = station.address;

    // If scraper fallback gave 0,0, try to geocode it based on the region
    if (finalLat === 0 && finalLng === 0) {
      // Nominatim works MUCH better with pure zip-coded addresses directly (e.g. "320 Middle Country Rd, Smithtown, NY 11787")
      // Only append regionCode if the scraper address is missing or unknown.
      const query = (station.address && station.address !== 'Unknown' && station.address.trim().length > 5)
        ? station.address
        : `${station.name} ${regionCode}`;
        
      const { geocodePlace } = require('../utils/geocoding.util');
      const geo = await geocodePlace(query);
      
      if (geo) {
        finalLat = geo.lat;
        finalLng = geo.lng;
        finalAddress = geo.displayName;
        this.logger.log(`[GEO SUCCESS] ${station.name} -> ${finalLat}, ${finalLng}`);
      } else {
        this.logger.warn(`[GEO FAIL] Could not find coordinates for: ${query}`);
      }
    }

    if (!store) {
      store = await this.storeRepo.save(this.storeRepo.create({
        chain_id: chain.id,
        name: cleanedName,
        address: finalAddress,
        lat: finalLat,
        lng: finalLng,
        external_id: station.stationId,
        source: DataSource.GASBUDDY,
        is_active: true,
      }));
    } else {
      // Update coordinates and address for existing stores to ensure they stay accurate
      // IMPORTANT: Don't let 0,0 overwrite good coordinates!
      const updateData: any = {};
      if (finalLat !== 0 && finalLng !== 0) {
        updateData.lat = finalLat;
        updateData.lng = finalLng;
      }
      if (finalAddress && finalAddress !== 'Unknown') {
        updateData.address = finalAddress;
      }
      
      if (Object.keys(updateData).length > 0) {
        await this.storeRepo.update(store.id, updateData);
      }
    }

    // 3. Upsert gas price
    let gasPrice = await this.gasPriceRepo.findOne({ where: { store_id: store.id } });
    const priceData: any = {
      store_id: store.id,
      source: DataSource.GASBUDDY,
      last_updated: new Date(),
      is_stale: false,
    };
    if (station.prices.regular !== null) priceData.regular_price = station.prices.regular;
    if (station.prices.midgrade !== null) priceData.midgrade_price = station.prices.midgrade;
    if (station.prices.premium !== null) priceData.premium_price = station.prices.premium;
    if (station.prices.diesel !== null) priceData.diesel_price = station.prices.diesel;

    // Handle parsing/scraping failure or lack of prices
    if (station.prices.regular === null && station.prices.diesel === null) {
      priceData.is_stale = true;
      if (gasPrice) {
        // Keep existing prices in DB but marked as stale
        priceData.regular_price = gasPrice.regular_price;
        priceData.midgrade_price = gasPrice.midgrade_price;
        priceData.premium_price = gasPrice.premium_price;
        priceData.diesel_price = gasPrice.diesel_price;
      } else {
        // Seed fallback regional average prices to ensure valid display
        priceData.regular_price = 3.29;
        priceData.diesel_price = 3.89;
      }
    }

    if (gasPrice) {
      await this.gasPriceRepo.update(gasPrice.id, priceData);
    } else {
      await this.gasPriceRepo.save(this.gasPriceRepo.create(priceData));
    }

    // 4. Update StoreProduct for gas category
    const finalRegularPrice = priceData.regular_price;
    if (finalRegularPrice) {
      const gasProduct = await this.productRepo.findOne({ where: { category: ProductCategory.GAS } });
      if (gasProduct) {
        let sp = await this.storeProductRepo.findOne({ where: { store_id: store.id, product_id: gasProduct.id } });
        const source = DataSource.GASBUDDY;
        const spData = { 
          store_id: store.id, 
          product_id: gasProduct.id, 
          price: finalRegularPrice, 
          source, 
          last_verified_at: new Date(), 
          is_stale: priceData.is_stale 
        };
        if (sp) {
          await this.storeProductRepo.update(sp.id, spData as any);
        } else {
          await this.storeProductRepo.save(this.storeProductRepo.create(spData as any));
        }
      }
    }
  }

  private async markAllStale(): Promise<void> {
    await this.gasPriceRepo.createQueryBuilder().update().set({ is_stale: true }).where('source = :src', { src: DataSource.GASBUDDY }).execute();
  }
}
