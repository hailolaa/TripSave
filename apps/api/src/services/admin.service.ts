import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreProduct } from '../products/store-product.entity';
import { GasPrice } from '../gas/gas-price.entity';
import { DataSource } from '../common/enums/data-source.enum';

/**
 * Admin service for manual data management.
 * Provides endpoints for price overrides, data corrections, and diagnostics.
 */
import { User } from '../users/user.entity';

/**
 * Admin service for manual data management.
 * Provides endpoints for price overrides, data corrections, and diagnostics.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(StoreProduct) private readonly storeProductRepo: Repository<StoreProduct>,
    @InjectRepository(GasPrice) private readonly gasPriceRepo: Repository<GasPrice>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  /** Get ranked list of referrers and their counts */
  async getReferralRanking() {
    return this.userRepo
      .createQueryBuilder('user')
      .select('user.referrer_name', 'name')
      .addSelect('COUNT(*)', 'count')
      .where('user.referrer_name IS NOT NULL')
      .andWhere("user.referrer_name != ''")
      .groupBy('user.referrer_name')
      .orderBy('count', 'DESC')
      .getRawMany();
  }

  /** Update a store product's price manually */
  async updateProductPrice(storeProductId: string, newPrice: number): Promise<StoreProduct> {
    const sp = await this.storeProductRepo.findOne({ where: { id: storeProductId }, relations: ['product', 'store'] });
    if (!sp) throw new NotFoundException(`StoreProduct ${storeProductId} not found`);

    this.logger.log(`Admin override: StoreProduct ${storeProductId} price ${sp.price} → ${newPrice}`);

    sp.price = newPrice;
    sp.source = DataSource.MANUAL;
    sp.last_verified_at = new Date();
    sp.is_stale = false;

    return this.storeProductRepo.save(sp);
  }

  /** Override multiple fields on a store product */
  async overrideStoreProduct(storeProductId: string, data: Partial<StoreProduct>): Promise<StoreProduct> {
    const sp = await this.storeProductRepo.findOne({ where: { id: storeProductId } });
    if (!sp) throw new NotFoundException(`StoreProduct ${storeProductId} not found`);

    // Only allow safe fields to be overridden
    const allowed: (keyof StoreProduct)[] = ['price', 'sale_price', 'unit_price', 'in_stock', 'is_stale'];
    for (const key of allowed) {
      if (data[key] !== undefined) (sp as any)[key] = data[key];
    }

    sp.source = DataSource.MANUAL;
    sp.last_verified_at = new Date();

    this.logger.log(`Admin override on StoreProduct ${storeProductId}: ${JSON.stringify(data)}`);
    return this.storeProductRepo.save(sp);
  }

  /** Update gas price manually */
  async updateGasPrice(gasPriceId: string, prices: { regular?: number; midgrade?: number; premium?: number; diesel?: number }): Promise<GasPrice> {
    const gp = await this.gasPriceRepo.findOne({ where: { id: gasPriceId } });
    if (!gp) throw new NotFoundException(`GasPrice ${gasPriceId} not found`);

    if (prices.regular !== undefined) gp.regular_price = prices.regular;
    if (prices.midgrade !== undefined) gp.midgrade_price = prices.midgrade;
    if (prices.premium !== undefined) gp.premium_price = prices.premium;
    if (prices.diesel !== undefined) gp.diesel_price = prices.diesel;
    gp.source = DataSource.MANUAL;
    gp.last_updated = new Date();
    gp.is_stale = false;

    this.logger.log(`Admin gas price override: ${gasPriceId}`);
    return this.gasPriceRepo.save(gp);
  }

  /** Get data quality overview */
  async getDataOverview() {
    const totalProducts = await this.storeProductRepo.count();
    const staleProducts = await this.storeProductRepo.count({ where: { is_stale: true } });
    const totalGas = await this.gasPriceRepo.count();
    const staleGas = await this.gasPriceRepo.count({ where: { is_stale: true } });

    return {
      products: { total: totalProducts, stale: staleProducts, fresh: totalProducts - staleProducts },
      gas: { total: totalGas, stale: staleGas, fresh: totalGas - staleGas },
    };
  }

  /** Fix gas station coordinates that are 0,0 */
  async fixGasCoordinates() {
    const { geocodePlaceNear } = require('../utils/geocoding.util');
    const { Store } = require('../stores/store.entity');
    const storeRepo = this.storeProductRepo.manager.getRepository(Store);

    const storesToFix = await storeRepo.find({ where: { lat: 0, lng: 0 } });
    if (storesToFix.length === 0) return { success: true, message: 'No stores need fixing' };

    let fixedCount = 0;
    for (const store of storesToFix) {
      // Defaulting to near Dallas since most testing data is there.
      const geo = await geocodePlaceNear(`${store.name} ${store.address}`, 32.776664, -96.796987, 2.0);
      if (geo) {
        store.lat = geo.lat;
        store.lng = geo.lng;
        await storeRepo.save(store);
        fixedCount++;
        // Small delay to prevent rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return { success: true, fixed: fixedCount, totalFailed: storesToFix.length };
  }
}
