import { Controller, Get, Query } from '@nestjs/common';
import { ProductsService } from '../products/products.service';

@Controller('cache')
export class CacheController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('status')
  async getCacheStatus(@Query('zip') zip: string, @Query('query') query: string) {
    if (!zip || !query) {
      return { cached: false, staleness: 'missing' };
    }

    const dbCheck = await this.productsService.searchFromDbWithStaleness(query, zip);
    
    if (dbCheck && dbCheck.products && dbCheck.products.length > 0) {
      return { 
        cached: true, 
        staleness: dbCheck.isStale ? 'stale' : 'fresh' 
      };
    }

    return { cached: false, staleness: 'missing' };
  }
}
