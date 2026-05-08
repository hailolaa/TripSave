import { Controller, Get, Post, Body, Query, HttpCode, UseGuards, Request } from '@nestjs/common';
import { ComparisonService } from './comparison.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { StoreChainType } from '../stores/store-chain.entity';

@Controller('comparison')
export class ComparisonController {
  constructor(
    private readonly comparisonService: ComparisonService,
    private readonly usersService: UsersService,
  ) {}

  // @UseGuards(JwtAuthGuard)
  @Get('compare')
  async compareItem(
    @Request() req: any,
    @Query('item') item: string,
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('mpg') mpg?: number,
    @Query('gasPrice') gasPrice?: number,
    @Query('storeType') storeType?: StoreChainType,
    @Query('isRoundTrip') isRoundTrip?: string,
    @Query('sortBy') sortBy?: string,
    @Query('forceRefresh') forceRefresh?: string,
  ) {
    const user = req.user?.email ? await this.usersService.findOneByEmail(req.user.email) : null;
    const userMpg = mpg ?? user?.vehicle_mpg ?? 25;
    const userGasPrice = gasPrice ?? user?.default_gas_price ?? 3.50;
    const userZip = user?.zip_code || '75201';

    // If coordinates are the default Dallas ones or missing, use user's saved location
    let finalLat = Number(lat);
    let finalLng = Number(lng);

    if (user?.location_lat && user?.location_lng && (finalLat === 32.776664 || !finalLat)) {
      finalLat = Number(user.location_lat);
      finalLng = Number(user.location_lng);
    }

    return this.comparisonService.compareItem(
      item,
      finalLat,
      finalLng,
      Number(userMpg),
      Number(userGasPrice),
      userZip,
      storeType,
      isRoundTrip === 'true' || isRoundTrip === undefined,
      sortBy || 'true_cost',
      forceRefresh === 'true',
    );
  }

  // @UseGuards(JwtAuthGuard)
  @Post('true-cost')
  @HttpCode(200)
  async getTrueCost(
    @Request() req: any,
    @Body() body: { 
      userLat: number; 
      userLng: number; 
      productIds: string[]; 
      userMpg?: number; 
      gasPrice?: number;
      storeType?: StoreChainType;
      isRoundTrip?: boolean;
      sortBy?: string;
    }
  ) {
    const user = req.user?.email ? await this.usersService.findOneByEmail(req.user.email) : null;
    const mpg = body.userMpg ?? user?.vehicle_mpg ?? 25;
    const gasPriceValue = body.gasPrice ?? user?.default_gas_price ?? 3.50;

    return this.comparisonService.getBestTrueCost(
      body.userLat,
      body.userLng,
      body.productIds,
      mpg,
      gasPriceValue,
      body.storeType,
      body.isRoundTrip ?? true,
      body.sortBy ?? 'true_cost'
    );
  }

  // @UseGuards(JwtAuthGuard)
  @Post('cart/compare')
  @HttpCode(200)
  async compareCart(
    @Request() req: any,
    @Body() body: { 
      userLat: number; 
      userLng: number; 
      productIds: string[]; 
      userMpg?: number; 
      gasPrice?: number;
      storeType?: StoreChainType;
      isRoundTrip?: boolean;
      sortBy?: string;
    }
  ) {
    const user = req.user?.email ? await this.usersService.findOneByEmail(req.user.email) : null;
    const mpg = body.userMpg ?? user?.vehicle_mpg ?? 25;
    const gasPriceValue = body.gasPrice ?? user?.default_gas_price ?? 3.50;

    let productIds = body.productIds;

    // If no productIds provided, fetch from user's current cart
    if (!productIds || productIds.length === 0) {
      if (!user) return [];
      const cart = await this.usersService.getCart(user.id);
      productIds = cart.map(item => item.product_id);
    }

    if (productIds.length === 0) return [];

    return this.comparisonService.getBestTrueCost(
      body.userLat,
      body.userLng,
      productIds,
      Number(mpg),
      Number(gasPriceValue),
      body.storeType,
      body.isRoundTrip ?? true,
      body.sortBy ?? 'true_cost'
    );
  }
  // @UseGuards(JwtAuthGuard)
  @Get('gas')
  async compareGas(
    @Request() req: any,
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('mpg') mpg?: number,
    @Query('gasPrice') gasPrice?: number,
    @Query('gallons') gallons?: number,
    @Query('fuelType') fuelType?: 'regular' | 'midgrade' | 'premium' | 'diesel',
    @Query('isRoundTrip') isRoundTrip?: string,
    @Query('sortBy') sortBy?: string,
    @Query('forceRefresh') forceRefresh?: string,
  ) {
    const user = req.user?.email ? await this.usersService.findOneByEmail(req.user.email) : null;
    const userMpg = mpg ?? user?.vehicle_mpg ?? 25;
    const userGasPrice = gasPrice ?? user?.default_gas_price ?? 3.50;

    let finalLat = Number(lat);
    let finalLng = Number(lng);
    if (user?.location_lat && user?.location_lng && (finalLat === 32.776664 || !finalLat)) {
      finalLat = Number(user.location_lat);
      finalLng = Number(user.location_lng);
    }

    return this.comparisonService.compareGasStations(
      finalLat,
      finalLng,
      Number(userMpg),
      Number(userGasPrice),
      gallons ? Number(gallons) : 15,
      fuelType || 'regular',
      isRoundTrip === 'true' || isRoundTrip === undefined,
      sortBy || 'true_cost',
    );
  }
}
