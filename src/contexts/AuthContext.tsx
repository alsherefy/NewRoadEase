import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User, UserPermission, PermissionKey } from '../types';

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  permissions: UserPermission[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasPermission: (key: PermissionKey, requireEdit?: boolean) => boolean;
  isAdmin: () => boolean;
  isCustomerServiceOrAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
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
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (userError) throw userError;

      if (userData) {
        setUser(userData);

        if (userData.role === 'customer_service' || userData.role === 'receptionist') {
          const { data: permsData } = await supabase
            .from('user_permissions')
            .select('*')
            .eq('user_id', userId);

          setPermissions(permsData || []);
        } else {
          setPermissions([]);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
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
    setUser(null);
    setSupabaseUser(null);
    setPermissions([]);
  }

  function hasPermission(key: PermissionKey, requireEdit = false): boolean {
    if (!user) return false;
    if (user.role === 'admin') return true;

    if (user.role === 'customer_service') {
      const allowedPermissions: PermissionKey[] = ['customers', 'work_orders', 'invoices', 'inventory', 'dashboard'];
      if (allowedPermissions.includes(key)) {
        return true;
      }
    }

    if (user.role === 'receptionist') {
      const viewPermissions: PermissionKey[] = ['customers', 'work_orders', 'dashboard'];
      const editPermissions: PermissionKey[] = ['customers'];

      if (requireEdit) {
        return editPermissions.includes(key);
      }
      return viewPermissions.includes(key);
    }

    const permission = permissions.find(p => p.permission_key === key);
    if (!permission) return false;

    if (requireEdit) {
      return permission.can_view && permission.can_edit;
    }

    return permission.can_view;
  }

  function isAdmin(): boolean {
    return user?.role === 'admin';
  }

  function isCustomerServiceOrAdmin(): boolean {
    return user?.role === 'admin' || user?.role === 'customer_service' || user?.role === 'receptionist';
  }

  const value = {
    user,
    supabaseUser,
    permissions,
    loading,
    signIn,
    signOut,
    hasPermission,
    isAdmin,
    isCustomerServiceOrAdmin,
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
