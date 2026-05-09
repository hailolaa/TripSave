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
    let finalLat = Number(lat);
    let finalLng = Number(lng);

    // Restriction: USA searches only. If outside, default to Dallas.
    const isUSA = finalLat > 24 && finalLat < 49 && finalLng > -125 && finalLng < -66;
    if (!isUSA) {
      finalLat = 32.7767;
      finalLng = -96.7970;
    }

    return this.gasSyncService.getNearbyGasPrices(
      finalLat,
      finalLng,
      radius ? Number(radius) : 10,
    );
  }
}
