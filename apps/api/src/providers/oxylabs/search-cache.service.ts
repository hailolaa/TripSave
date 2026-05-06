import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Simple in-memory cache with TTL support.
 * Keyed by query+zip, with 1-hour default TTL.
 */
@Injectable()
export class SearchCacheService {
  private readonly logger = new Logger(SearchCacheService.name);
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

  /** Build a cache key from query + zip */
  makeKey(query: string, zip: string): string {
    return `${query.toLowerCase().trim()}:${zip}`;
  }

  /** Get cached data, or null if missing/expired */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.logger.debug(`Cache expired: ${key}`);
      return null;
    }

    this.logger.debug(`Cache hit: ${key}`);
    return entry.data as T;
  }

  /** Store data with TTL */
  set<T>(key: string, data: T, ttlMs: number = this.DEFAULT_TTL_MS): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
    this.logger.debug(`Cache set: ${key} (TTL: ${ttlMs / 1000}s)`);
  }

  /** Clear the entire cache */
  clear(): void {
    this.cache.clear();
    this.logger.log('Cache cleared');
  }

  /** Get cache stats */
  stats(): { size: number; keys: string[] } {
    return { size: this.cache.size, keys: Array.from(this.cache.keys()) };
  }
}
