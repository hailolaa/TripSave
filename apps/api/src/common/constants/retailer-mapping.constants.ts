/**
 * Supported stores for the Flipp-based grocery aggregation.
 * Only results from these stores will be returned to the user.
 */
export const SUPPORTED_STORES: string[] = [
  'Walmart',
  'Target',
  'Aldi',
  'Costco',
  "Sam's Club",
  'Kroger',
  'Albertsons',
  'Safeway',
  'Whole Foods',
  'Whole Foods Market',
  "Trader Joe's",
  'Publix',
  'H-E-B',
  'WinCo',
  'Food Lion',
  'Meijer',
  'Sprouts',
  'Giant',
  'Stop & Shop',
  'ShopRite',
];

/**
 * Check whether a store name is in our supported list.
 * Uses case-insensitive partial matching to handle Flipp's varying store names
 * (e.g. "Walmart Supercenter" should still match "Walmart").
 */
export function isSupportedStore(storeName: string): boolean {
  if (!storeName) return false;
  const lower = storeName.toLowerCase();
  return SUPPORTED_STORES.some(s => lower.includes(s.toLowerCase()));
}
