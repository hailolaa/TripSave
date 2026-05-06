import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GasSyncService } from './gas-sync.service';
import { DataSyncLog } from '../models/data-sync-log.entity';
import { CRON_SCHEDULES } from '../common/constants/cache-ttl.constants';

/**
 * Background data synchronization orchestrator.
 * Runs cron jobs to refresh data from all providers.
 * Logs every sync attempt for admin visibility.
 *
 * NOTE: Grocery data is now fetched live via the Flipp aggregator
 * (see AggregatorService / Oxylabs) and is no longer synced on a cron schedule.
 */
@Injectable()
export class DataSyncService {
  private readonly logger = new Logger(DataSyncService.name);

  constructor(
    private readonly gasSyncService: GasSyncService,
    @InjectRepository(DataSyncLog)
    private readonly syncLogRepo: Repository<DataSyncLog>,
  ) {}

  /** Refresh gas prices every 6 hours */
  @Cron(CRON_SCHEDULES.GAS_REFRESH)
  async refreshGasPrices(): Promise<void> {
    const log = await this.createLog('gasbuddy');
    try {
      this.logger.log('⛽ Cron: Refreshing gas prices...');
      const result = await this.gasSyncService.syncGasPrices('TX');
      await this.completeLog(log.id, result.success ? 'success' : 'failed', result.count);
    } catch (error: any) {
      await this.completeLog(log.id, 'failed', 0, error.message);
    }
  }

  /** Manually trigger a sync for a specific provider */
  async triggerSync(provider: string, params?: Record<string, any>): Promise<DataSyncLog> {
    const log = await this.createLog(provider);
    try {
      let count = 0;
      switch (provider) {
        case 'gasbuddy':
        case 'gas':
          const gasResult = await this.gasSyncService.syncGasPrices(params?.regionCode || 'TX');
          count = gasResult.count;
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
      return this.completeLog(log.id, 'success', count);
    } catch (error: any) {
      return this.completeLog(log.id, 'failed', 0, error.message);
    }
  }

  /** Get recent sync logs for admin dashboard */
  async getSyncLogs(limit: number = 50): Promise<DataSyncLog[]> {
    return this.syncLogRepo.find({
      order: { started_at: 'DESC' },
      take: limit,
    });
  }

  private async createLog(providerName: string): Promise<DataSyncLog> {
    return this.syncLogRepo.save(this.syncLogRepo.create({
      provider_name: providerName,
      status: 'running',
    }));
  }

  private async completeLog(id: string, status: 'success' | 'failed', count: number, error?: string): Promise<DataSyncLog> {
    await this.syncLogRepo.update(id, {
      status,
      records_synced: count,
      error_message: error || null,
      completed_at: new Date(),
    });
    const log = await this.syncLogRepo.findOne({ where: { id } });
    if (!log) throw new Error(`Log ${id} disappeared during sync`);
    if (status === 'failed') this.logger.error(`Sync ${id} failed: ${error}`);
    else this.logger.log(`Sync ${id} completed: ${count} records`);
    return log;
  }
}
