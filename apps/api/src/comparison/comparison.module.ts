import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComparisonService } from './comparison.service';
import { ComparisonController } from './comparison.controller';
import { CacheController } from './cache.controller';
import { OsrmModule } from '../integrations/osrm/osrm.module';
import { StoresModule } from '../stores/stores.module';
import { UsersModule } from '../users/users.module';
import { ProvidersModule } from '../providers/providers.module';
import { ProductsModule } from '../products/products.module';
import { StoreProduct } from '../products/store-product.entity';
import { GasPrice } from '../gas/gas-price.entity';
import { Product } from '../products/product.entity';
import { Store } from '../stores/store.entity';
import { SearchActivity } from '../models/search-activity.entity';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    OsrmModule,
    StoresModule,
    UsersModule,
    ProvidersModule,
    ProductsModule,
    AdminModule,
    TypeOrmModule.forFeature([StoreProduct, GasPrice, Product, Store, SearchActivity])
  ],
  providers: [ComparisonService],
  controllers: [ComparisonController, CacheController],
})
export class ComparisonModule {}
