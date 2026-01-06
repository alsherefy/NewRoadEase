interface CachedPermissions {
  permissions: Set<string>;
  timestamp: number;
  userId: string;
}

const CACHE_TTL = 5 * 60 * 1000;
let permissionCache: CachedPermissions | null = null;

export const permissionCacheUtils = {
  set: (userId: string, permissions: string[]) => {
    permissionCache = {
      userId,
      permissions: new Set(permissions),
      timestamp: Date.now(),
    };

    try {
      sessionStorage.setItem('permission_cache', JSON.stringify({
        userId,
        permissions,
        timestamp: permissionCache.timestamp,
      }));
    } catch (error) {
      console.warn('Failed to cache permissions in sessionStorage:', error);
    }
  },

  get: (userId: string): string[] | null => {
    if (permissionCache && permissionCache.userId === userId) {
      const age = Date.now() - permissionCache.timestamp;
      if (age < CACHE_TTL) {
        return Array.from(permissionCache.permissions);
      }
    }

    try {
      const cached = sessionStorage.getItem('permission_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.userId === userId) {
          const age = Date.now() - parsed.timestamp;
          if (age < CACHE_TTL) {
            permissionCache = {
              userId: parsed.userId,
              permissions: new Set(parsed.permissions),
              timestamp: parsed.timestamp,
            };
            return parsed.permissions;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to retrieve cached permissions:', error);
    }

    return null;
  },

  clear: () => {
    permissionCache = null;
    try {
      sessionStorage.removeItem('permission_cache');
    } catch (error) {
      console.warn('Failed to clear permission cache:', error);
    }
  },

  has: (userId: string, permission: string): boolean | null => {
    if (permissionCache && permissionCache.userId === userId) {
      const age = Date.now() - permissionCache.timestamp;
      if (age < CACHE_TTL) {
        return permissionCache.permissions.has(permission);
      }
    }
    return null;
  },
};
