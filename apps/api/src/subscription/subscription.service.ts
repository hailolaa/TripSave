import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import Stripe from 'stripe';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private stripe: any;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY') || '';
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-01-27.acacia' as any,
    });
  }

  async getOrCreateCustomer(user: User): Promise<string> {
    if (user.stripe_customer_id) return user.stripe_customer_id;

    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.name || user.email,
      metadata: { userId: user.id },
    });

    user.stripe_customer_id = customer.id;
    await this.userRepo.save(user);
    return customer.id;
  }

  async createSetupIntent(userId: string): Promise<{ clientSecret: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const customerId = await this.getOrCreateCustomer(user);

    const setupIntent = await this.stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });

    return { clientSecret: setupIntent.client_secret || '' };
  }

  async saveReferral(userId: string, source: string, referrerName?: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    user.referral_source = source;
    if (referrerName) {
      user.referrer_name = referrerName;
    }
    await this.userRepo.save(user);
  }

  async activateTrial(userId: string, paymentMethodId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const customerId = await this.getOrCreateCustomer(user);

    // 1. Attach payment method to customer
    await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // 2. Set as default payment method
    await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // 3. Create subscription with 7-day trial
    const priceId = this.configService.get<string>('STRIPE_PRICE_ID');
    if (!priceId) throw new BadRequestException('STRIPE_PRICE_ID not configured');

    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: 7,
      expand: ['latest_invoice.payment_intent'],
    });

    user.subscription_status = 'trialing';
    if (subscription.trial_end) {
      user.trial_end_date = new Date(subscription.trial_end * 1000);
    }
    await this.userRepo.save(user);
  }

  async cancelSubscription(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const customerId = await this.getOrCreateCustomer(user);
    const subscriptions = await this.stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    const trialingSubscriptions = await this.stripe.subscriptions.list({
      customer: customerId,
      status: 'trialing',
      limit: 1,
    });

    const sub = subscriptions.data[0] || trialingSubscriptions.data[0];

    if (sub) {
      await this.stripe.subscriptions.cancel(sub.id);
    }

    user.subscription_status = 'canceled';
    await this.userRepo.save(user);
  }

  async getSavedPaymentMethod(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const customerId = await this.getOrCreateCustomer(user);
    const customer = await this.stripe.customers.retrieve(customerId, {
      expand: ['invoice_settings.default_payment_method'],
    });

    const pm = customer.invoice_settings?.default_payment_method as any;
    if (!pm || !pm.card) return null;

    return {
      brand: pm.card.brand,
      last4: pm.card.last4,
      exp_month: pm.card.exp_month,
      exp_year: pm.card.exp_year,
    };
  }

  async getSubscriptionStatus(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return {
      status: user.subscription_status,
      trialEnd: user.trial_end_date,
      referralSource: user.referral_source,
    };
  }

  async handleWebhook(signature: string, payload: Buffer): Promise<void> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
    let event: any;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException('Invalid signature');
    }

    this.logger.log(`Received Stripe event: ${event.type}`);

    switch (event.type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object as any;
        await this.updateUserSubscriptionStatus(subscription);
        break;
      case 'invoice.payment_failed':
        const invoice = event.data.object as any;
        if (invoice.subscription) {
          const sub = await this.stripe.subscriptions.retrieve(invoice.subscription as string);
          await this.updateUserSubscriptionStatus(sub);
        }
        break;
    }
  }

  private async updateUserSubscriptionStatus(subscription: any): Promise<void> {
    const customerId = subscription.customer as string;
    const user = await this.userRepo.findOne({ where: { stripe_customer_id: customerId } });
    if (!user) return;

    user.subscription_status = subscription.status;
    if (subscription.trial_end) {
      user.trial_end_date = new Date(subscription.trial_end * 1000);
    }
    await this.userRepo.save(user);
  }
}

