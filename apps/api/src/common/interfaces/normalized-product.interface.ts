/**
 * Normalized product data returned by grocery providers (e.g., Flipp).
 * This is the internal contract — raw API data must be mapped to this shape
 * before entering the service layer.
 */
export interface NormalizedProduct {
  /** External product identifier from the source */
  externalId: string;

  /** Product display name as returned by the source */
  name: string;

  /** Brand name (e.g., "Great Value", "Kirkland") */
  brand: string | null;

  /** Size/weight description (e.g., "1 gal", "12 oz") */
  size: string | null;

  /** Current price in USD */
  price: number;

  /** Per-unit price if available (e.g., $0.05/oz) */
  unitPrice: number | null;

  /** Whether the item is currently in stock */
  inStock: boolean;

  /** Product image URL */
  imageUrl: string | null;

  /** Product rating (0-5 scale) */
  rating: number | null;

  /** Direct link to the product on the source */
  productUrl: string | null;

  /** Category inferred from source or normalizer */
  category: string | null;
}

/**
 * A group of products from one retailer, as returned by cross-retailer providers.
 */
export interface RetailerProductGroup {
  /** Retailer name (e.g., "Walmart", "Kroger") */
  retailerName: string;

  /** Retailer's external shop ID */
  shopId: string;

  /** Retailer latitude (optional) */
  lat?: number;

  /** Retailer longitude (optional) */
  lng?: number;

  /** Products found at this retailer */
  items: NormalizedProduct[];
}

/**
 * Complete cross-retailer search result.
 */
export interface CrossRetailerSearchResult {
  /** Original search query */
  query: string;

  /** Results grouped by retailer */
  retailers: RetailerProductGroup[];
}
