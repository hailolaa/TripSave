import { DataSource } from '../enums/data-source.enum';

/**
 * Base interface for all external data providers.
 * Every provider (gas, grocery, etc.) must implement this contract.
 *
 * The generic type T represents the normalized data format
 * that the provider returns — never raw external API structures.
 */
export interface IDataProvider<T> {
  /** Human-readable provider name for logging and sync logs */
  readonly name: string;

  /** Which DataSource this provider represents */
  readonly source: DataSource;

  /**
   * Fetch data from the external source.
   * @param params - Provider-specific query parameters
   * @returns Normalized data array. Returns empty array on failure (never throws).
   */
  fetch(params: Record<string, any>): Promise<T[]>;

  /**
   * Check if the provider is currently available (API key set, service reachable, etc.)
   */
  isAvailable(): Promise<boolean>;
}
