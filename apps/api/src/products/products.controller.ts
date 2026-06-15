import { Controller, Get, Query, Param, Req, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { ProductsService } from './products.service';
import { AggregatorService } from '../providers/oxylabs/aggregator.service';
import { resolveZipFromRequest } from '../utils/location.util';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly aggregatorService: AggregatorService,
  ) {}

  /**
   * Grocery search with Smart Sync.
   * 1. Checks local DB for fresh data (< 24h).
   * 2. If stale/missing, triggers Oxylabs live scrape.
   * 3. Syncs new data back to DB in background.
   */
  @Get()
  async searchProducts(
    @Query('query') query: string,
    @Query('q') q: string,
    @Query('zip') zip: string,
    @Req() req: Request,
  ) {
    const searchTerm = (query || q)?.trim();
    if (!searchTerm) {
      throw new BadRequestException('Query parameter is required. Use ?query=milk or ?q=milk');
    }

    const resolvedZip = zip || await resolveZipFromRequest(req);

    // 1. Try DB first (Fresh data < 24h)
    const dbResults = await this.productsService.searchFromDb(searchTerm, resolvedZip);
    if (dbResults && dbResults.length > 0) {
      return {
        success: true,
        query: searchTerm,
        zip: resolvedZip,
        count: dbResults.length,
        source: 'database',
        data: dbResults
      };
    }

    // 2. Fallback to live scrape
    const liveResults = await this.aggregatorService.search(searchTerm, resolvedZip);

    // 3. Background Sync to DB (Don't await to keep response fast)
    if (liveResults.success && liveResults.data.length > 0) {
      this.productsService.upsertScrapedProducts(liveResults.data, resolvedZip)
        .catch(err => console.error('Background sync failed:', err));
    }

    return liveResults;
  }

  @Get('search')
  async search(@Query('q') query: string) {
    return this.productsService.searchProducts(query);
  }

  @Get('suggestions')
  async suggestions(
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ) {
    return this.productsService.suggestProducts(query, limit ? Number(limit) : 8);
  }

  @Get('category/:category')
  async findByCategory(@Param('category') category: string) {
    return this.productsService.findByCategory(category);
  }

  @Get('deals')
  async getDeals(@Query('zip') zip: string, @Req() req: Request) {
    const resolvedZip = zip || await resolveZipFromRequest(req);
    return this.productsService.getDeals(resolvedZip);
  }
}
