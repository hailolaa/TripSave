import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, Query, ParseUUIDPipe, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { geocodePlace } from '../utils/geocoding.util';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  async updateProfile(@Request() req: any, @Body() body: any) {
    const user = await this.usersService.findOneByEmail(req.user.email);
    if (!user) throw new UnauthorizedException('User not found');
    return this.usersService.updateUser(user.id, body);
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

