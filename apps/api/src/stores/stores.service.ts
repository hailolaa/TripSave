import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { Store } from './store.entity';
import { StoreChain, StoreChainType } from './store-chain.entity';
import { haversineDistanceMiles } from '../utils/geo.util';
import { DataSource } from '../common/enums/data-source.enum';
import { ScrapedProduct } from '../providers/oxylabs/oxylabs-base.service';
import { GoogleMapsGasScraperService } from '../providers/oxylabs/google-maps-gas-scraper.service';
import { NormalizedGasStation } from '../common/interfaces/normalized-gas-price.interface';

interface NearbyStoreOptions {
  mapSafe?: boolean;
  limit?: number;
  refreshMajorChains?: boolean;
}

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(Store)
    private storesRepository: Repository<Store>,
    @InjectRepository(StoreChain)
    private chainRepository: Repository<StoreChain>,
    private readonly googleMapsScraper: GoogleMapsGasScraperService,
  ) {}

  /**
   * Find nearby stores using the Haversine formula with a bounding box pre-filter
   * @param lat User Latitude
   * @param lng User Longitude
   * @param radiusMiles Max radius in miles
   */
  async findNearbyStores(
    lat: number,
    lng: number,
    radiusMiles: number = 10,
    options: NearbyStoreOptions = {},
  ): Promise<{store: Store, distance: number}[]> {
    // 1 degree latitude ≈ 69 miles. Add 20% buffer.
    const latDelta = (radiusMiles / 69) * 1.2;
    const lngDelta = (radiusMiles / (69 * Math.cos(lat * Math.PI / 180))) * 1.2;
    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLng = lng - lngDelta;
    const maxLng = lng + lngDelta;

    // 3959 is the radius of the earth in miles
    // Clamping the acos input using LEAST and GREATEST prevents returning NULL/NaN due to floating-point precision issues
    const query = this.storesRepository.createQueryBuilder('store')
      .leftJoinAndSelect('store.chain', 'chain')
      .addSelect(`
        ( 3959 * acos( LEAST( 1.0, GREATEST( -1.0, 
          cos( radians(:lat) ) 
          * cos( radians( store.lat ) ) 
          * cos( radians( store.lng ) - radians(:lng) ) 
          + sin( radians(:lat) ) 
          * sin( radians( store.lat ) ) 
        ) ) ) )
      `, 'distance')
      .where('store.is_active = :isActive')
      .andWhere('store.lat != 0 AND store.lng != 0')
      .andWhere('store.lat BETWEEN :minLat AND :maxLat')
      .andWhere('store.lng BETWEEN :minLng AND :maxLng')
      .having('distance <= :radiusMiles')
      .orderBy('distance', 'ASC')
      .setParameters({
        lat,
        lng,
        radiusMiles,
        isActive: true,
        minLat,
        maxLat,
        minLng,
        maxLng,
      });

    const results = await query.getRawAndEntities();
    
    const nearby = results.entities.map((store) => {
      // Find matching raw row by comparing store ID securely, handling both string UUIDs and binary Buffers
      const rawMatch = results.raw.find(r => {
        const rawIds = [r.store_id, r.id, r.store_id_alias, r.id_alias];
        return rawIds.some(val => {
          if (!val) return false;
          if (typeof val === 'string' && val.toLowerCase() === store.id.toLowerCase()) return true;
          if (Buffer.isBuffer(val)) {
            const hex = val.toString('hex').toLowerCase();
            const cleanId = store.id.replace(/-/g, '').toLowerCase();
            return hex === cleanId;
          }
          return false;
        }) || Object.keys(r).some(key => {
          if (!key.toLowerCase().includes('id')) return false;
          const val = r[key];
          if (!val) return false;
          if (typeof val === 'string' && val.toLowerCase() === store.id.toLowerCase()) return true;
          if (Buffer.isBuffer(val)) {
            const hex = val.toString('hex').toLowerCase();
            const cleanId = store.id.replace(/-/g, '').toLowerCase();
            return hex === cleanId;
          }
          return false;
        });
      });

      const dbDistance = rawMatch?.distance != null ? parseFloat(rawMatch.distance) : null;
      const calculatedDistance = haversineDistanceMiles(lat, lng, Number(store.lat), Number(store.lng));

      let distance = dbDistance !== null && !isNaN(dbDistance) && dbDistance > 0 ? dbDistance : calculatedDistance;
      if (distance === 999) {
        distance = radiusMiles - 0.1;
      }

      return {
        store,
        distance
      };
    });

    const cleaned = this.cleanNearbyStoreResults(nearby, options);

    if (options.mapSafe && options.refreshMajorChains !== false) {
      const refreshed = await this.refreshMissingMajorRetailers(lat, lng, radiusMiles, cleaned);
      if (refreshed) {
        return this.findNearbyStores(lat, lng, radiusMiles, {
          ...options,
          refreshMajorChains: false,
        });
      }
    }

    return cleaned;
  }

  private cleanNearbyStoreResults(
    results: { store: Store; distance: number }[],
    options: NearbyStoreOptions,
  ): { store: Store; distance: number }[] {
    const filtered = options.mapSafe
      ? results.filter((result) => this.isMapSafeStore(result.store))
      : results;

    const byPlace = new Map<string, { store: Store; distance: number }>();
    for (const result of filtered) {
      const key = this.storeDedupeKey(result.store);
      const existing = byPlace.get(key);

      if (!existing || this.storeQualityScore(result.store) > this.storeQualityScore(existing.store)) {
        byPlace.set(key, result);
      }
    }

    const cleaned = Array.from(byPlace.values()).sort((a, b) => a.distance - b.distance);
    return typeof options.limit === 'number' ? cleaned.slice(0, options.limit) : cleaned;
  }

  private async refreshMissingMajorRetailers(
    lat: number,
    lng: number,
    radiusMiles: number,
    currentResults: { store: Store; distance: number }[],
  ): Promise<boolean> {
    const requiredChains = ['Walmart', 'Target'];
    let didRefresh = false;

    for (const chainName of requiredChains) {
      const chainResults = currentResults.filter((result) => {
        const existingChain = result.store.chain?.name || '';
        return existingChain.toLowerCase() === chainName.toLowerCase();
      });

      const nearestChainDistance = chainResults.length > 0
        ? Math.min(...chainResults.map((result) => result.distance))
        : Number.POSITIVE_INFINITY;
      const hasFreshChainResult = chainResults.some((result) => this.wasVerifiedRecently(result.store));

      if (chainResults.length > 0 && (nearestChainDistance <= 3 || hasFreshChainResult)) {
        continue;
      }

      const radiusMeters = Math.max(1600, Math.round(radiusMiles * 1609.34));
      const places = await this.googleMapsScraper.searchNearbyStoresByCoords(
        lat,
        lng,
        chainName,
        radiusMeters,
      );
      const saved = await this.upsertDiscoveredMapStores(chainName, places);
      didRefresh = didRefresh || saved > 0;
    }

    return didRefresh;
  }

  private wasVerifiedRecently(store: Store): boolean {
    if (!store.last_verified_at) return false;
    const verifiedAt = new Date(store.last_verified_at).getTime();
    if (Number.isNaN(verifiedAt)) return false;

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - verifiedAt < sevenDaysMs;
  }

  private async upsertDiscoveredMapStores(chainName: string, places: NormalizedGasStation[]): Promise<number> {
    const chain = await this.findOrCreateRetailChain(chainName);
    let saved = 0;

    for (const place of places) {
      if (!this.isValidDiscoveredPlace(chainName, place)) continue;

      const existing = place.stationId
        ? await this.storesRepository.findOne({ where: { external_id: place.stationId } })
        : await this.storesRepository.findOne({
            where: {
              name: ILike(place.name),
              address: ILike(place.address),
            },
          });

      const storeData: Partial<Store> = {
        chain_id: chain.id,
        name: place.name,
        address: place.address,
        lat: place.latitude,
        lng: place.longitude,
        external_id: place.stationId,
        source: DataSource.GOOGLE_MAPS,
        is_active: true,
        coords_confident: true,
        last_verified_at: new Date(),
      };

      if (existing) {
        await this.storesRepository.update(existing.id, storeData);
      } else {
        await this.storesRepository.save(storeData);
      }
      saved++;
    }

    return saved;
  }

  private isValidDiscoveredPlace(chainName: string, place: NormalizedGasStation): boolean {
    if (!place.name || !place.address) return false;
    if (!place.latitude || !place.longitude) return false;
    if (place.latitude < -90 || place.latitude > 90 || place.longitude < -180 || place.longitude > 180) return false;

    const normalizedName = place.name.toLowerCase();
    return normalizedName.includes(chainName.toLowerCase());
  }

  private async findOrCreateRetailChain(chainName: string): Promise<StoreChain> {
    const existing = await this.chainRepository.findOne({ where: { name: ILike(chainName) } });
    if (existing) return existing;

    const domain = chainName.toLowerCase() === 'walmart' ? 'walmart.com' : 'target.com';
    const token = process.env.LOGO_DEV_TOKEN || 'pk_UUfT4NowQ-GmCHtVoknvfg';
    return this.chainRepository.save({
      name: chainName,
      slug: chainName.toLowerCase().replace(/\s+/g, '-'),
      type: StoreChainType.GROCERY,
      logo_url: `https://img.logo.dev/${domain}?token=${token}`,
    });
  }

  private isMapSafeStore(store: Store): boolean {
    const address = store.address?.trim() || '';
    if (!address) return false;
    if (store.source === DataSource.DIRECT || store.source === DataSource.MANUAL) return false;
    if (store.lat === 0 || store.lng === 0) return false;
    if (!store.coords_confident) return false;
    return true;
  }

  private storeDedupeKey(store: Store): string {
    const chain = store.chain?.name || '';
    const name = store.name || '';
    const address = store.address?.trim().toLowerCase();
    if (address) {
      return `${chain}|${name}|${address}`.toLowerCase();
    }

    return `${chain}|${name}|${Number(store.lat).toFixed(5)}|${Number(store.lng).toFixed(5)}`.toLowerCase();
  }

  private storeQualityScore(store: Store): number {
    let score = 0;
    if (store.source === DataSource.GOOGLE_MAPS) score += 10;
    if (store.external_id) score += 4;
    if (store.address) score += 3;
    if (store.last_verified_at) score += 2;
    if (store.coords_confident) score += 1;
    return score;
  }

  async findAll(): Promise<Store[]> {
    return this.storesRepository.find({
      where: { is_active: true },
      relations: ['chain']
    });
  }

  async upsertDiscoveredStores(products: ScrapedProduct[]): Promise<void> {
    const logger = new Logger(StoresService.name);
    for (const p of products) {
      if (!p.lat || !p.lng || p.lat === 0 || p.lng === 0) continue;
      
      try {
        // Find or create the chain
        const firstWord = p.store.split(' ')[0];
        const chain = await this.chainRepository.findOne({
          where: { name: Like(`%${firstWord}%`) }
        });
        
        if (!chain) continue; // Don't create chains for unknown stores
        
        // Upsert the store by external_id or name+zip
        await this.storesRepository.upsert({
          chain_id: chain.id,
          name: p.store,
          address: p.address || '',
          lat: p.lat,
          lng: p.lng,
          zip: p.zip || '',
          source: DataSource.GOOGLE_MAPS,
          is_active: true,
          coords_confident: true,
          last_verified_at: new Date(),
        }, ['name', 'zip']); // upsert key: same name + zip = same store
      } catch (e: any) {
        logger.error(`Failed to upsert store ${p.store}: ${e.message}`);
        // silently skip — don't break the main flow
      }
    }
  }
}
