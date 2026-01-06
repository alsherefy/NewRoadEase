import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User, UserPermission, PermissionKey, UserRole, DetailedPermissionKey } from '../types';
import { permissionCacheUtils } from '../utils/permissionCache';

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  permissions: UserPermission[];
  userRoles: UserRole[];
  computedPermissions: string[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasPermission: (key: PermissionKey | DetailedPermissionKey, requireEdit?: boolean) => boolean;
  hasDetailedPermission: (key: DetailedPermissionKey) => boolean;
  hasAnyPermission: (keys: (PermissionKey | DetailedPermissionKey)[]) => boolean;
  hasRole: (roleKey: string) => boolean;
  isAdmin: () => boolean;
  isCustomerServiceOrAdmin: () => boolean;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [computedPermissions, setComputedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setUser(null);
        setPermissions([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserData(userId: string) {
    try {
      const cachedPerms = permissionCacheUtils.get(userId);
      if (cachedPerms) {
        setComputedPermissions(cachedPerms);
      }

      // OPTIMIZED: Single RPC call instead of 3 separate queries (67% reduction)
      const { data: permData, error: permError } = await supabase
        .rpc('get_my_permissions')
        .maybeSingle();

      if (permError) throw permError;

      if (permData) {
        // Set user data from permissions result
        setUser({
          id: permData.user_id,
          organization_id: permData.organization_id,
          is_active: permData.is_active,
          email: '',
          full_name: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Set roles (convert array to UserRole format for compatibility)
        const roles: UserRole[] = (permData.roles || []).map((roleKey: string) => ({
          user_id: permData.user_id,
          role_id: roleKey,
          role: {
            key: roleKey,
            is_active: true,
          },
        }));
        setUserRoles(roles);

        // Set permissions
        const permissionKeys = permData.permissions || [];
        setComputedPermissions(permissionKeys);
        permissionCacheUtils.set(userId, permissionKeys);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function refreshPermissions() {
    if (user?.id) {
      await loadUserData(user.id);
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        await loadUserData(data.user.id);
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    permissionCacheUtils.clear();
    setUser(null);
    setSupabaseUser(null);
    setPermissions([]);
    setUserRoles([]);
    setComputedPermissions([]);
  }

  function hasRole(roleKey: string): boolean {
    if (!user) return false;
    return userRoles.some(ur => ur.role?.key === roleKey && ur.role?.is_active);
  }

  function isAdmin(): boolean {
    return hasRole('admin');
  }

  function hasPermission(key: PermissionKey | DetailedPermissionKey, requireEdit = false): boolean {
    if (!user) return false;
    if (isAdmin()) return true;

    if (key.includes('.')) {
      return computedPermissions.includes(key);
    }

    const viewKey = `${key}.view`;
    const hasViewPerm = computedPermissions.includes(viewKey);

    if (requireEdit) {
      const editKeys = [`${key}.create`, `${key}.update`, `${key}.delete`];
      return hasViewPerm && editKeys.some(k => computedPermissions.includes(k));
    }

    return hasViewPerm;
  }

  function hasDetailedPermission(key: DetailedPermissionKey): boolean {
    if (!user) return false;
    if (isAdmin()) return true;
    return computedPermissions.includes(key);
  }

  function hasAnyPermission(keys: (PermissionKey | DetailedPermissionKey)[]): boolean {
    if (!user) return false;
    if (isAdmin()) return true;
    return keys.some(key => hasPermission(key));
  }

  function isCustomerServiceOrAdmin(): boolean {
    return hasRole('admin') || hasRole('customer_service') || hasRole('receptionist');
  }

  const value = {
    user,
    supabaseUser,
    permissions,
    userRoles,
    computedPermissions,
    loading,
    signIn,
    signOut,
    hasPermission,
    hasDetailedPermission,
    hasAnyPermission,
    hasRole,
    isAdmin,
    isCustomerServiceOrAdmin,
    refreshPermissions,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
