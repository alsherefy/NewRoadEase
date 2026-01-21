interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface AuthContextData {
  user_id: string;
  email: string;
  full_name: string;
  organization_id: string;
  is_active: boolean;
  roles: string[];
  permissions: string[];
}

class AuthCache {
  private cache: Map<string, CacheEntry<AuthContextData>>;
  private ttl: number;

  constructor(ttlMinutes: number = 5) {
    this.cache = new Map();
    this.ttl = ttlMinutes * 60 * 1000;
  }

  get(token: string): AuthContextData | null {
    const entry = this.cache.get(token);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(token);
      return null;
    }

    return entry.data;
  }

  set(token: string, data: AuthContextData): void {
    this.cache.set(token, {
      data,
      timestamp: Date.now()
    });
  }

  invalidate(token: string): void {
    this.cache.delete(token);
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [token, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(token);
      }
    }
  }
}

const authCache = new AuthCache(5);

setInterval(() => {
  authCache.cleanup();
}, 60000);

export { authCache, type AuthContextData };