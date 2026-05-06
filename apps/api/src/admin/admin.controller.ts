import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminRoleGuard } from './admin-role.guard';
import { AdminService } from '../services/admin.service';
import { DataSyncService } from '../services/data-sync.service';

/**
 * Admin endpoints for manual data management.
 * All endpoints require JWT authentication + admin role.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly dataSyncService: DataSyncService,
  ) {}

  /** Update a product's price manually */
  @Patch('store-products/:id/price')
  async updateProductPrice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { price: number },
  ) {
    return this.adminService.updateProductPrice(id, body.price);
  }

  /** Override store product data */
  @Patch('store-products/:id')
  async overrideStoreProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: any,
  ) {
    return this.adminService.overrideStoreProduct(id, body);
  }

  /** Update gas price manually */
  @Patch('gas-prices/:id')
  async updateGasPrice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { regular?: number; midgrade?: number; premium?: number; diesel?: number },
  ) {
    return this.adminService.updateGasPrice(id, body);
  }

  /** Trigger a data refresh from a specific provider */
  @Post('sync/:provider')
  @HttpCode(200)
  async triggerSync(
    @Param('provider') provider: string,
    @Body() params: Record<string, any>,
  ) {
    return this.dataSyncService.triggerSync(provider, params);
  }

  /** Get sync history logs */
  @Get('sync/logs')
  async getSyncLogs(@Query('limit') limit?: string) {
    return this.dataSyncService.getSyncLogs(limit ? parseInt(limit, 10) : 50);
  }

  /** Get data quality overview */
  @Get('data/overview')
  async getDataOverview() {
    return this.adminService.getDataOverview();
  }
}
