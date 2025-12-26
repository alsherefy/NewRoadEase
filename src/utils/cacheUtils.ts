/**
 * Frontend Caching Utilities
 *
 * Provides localStorage-based caching with TTL (Time To Live) for static/rarely changing data.
 * Reduces API calls for data that doesn't change frequently.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds (default: 5 minutes)
  key: string;
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Cache Manager Class
 * Handles all caching operations with automatic expiration
 */
class CacheManager {
  private prefix = 'workshop_cache_';

  /**
   * Generate a cache key with prefix
   */
  private getCacheKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Set data in cache with TTL
   */
  set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    try {
      const now = Date.now();
      const entry: CacheEntry<T> = {
        data,
        timestamp: now,
        expiresAt: now + ttl,
      };

      localStorage.setItem(this.getCacheKey(key), JSON.stringify(entry));
    } catch (error) {
      console.error('Cache set error:', error);
      // Fail silently - caching is not critical
    }
  }

  /**
   * Get data from cache if not expired
   */
  get<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(this.getCacheKey(key));
      if (!cached) return null;

      const entry: CacheEntry<T> = JSON.parse(cached);
      const now = Date.now();

      // Check if expired
      if (now > entry.expiresAt) {
        this.remove(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('Cache get error:', error);
      this.remove(key);
      return null;
    }
  }

  /**
   * Remove specific item from cache
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(this.getCacheKey(key));
    } catch (error) {
      console.error('Cache remove error:', error);
    }
  }

  /**
   * Clear all workshop cache entries
   */
  clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache info (timestamp, time until expiration)
   */
  getInfo(key: string): { timestamp: number; expiresIn: number } | null {
    try {
      const cached = localStorage.getItem(this.getCacheKey(key));
      if (!cached) return null;

      const entry: CacheEntry<unknown> = JSON.parse(cached);
      const now = Date.now();

      return {
        timestamp: entry.timestamp,
        expiresIn: Math.max(0, entry.expiresAt - now),
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if cache entry exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Fetch data with caching
   * If cached and valid, return cached data
   * Otherwise, fetch fresh data and cache it
   */
  async fetchWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = DEFAULT_TTL
  ): Promise<T> {
    // Check cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const data = await fetcher();

    // Cache the result
    this.set(key, data, ttl);

    return data;
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(pattern: string): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(this.prefix) && key.includes(pattern)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Cache invalidate pattern error:', error);
    }
  }

  /**
   * Get cache size in bytes (approximate)
   */
  getSize(): number {
    try {
      let totalSize = 0;
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(this.prefix)) {
          const item = localStorage.getItem(key);
          if (item) {
            totalSize += item.length + key.length;
          }
        }
      });
      return totalSize;
    } catch (error) {
      return 0;
    }
  }
}

// Export singleton instance
export const cache = new CacheManager();

/**
 * Cache TTL presets for different data types
 */
export const CacheTTL = {
  SHORT: 1 * 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 15 * 60 * 1000, // 15 minutes
  VERY_LONG: 60 * 60 * 1000, // 1 hour
} as const;

/**
 * Cache key patterns for different data types
 */
export const CacheKeys = {
  WORKSHOP_SETTINGS: 'workshop_settings',
  TECHNICIANS_LIST: 'technicians_list',
  PERMISSIONS_LIST: 'permissions_list',
  ROLES_LIST: 'roles_list',
  USER_PERMISSIONS: (userId: string) => `user_permissions_${userId}`,
  USER_PROFILE: (userId: string) => `user_profile_${userId}`,
} as const;

/**
 * Higher-order function to wrap API calls with caching
 */
export function withCache<T>(
  cacheKey: string,
  ttl: number = DEFAULT_TTL
) {
  return async (fetcher: () => Promise<T>): Promise<T> => {
    return cache.fetchWithCache(cacheKey, fetcher, ttl);
  };
}

/**
 * React Hook for using cached data
 * This is a utility that can be used with React's useEffect
 */
export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL
) {
  return {
    getCached: () => cache.get<T>(key),
    fetch: async () => cache.fetchWithCache(key, fetcher, ttl),
    invalidate: () => cache.remove(key),
    hasCache: () => cache.has(key),
  };
}
