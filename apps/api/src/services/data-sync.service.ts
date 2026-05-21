import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GasSyncService } from './gas-sync.service';
import { WarmCacheService } from './warm-cache.service';
import { DataSyncLog } from '../models/data-sync-log.entity';
import { SearchActivity } from '../models/search-activity.entity';
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
    private readonly warmCacheService: WarmCacheService,
    @InjectRepository(DataSyncLog)
    private readonly syncLogRepo: Repository<DataSyncLog>,
    @InjectRepository(SearchActivity)
    private readonly searchActivityRepo: Repository<SearchActivity>,
  ) {}

  /** Refresh gas prices every 4 hours for active ZIPs */
  @Cron(CRON_SCHEDULES.GAS_REFRESH)
  async refreshGasPrices(): Promise<void> {
    const log = await this.createLog('gas');
    try {
      this.logger.log('⛽ Cron: Refreshing gas prices for active ZIPs...');
      
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const activeActivities = await this.searchActivityRepo
        .createQueryBuilder('sa')
        .select('DISTINCT sa.zip', 'zip')
        .where('sa.searched_at > :yesterday', { yesterday })
        .getRawMany();
        
      const activeZips = activeActivities.map(a => a.zip);
      
      if (activeZips.length === 0) {
        this.logger.log('No active ZIPs in the last 24h. Skipping gas sync.');
        await this.completeLog(log.id, 'success', 0);
        return;
      }

      let totalSynced = 0;
      for (const zip of activeZips) {
        this.logger.log(`Syncing gas for active ZIP: ${zip}`);
        // We sync gas prices based on region code for now, or just default to TX
        // GasSyncService expects a region code, so we can pass 'TX' or map ZIP to state
        // In a real app we'd map the ZIP to state. Here we'll just pass 'TX' for now
        // since the API is state-level. But if it was ZIP-level we'd pass zip.
        const result = await this.gasSyncService.syncGasPrices('TX'); 
        if (result.success) totalSynced += result.count;
        
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2s stagger
      }
      
      await this.completeLog(log.id, 'success', totalSynced);
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
        case 'google_maps':
        case 'gasbuddy':
        case 'gas':
          const gasResult = await this.gasSyncService.syncGasPrices(params?.regionCode || 'TX');
          count = gasResult.count;
          break;
        case 'warm-cache':
          const warmResult = await this.warmCacheService.triggerManual();
          count = warmResult.productsWarmed;
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
