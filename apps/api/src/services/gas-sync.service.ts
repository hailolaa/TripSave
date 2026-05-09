import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleMapsGasScraperService } from '../providers/oxylabs/google-maps-gas-scraper.service';
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

  constructor(
    private readonly googleMapsScraper: GoogleMapsGasScraperService,
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
    this.logger.log(`[SYNC INIT] Starting gas station sync for region: ${regionCode} (Coordinates: ${lat || 'N/A'}, ${lng || 'N/A'})`);

    try {
      const stations = await this.googleMapsScraper.searchNearbyStores(regionCode, 'gas stations');

      if (stations.length === 0) {
        this.logger.warn('Google Maps returned no stations. Marking existing data as stale.');
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
  async getNearbyGasPrices(lat: number, lng: number, radiusMiles: number = 15) {
    let results = await this.queryNearbyGas(lat, lng, radiusMiles);

    // If no gas stations found, trigger a sync for the region and try again
    if (results.length === 0) {
      this.logger.warn(`[SYNC TRIGGER] No gas prices found within ${radiusMiles} miles of ${lat}, ${lng}. Triggering region sync...`);
      
      let region = 'TX';
      try {
        const geo = await reverseGeocode(lat, lng);
        if (geo) {
          region = geo.displayName;
          this.logger.log(`[GEO DETECT] Resolved coordinates ${lat}, ${lng} to region: ${region}`);
        }
      } catch (e) {
        this.logger.warn(`Failed to reverse geocode for sync: ${e.message}`);
      }

      await this.syncGasPrices(region, lat, lng);
      results = await this.queryNearbyGas(lat, lng, radiusMiles);
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

  private async processStation(station: NormalizedGasStation, regionCode: string = '', lat?: number, lng?: number): Promise<void> {
    // 1. Find or create chain
    let chain = await this.chainRepo.findOne({ where: { name: station.name } });
    if (!chain) {
      const newChain = this.chainRepo.create({
        name: station.name,
        slug: station.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        type: StoreChainType.GAS,
        logo_url: station.logoUrl,
      });
      chain = await this.chainRepo.save(newChain);
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
      const query = station.address !== 'Unknown' ? `${station.name} ${station.address}` : `${station.name} ${regionCode}`;
      let geo = null;
      if (lat && lng) {
        const { geocodePlaceNear } = require('../utils/geocoding.util');
        geo = await geocodePlaceNear(query, lat, lng, 0.4);
      } else {
        geo = await geocodePlace(query);
      }
      
      if (geo) {
        finalLat = geo.lat;
        finalLng = geo.lng;
        finalAddress = geo.displayName;
        this.logger.log(`Geocoded missing coordinates for ${station.name}: ${finalLat}, ${finalLng}`);
      }
    }

    if (!store) {
      store = await this.storeRepo.save(this.storeRepo.create({
        chain_id: chain.id,
        name: `${station.name} - ${finalAddress}`,
        address: finalAddress,
        lat: finalLat,
        lng: finalLng,
        external_id: station.stationId,
        source: DataSource.GOOGLE_MAPS,
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
    const priceData = {
      store_id: store.id,
      regular_price: station.prices.regular,
      midgrade_price: station.prices.midgrade,
      premium_price: station.prices.premium,
      diesel_price: station.prices.diesel,
      source: DataSource.GOOGLE_MAPS,
      last_updated: new Date(),
      is_stale: false,
    };

    if (gasPrice) {
      await this.gasPriceRepo.update(gasPrice.id, priceData as any);
    } else {
      await this.gasPriceRepo.save(this.gasPriceRepo.create(priceData as any));
    }

    // 4. Update StoreProduct for gas category
    if (station.prices.regular) {
      const gasProduct = await this.productRepo.findOne({ where: { category: ProductCategory.GAS } });
      if (gasProduct) {
        let sp = await this.storeProductRepo.findOne({ where: { store_id: store.id, product_id: gasProduct.id } });
        const source = DataSource.GOOGLE_MAPS;
        const spData = { store_id: store.id, product_id: gasProduct.id, price: station.prices.regular, source, last_verified_at: new Date(), is_stale: false };
        if (sp) {
          await this.storeProductRepo.update(sp.id, spData as any);
        } else {
          await this.storeProductRepo.save(this.storeProductRepo.create(spData as any));
        }
      }
    }
  }

  private async markAllStale(): Promise<void> {
    await this.gasPriceRepo.createQueryBuilder().update().set({ is_stale: true }).where('source = :src', { src: DataSource.GOOGLE_MAPS }).execute();
  }
}
