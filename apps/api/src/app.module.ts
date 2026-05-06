import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';
import { StoresModule } from './stores/stores.module';
import { ProductsModule } from './products/products.module';
import { GasModule } from './gas/gas.module';
import { ComparisonModule } from './comparison/comparison.module';
import { OsrmModule } from './integrations/osrm/osrm.module';
import { ProvidersModule } from './providers/providers.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    AuthModule, 
    UsersModule, 
    StoresModule, 
    ProductsModule, 
    GasModule, 
    ComparisonModule, 
    OsrmModule,
    ProvidersModule,
    AdminModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
