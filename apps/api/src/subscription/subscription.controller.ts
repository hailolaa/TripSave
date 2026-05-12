import { Controller, Post, Body, Get, UseGuards, Request, Headers, RawBodyRequest, HttpCode } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @UseGuards(JwtAuthGuard)
  @Post('referral')
  async saveReferral(
    @Request() req: any, 
    @Body() body: { source: string, referrer_name?: string }
  ) {
    await this.subscriptionService.saveReferral(req.user.userId, body.source, body.referrer_name);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('setup-intent')
  async createSetupIntent(@Request() req: any) {
    return this.subscriptionService.createSetupIntent(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('activate-trial')
  async activateTrial(@Request() req: any, @Body('paymentMethodId') paymentMethodId: string) {
    await this.subscriptionService.activateTrial(req.user.userId, paymentMethodId);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('cancel')
  async cancelSubscription(@Request() req: any) {
    await this.subscriptionService.cancelSubscription(req.user.userId);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('payment-method')
  async getPaymentMethod(@Request() req: any) {
    return this.subscriptionService.getSavedPaymentMethod(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getStatus(@Request() req: any) {
    return this.subscriptionService.getSubscriptionStatus(req.user.userId);
  }

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Request() req: RawBodyRequest<Request>,
  ) {
    await this.subscriptionService.handleWebhook(signature, (req as any).rawBody);
    return { received: true };
  }
}
