import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, Query, ParseUUIDPipe, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { WarmCacheService } from '../services/warm-cache.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { geocodePlace } from '../utils/geocoding.util';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly warmCacheService: WarmCacheService
  ) {}

  @Patch('me')
  async updateProfile(@Request() req: any, @Body() body: any) {
    const user = await this.usersService.findOneByEmail(req.user.email);
    if (!user) throw new UnauthorizedException('User not found');
    
    const updatedUser = await this.usersService.updateUser(user.id, body);
    
    // Check if location changed to trigger proactive cache warming
    if (body.zip_code || body.location_lat || body.location_lng) {
      if (updatedUser) {
        const newZip = body.zip_code || updatedUser.zip_code;
        if (newZip) {
          // Fire background cache warm-up on location update
          this.warmCacheService.warmNewUser(newZip).catch(err => {
            console.error(`Failed to warm cache for user location ${newZip}:`, err);
          });
        }
      }
    }
    
    return updatedUser;
  }

  @Get('geocode')
  async geocode(@Query('q') query: string) {
    return geocodePlace(query);
  }

  // --- Cart Endpoints ---

  @Get('me/cart')
  async getCart(@Request() req: any) {
    const user = await this.usersService.findOneByEmail(req.user.email);
    if (!user) throw new UnauthorizedException('User not found');
    return this.usersService.getCart(user.id);
  }

  @Post('me/cart')
  async addToCart(@Request() req: any, @Body() body: { productId: string; quantity?: number }) {
    const user = await this.usersService.findOneByEmail(req.user.email);
    if (!user) throw new UnauthorizedException('User not found');
    return this.usersService.addToCart(user.id, body.productId, body.quantity || 1);
  }

  @Patch('me/cart/:id')
  async updateCartItem(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) itemId: string,
    @Body() body: { quantity: number }
  ) {
    const user = await this.usersService.findOneByEmail(req.user.email);
    if (!user) throw new UnauthorizedException('User not found');
    return this.usersService.updateCartItem(user.id, itemId, body.quantity);
  }

  @Delete('me/cart/:id')
  async removeFromCart(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) itemId: string
  ) {
    const user = await this.usersService.findOneByEmail(req.user.email);
    if (!user) throw new UnauthorizedException('User not found');
    return this.usersService.removeFromCart(user.id, itemId);
  }
}

