/**
 * Cache TTL (Time-To-Live) constants in milliseconds.
 * Data older than these thresholds is considered stale
 * and will be refreshed by the cron scheduler.
 */
export const CACHE_TTL = {
  /** Gas prices: refresh every 6 hours */
  GAS_PRICES_MS: 6 * 60 * 60 * 1000,

  /** Grocery prices: refresh every 12 hours */
  GROCERY_PRICES_MS: 12 * 60 * 60 * 1000,

  /** Store info: refresh every 24 hours */
  STORE_INFO_MS: 24 * 60 * 60 * 1000,
} as const;

/**
 * Cron expressions for background data refresh jobs.
 */
export const CRON_SCHEDULES = {
  /** Every 6 hours: 0 */
  GAS_REFRESH: '0 */6 * * *',

  /** Every 12 hours */
  GROCERY_REFRESH: '0 */12 * * *',

  /** Once daily at 3 AM */
  STORE_REFRESH: '0 3 * * *',

  /** Every 45 minutes — keeps popular product cache warm */
  WARM_CACHE_REFRESH: '*/45 * * * *',
} as const;
