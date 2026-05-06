import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { GasSyncService } from '../services/gas-sync.service';

@Controller('gas')
export class GasController {
  constructor(private readonly gasSyncService: GasSyncService) {}

  @Post('sync')
  async syncPrices(@Body('location') location: string) {
    // location here is treated as regionCode for the provider
    return this.gasSyncService.syncGasPrices(location || 'TX');
  }

  @Get('nearby')
  async getNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius?: number,
  ) {
    return this.gasSyncService.getNearbyGasPrices(
      Number(lat),
      Number(lng),
      radius ? Number(radius) : 10,
    );
  }
}
