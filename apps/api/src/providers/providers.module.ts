import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductNormalizerService } from './normalizer/product-normalizer.service';
import { Product } from '../products/product.entity';

// Oxylabs scraper services
import { OxylabsBaseService } from './oxylabs/oxylabs-base.service';
import { WalmartScraperService } from './oxylabs/walmart-scraper.service';
import { TargetScraperService } from './oxylabs/target-scraper.service';
import { KrogerScraperService } from './oxylabs/kroger-scraper.service';
import { InstacartScraperService } from './oxylabs/instacart-scraper.service';
import { GoogleMapsGasScraperService } from './oxylabs/google-maps-gas-scraper.service';
import { GasBuddyScraperService } from './oxylabs/gasbuddy-scraper.service';
import { AggregatorService } from './oxylabs/aggregator.service';
import { SearchCacheService } from './oxylabs/search-cache.service';

import { StoresModule } from '../stores/stores.module';

/**
 * Providers module — the Data Provider Layer.
 *
 * Encapsulates all external data source integrations.
 * Services should inject providers from here, never call external APIs directly.
 *
 * Architecture: Controllers → Services → ProvidersModule → External Sources
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Product]),
    StoresModule,
  ],
  providers: [
    ProductNormalizerService,
    // Oxylabs grocery scraping stack
    OxylabsBaseService,
    WalmartScraperService,
    TargetScraperService,
    KrogerScraperService,
    InstacartScraperService,
    GoogleMapsGasScraperService,
    GasBuddyScraperService,
    AggregatorService,
    SearchCacheService,
  ],
  exports: [
    ProductNormalizerService,
    AggregatorService,
    SearchCacheService,
    GoogleMapsGasScraperService,
    GasBuddyScraperService,
  ],
})
export class ProvidersModule {}
