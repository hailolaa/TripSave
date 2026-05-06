import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from './store.entity';

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
    const query = this.storesRepository.createQueryBuilder('store')
      .leftJoinAndSelect('store.chain', 'chain')
      .addSelect(`
        ( 3959 * acos( cos( radians(:lat) ) 
          * cos( radians( store.lat ) ) 
          * cos( radians( store.lng ) - radians(:lng) ) 
          + sin( radians(:lat) ) 
          * sin( radians( store.lat ) ) ) )
      `, 'distance')
      .where('store.is_active = :isActive', { isActive: true })
      .having('distance <= :radiusMiles')
      .orderBy('distance', 'ASC')
      .setParameters({
        lat,
        lng,
        radiusMiles
      });

    const results = await query.getRawAndEntities();
    
    return results.entities.map((store, index) => {
      // The distance is exposed in the raw results
      const rawMatch = results.raw.find(r => r.store_id === store.id);
      return {
        store,
        distance: rawMatch ? parseFloat(rawMatch.distance) : 0
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
