/**
 * Defines the source of data for stores, products, and prices.
 * Centralized here to avoid circular imports between entity files.
 */
export enum DataSource {
  /** Manually entered data (seed or admin override) */
  MANUAL = 'manual',

  /** Data from Flipp multi-store aggregation */
  FLIPP = 'flipp',

  /** @deprecated GasBuddy removed — kept for backward compatibility with existing DB records. Use GOOGLE_MAPS instead. */
  GASBUDDY = 'gasbuddy',

  /** Generic external API source */
  API = 'api',

  /** Data from Oxylabs Scraping */
  OXYLABS = 'oxylabs',

  /** Specific scraper sources */
  INSTACART = 'instacart',
  DIRECT = 'direct',
  GOOGLE_MAPS = 'google_maps',
}
