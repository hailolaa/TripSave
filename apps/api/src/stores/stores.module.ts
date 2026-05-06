import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoresService } from './stores.service';
import { StoresController } from './stores.controller';
import { Store } from './store.entity';
import { StoreChain } from './store-chain.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Store, StoreChain])],
  providers: [StoresService],
  controllers: [StoresController],
  exports: [StoresService]
})
export class StoresModule {}
