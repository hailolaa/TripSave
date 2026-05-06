import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GasController } from './gas.controller';
import { GasPrice } from './gas-price.entity';
import { Store } from '../stores/store.entity';
import { StoreChain } from '../stores/store-chain.entity';
import { Product } from '../products/product.entity';
import { StoreProduct } from '../products/store-product.entity';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GasPrice, Store, StoreChain, Product, StoreProduct]),
    AdminModule
  ],
  controllers: [GasController],
})
export class GasModule {}
