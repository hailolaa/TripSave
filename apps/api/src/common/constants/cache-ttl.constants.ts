/**
 * Cache TTL (Time-To-Live) constants in milliseconds.
 * Data older than these thresholds is considered stale
 * and will be refreshed by the cron scheduler.
 *
 * Strategy: Scrape once, cache long, refresh on schedule.
 * Grocery prices barely change daily. Gas changes more often.
 */
export const CACHE_TTL = {
  /** Gas prices: refresh every 4 hours */
  GAS_PRICES_MS: 4 * 60 * 60 * 1000,

  /** Grocery prices: refresh every 24 hours */
  GROCERY_PRICES_MS: 24 * 60 * 60 * 1000,

  /** Pharmacy prices: refresh every 48 hours (very stable) */
  PHARMACY_PRICES_MS: 48 * 60 * 60 * 1000,

  /** Store info: refresh every 24 hours */
  STORE_INFO_MS: 24 * 60 * 60 * 1000,
} as const;

/**
 * Cron expressions for background data refresh jobs.
 * All scraping happens on schedule, never in response to user requests.
 */
export const CRON_SCHEDULES = {
  /** Gas prices: every 4 hours */
  GAS_REFRESH: '0 */4 * * *',

  /** Grocery + pharmacy: daily at 2 AM (off-peak) */
  GROCERY_REFRESH: '0 2 * * *',

  /** Store info: once daily at 3 AM */
  STORE_REFRESH: '0 3 * * *',
} as const;
