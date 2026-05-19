/**
 * Cache TTL (Time-To-Live) constants in milliseconds.
 * Data older than these thresholds is considered stale
 * and will be refreshed by the cron scheduler.
 */
export const CACHE_TTL = {
  /** Gas prices: refresh every 6 hours */
  GAS_PRICES_MS: 6 * 60 * 60 * 1000,

  /** Grocery prices: refresh every 3 days (72 hours) */
  GROCERY_PRICES_MS: 3 * 24 * 60 * 60 * 1000,

  /** Store info: refresh every 24 hours */
  STORE_INFO_MS: 24 * 60 * 60 * 1000,
} as const;

/**
 * Cron expressions for background data refresh jobs.
 */
export const CRON_SCHEDULES = {
  /** Disabled: Gas is now synced strictly on-demand. Running once a year to satisfy cron validation without API load. */
  GAS_REFRESH: '0 0 1 1 *', // Jan 1st at midnight

  /** Every 3 days */
  GROCERY_REFRESH: '0 2 */3 * *',

  /** Once daily at 3 AM */
  STORE_REFRESH: '0 3 * * *',

  /** Once every 3 days at 4 AM to minimize API calls */
  WARM_CACHE_REFRESH: '0 4 */3 * *',
} as const;
