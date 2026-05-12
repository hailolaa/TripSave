import { Controller, Get, Post, Body, Query, HttpCode, UseGuards, Request, Logger } from '@nestjs/common';
import { ComparisonService } from './comparison.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { StoreChainType } from '../stores/store-chain.entity';
import { reverseGeocode } from '../utils/geocoding.util';

@Controller('comparison')
export class ComparisonController {
  private readonly logger = new Logger(ComparisonController.name);

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
    
    // If coordinates are the default Dallas ones or missing, use user's saved location
    let finalLat = Number(lat);
    let finalLng = Number(lng);

    if (user?.location_lat && user?.location_lng && (finalLat === 32.776664 || !finalLat)) {
      finalLat = Number(user.location_lat);
      finalLng = Number(user.location_lng);
    }

    // Restriction: USA searches only. If outside, default to Dallas.
    const isUSA = finalLat > 24 && finalLat < 49 && finalLng > -125 && finalLng < -66;
    if (!isUSA) {
      this.logger.log(`Location ${finalLat}, ${finalLng} is outside USA. Force defaulting to Uptown Dallas, TX (75201).`);
      finalLat = 32.7904;
      finalLng = -96.8044;
    }

    let resolvedZip = user?.zip_code;
    
    // Reverse geocode to get the zip code of the selected location
    try {
      const geo = await reverseGeocode(finalLat, finalLng);
      if (geo && geo.zipCode) {
        resolvedZip = geo.zipCode;
      }
    } catch (e) {
      this.logger.warn(`Failed to reverse geocode user location for zip: ${e.message}`);
    }

    // Fallback to Dallas if everything fails
    resolvedZip = resolvedZip || '75201';

    return this.comparisonService.compareItem(
      item,
      finalLat,
      finalLng,
      Number(userMpg),
      Number(userGasPrice),
      resolvedZip,
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
      productIds?: string[]; 
      items?: { productId: string, quantity: number }[];
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

    let finalLat = body.userLat;
    let finalLng = body.userLng;

    // Restriction: USA searches only. If outside, default to Dallas.
    const isUSA = finalLat > 24 && finalLat < 49 && finalLng > -125 && finalLng < -66;
    if (!isUSA) {
      this.logger.log(`Location ${finalLat}, ${finalLng} is outside USA. Force defaulting to Uptown Dallas, TX (75201).`);
      finalLat = 32.7904;
      finalLng = -96.8044;
    }

    let resolvedZip = user?.zip_code || '75201';
    try {
      const geo = await reverseGeocode(finalLat, finalLng);
      if (geo && geo.zipCode) resolvedZip = geo.zipCode;
    } catch {}

    const items = body.items || (body.productIds || []).map(id => ({ productId: id, quantity: 1 }));

    return this.comparisonService.getBestTrueCost(
      finalLat,
      finalLng,
      items,
      mpg,
      gasPriceValue,
      body.storeType,
      body.isRoundTrip ?? true,
      body.sortBy ?? 'true_cost',
      resolvedZip
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
      productIds?: string[]; 
      items?: { productId: string, quantity: number }[];
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

    let items = body.items || [];

    // If no items provided, check productIds
    if (items.length === 0 && body.productIds && body.productIds.length > 0) {
      items = body.productIds.map(id => ({ productId: id, quantity: 1 }));
    }

    // If still no items, fetch from user's current cart
    if (items.length === 0) {
      if (!user) return [];
      const cart = await this.usersService.getCart(user.id);
      items = cart.map(item => ({ productId: item.product_id, quantity: item.quantity }));
    }

    if (items.length === 0) return [];

    let finalLat = body.userLat;
    let finalLng = body.userLng;

    // Restriction: USA searches only. If outside, default to Dallas.
    const isUSA = finalLat > 24 && finalLat < 49 && finalLng > -125 && finalLng < -66;
    if (!isUSA) {
      finalLat = 32.7904;
      finalLng = -96.8044;
    }

    let resolvedZip = user?.zip_code || '75201';
    try {
      const geo = await reverseGeocode(finalLat, finalLng);
      if (geo && geo.zipCode) resolvedZip = geo.zipCode;
    } catch {}

    return this.comparisonService.getBestTrueCost(
      finalLat,
      finalLng,
      items,
      Number(mpg),
      Number(gasPriceValue),
      body.storeType,
      body.isRoundTrip ?? true,
      body.sortBy ?? 'true_cost',
      resolvedZip
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
    @Query('locationName') locationName?: string,
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

    let resolvedLocation = locationName || user?.location_name;

    // Restriction: USA searches only. If outside, default to Dallas.
    const isUSA = finalLat > 24 && finalLat < 49 && finalLng > -125 && finalLng < -66;
    if (!isUSA) {
      this.logger.log(`Location ${finalLat}, ${finalLng} is outside USA. Force defaulting to Uptown Dallas, TX (75201).`);
      finalLat = 32.7904;
      finalLng = -96.8044;
      resolvedLocation = 'Dallas, TX';
    }

    // If still no location name but we have coordinates, try to reverse geocode it
    if (!resolvedLocation && finalLat && finalLng) {
      try {
        const geo = await reverseGeocode(finalLat, finalLng);
        if (geo) {
          resolvedLocation = geo.displayName;
          this.logger.log(`Reverse geocoded ${finalLat}, ${finalLng} to: ${resolvedLocation}`);
        }
      } catch (e) {
        this.logger.warn(`Failed to reverse geocode user location: ${e.message}`);
      }
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
      resolvedLocation || 'Dallas, TX',
    );
  }
}
