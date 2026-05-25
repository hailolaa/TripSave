import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from './store.entity';
import { haversineDistanceMiles } from '../utils/geo.util';

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(Store)
    private storesRepository: Repository<Store>,
  ) {}

  /**
   * Find nearby stores using the Haversine formula
   * @param lat User Latitude
   * @param lng User Longitude
   * @param radiusMiles Max radius in miles
   */
  async findNearbyStores(lat: number, lng: number, radiusMiles: number = 10): Promise<{store: Store, distance: number}[]> {
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
      .where('store.is_active = :isActive', { isActive: true })
      .andWhere('store.lat != 0 AND store.lng != 0')
      .having('distance <= :radiusMiles')
      .orderBy('distance', 'ASC')
      .setParameters({
        lat,
        lng,
        radiusMiles
      });

    const results = await query.getRawAndEntities();
    
    return results.entities.map((store) => {
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

      return {
        store,
        distance: dbDistance !== null && !isNaN(dbDistance) && dbDistance > 0 ? dbDistance : calculatedDistance
      };
    });
  }

  async findAll(): Promise<Store[]> {
    return this.storesRepository.find({
      where: { is_active: true },
      relations: ['chain']
    });
  }
}

