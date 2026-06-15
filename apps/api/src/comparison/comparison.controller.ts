import { Controller, Get, Post, Body, Query, HttpCode, UseGuards, Request, Logger } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { ComparisonService } from './comparison.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { StoreChainType } from '../stores/store-chain.entity';
import { reverseGeocode, geocodePlace } from '../utils/geocoding.util';

@Controller('comparison')
@UseGuards(ThrottlerGuard)
export class ComparisonController {
  private readonly logger = new Logger(ComparisonController.name);

  constructor(
    private readonly comparisonService: ComparisonService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveUserLocation(user: any, lat?: number, lng?: number): Promise<{ lat: number; lng: number; zipCode: string }> {
    let finalLat = lat ? Number(lat) : 0;
    let finalLng = lng ? Number(lng) : 0;

    // Detect if default Dallas coordinates are passed
    const isDallasDefault = 
      (!finalLat || !finalLng) || 
      (Math.abs(finalLat - 32.776664) < 0.0001 && Math.abs(finalLng - -96.796987) < 0.0001) ||
      (Math.abs(finalLat - 32.7904) < 0.0001 && Math.abs(finalLng - -96.8044) < 0.0001);

    if (isDallasDefault && user) {
      if (user.location_lat && user.location_lng) {
        finalLat = Number(user.location_lat);
        finalLng = Number(user.location_lng);
        this.logger.log(`Default Dallas coordinates detected. Overriding with user's profile location: ${finalLat}, ${finalLng}`);
      } else if (user.zip_code) {
        const coords = await geocodePlace(user.zip_code);
        if (coords) {
          finalLat = coords.lat;
          finalLng = coords.lng;
          this.logger.log(`Default Dallas coordinates detected. Overriding with geocoded user profile ZIP: ${finalLat}, ${finalLng}`);
        }
      }
    }

    // Default to Dallas if still invalid/missing
    if (!finalLat || !finalLng) {
      finalLat = 32.7904;
      finalLng = -96.8044;
    }

    // Restriction: USA searches only. If outside, default to Dallas.
    const isUSA = finalLat > 24 && finalLat < 49 && finalLng > -125 && finalLng < -66;
    if (!isUSA) {
      this.logger.log(`Location ${finalLat}, ${finalLng} is outside USA. Force defaulting to Uptown Dallas, TX (75201).`);
      finalLat = 32.7904;
      finalLng = -96.8044;
    }

    let resolvedZip = user?.zip_code;
    try {
      const geo = await reverseGeocode(finalLat, finalLng);
      if (geo && geo.zipCode) {
        resolvedZip = geo.zipCode;
      }
    } catch (e) {
      this.logger.warn(`Failed to reverse geocode user location for zip: ${e.message}`);
    }

    return {
      lat: finalLat,
      lng: finalLng,
      zipCode: resolvedZip || '75201',
    };
  }

  // @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 10000, limit: 5 } })
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
    const preferredRadius = user?.preferred_radius ?? 20;
    
    const location = await this.resolveUserLocation(user, lat, lng);

    const result = await this.comparisonService.compareItem(
      item,
      location.lat,
      location.lng,
      Number(userMpg),
      Number(userGasPrice),
      location.zipCode,
      storeType,
      isRoundTrip === 'true' || isRoundTrip === undefined,
      sortBy || 'true_cost',
      forceRefresh === 'true',
      Number(preferredRadius),
    );

    // Normalize response shape: always { status, results }
    const response = (result && result.status) ? result : { status: 'ready', results: Array.isArray(result) ? result : [] };
    
    const isUSASelection = location.lat > 24 && location.lat < 49 && location.lng > -125 && location.lng < -66;
    if (!isUSASelection) {
      return {
        ...response,
        meta: {
          ...(response.meta || {}),
          forcedZip: '75201',
          forcedLocation: 'Uptown Dallas, TX',
          reason: 'GPS coordinates outside USA'
        }
      };
    }
    
    return response;
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
    const preferredRadius = user?.preferred_radius ?? 20;

    const location = await this.resolveUserLocation(user, body.userLat, body.userLng);
    const items = body.items || (body.productIds || []).map(id => ({ productId: id, quantity: 1 }));

    return this.comparisonService.getBestTrueCost(
      location.lat,
      location.lng,
      items,
      mpg,
      gasPriceValue,
      body.storeType,
      body.isRoundTrip ?? true,
      body.sortBy ?? 'true_cost',
      location.zipCode,
      Number(preferredRadius)
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
    const preferredRadius = user?.preferred_radius ?? 20;

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

    const location = await this.resolveUserLocation(user, body.userLat, body.userLng);

    return this.comparisonService.getBestTrueCost(
      location.lat,
      location.lng,
      items,
      Number(mpg),
      Number(gasPriceValue),
      body.storeType,
      body.isRoundTrip ?? true,
      body.sortBy ?? 'true_cost',
      location.zipCode,
      Number(preferredRadius)
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
    const preferredRadius = user?.preferred_radius ?? 20;

    const location = await this.resolveUserLocation(user, lat, lng);
    let resolvedLocation = locationName || user?.location_name;

    // If still no location name but we have coordinates, try to reverse geocode it
    if (!resolvedLocation && location.lat && location.lng) {
      try {
        const geo = await reverseGeocode(location.lat, location.lng);
        if (geo) {
          resolvedLocation = geo.displayName;
          this.logger.log(`Reverse geocoded ${location.lat}, ${location.lng} to: ${resolvedLocation}`);
        }
      } catch (e) {
        this.logger.warn(`Failed to reverse geocode user location: ${e.message}`);
      }
    }

    return this.comparisonService.compareGasStations(
      location.lat,
      location.lng,
      Number(userMpg),
      Number(userGasPrice),
      gallons ? Number(gallons) : 15,
      'regular',
      isRoundTrip === 'true' || isRoundTrip === undefined,
      sortBy || 'true_cost',
      Number(preferredRadius),
      resolvedLocation || 'Dallas, TX',
    );
  }
}
