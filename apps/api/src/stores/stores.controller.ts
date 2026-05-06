import { Controller, Get, Query } from '@nestjs/common';
import { StoresService } from './stores.service';

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  async getNearbyStores(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius?: number,
  ) {
    return this.storesService.findNearbyStores(
      Number(lat),
      Number(lng),
      radius ? Number(radius) : 10,
    );
  }
}
