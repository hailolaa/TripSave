import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminController } from './admin.controller';
import { AdminRoleGuard } from './admin-role.guard';
import { AdminService } from '../services/admin.service';
import { DataSyncService } from '../services/data-sync.service';
import { GasSyncService } from '../services/gas-sync.service';
import { WarmCacheService } from '../services/warm-cache.service';
import { ProvidersModule } from '../providers/providers.module';
import { UsersModule } from '../users/users.module';
import { ProductsModule } from '../products/products.module';
import { StoreProduct } from '../products/store-product.entity';
import { GasPrice } from '../gas/gas-price.entity';
import { Store } from '../stores/store.entity';
import { StoreChain } from '../stores/store-chain.entity';
import { Product } from '../products/product.entity';
import { DataSyncLog } from '../models/data-sync-log.entity';
import { User } from '../users/user.entity';
import { AdminUiController } from './admin-ui.controller';

/**
 * Admin module — wires admin endpoints, sync services, and cron jobs.
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    ProvidersModule,
    UsersModule,
    ProductsModule,
    TypeOrmModule.forFeature([
      StoreProduct,
      GasPrice,
      Store,
      StoreChain,
      Product,
      DataSyncLog,
      User,
    ]),
  ],
  controllers: [AdminController, AdminUiController],
  providers: [
    AdminService,
    AdminRoleGuard,
    DataSyncService,
    GasSyncService,
    WarmCacheService,
  ],
  exports: [
    DataSyncService,
    GasSyncService,
    WarmCacheService,
  ],
})
export class AdminModule {}
