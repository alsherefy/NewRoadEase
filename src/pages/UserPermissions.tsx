import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, CheckCircle2, Loader, ArrowLeft, Save } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import type { User } from '../types';

interface Permission {
  id: string;
  key: string;
  resource: string;
  action: string;
  name_ar: string;
  name_en: string;
}

interface GroupedPermissions {
  [resource: string]: Permission[];
}

export default function UserPermissions() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId]);

  async function loadData() {
    try {
      setLoading(true);

      const [userData, allPerms, userOverrides] = await Promise.all([
        supabase
          .from('users')
          .select(`
            *,
            user_roles (
              id,
              role:roles (
                id,
                key,
                name_ar,
                name_en
              )
            )
          `)
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('permissions')
          .select('id, key, resource, action, name_ar, name_en')
          .eq('is_active', true)
          .order('resource')
          .order('display_order'),
        supabase
          .from('user_permission_overrides')
          .select('permission_id, is_granted')
          .eq('user_id', userId!)
          .eq('is_granted', true)
          .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      ]);

      if (userData.error) throw userData.error;
      if (allPerms.error) throw allPerms.error;

      if (!userData.data) {
        toast.error(t('users.error_loading'));
        navigate('/users');
        return;
      }

      setUser(userData.data);
      setPermissions(allPerms.data || []);

      const grantedIds = new Set(
        (userOverrides.data || []).map(o => o.permission_id)
      );
      setSelectedPermissionIds(grantedIds);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error(t('permissions.error_loading'));
    } finally {
      setLoading(false);
    }
  }

  function togglePermission(permissionId: string) {
    setSelectedPermissionIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(permissionId)) {
        newSet.delete(permissionId);
      } else {
        newSet.add(permissionId);
      }
      return newSet;
    });
  }

  function groupPermissionsByResource(): GroupedPermissions {
    const grouped: GroupedPermissions = {};
    permissions.forEach(permission => {
      const resource = permission.resource || 'other';
      if (!grouped[resource]) {
        grouped[resource] = [];
      }
      grouped[resource].push(permission);
    });
    return grouped;
  }

  async function handleSave() {
    if (!user) return;

    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error('No active session');
      }

      await supabase
        .from('user_permission_overrides')
        .delete()
        .eq('user_id', user.id);

      if (selectedPermissionIds.size > 0) {
        const overridesToInsert = Array.from(selectedPermissionIds).map(permissionId => ({
          user_id: user.id,
          permission_id: permissionId,
          is_granted: true,
          granted_by: session.session.user.id,
          reason: 'Custom permission override'
        }));

        const { error } = await supabase
          .from('user_permission_overrides')
          .insert(overridesToInsert);

        if (error) throw error;
      }

      toast.success(t('permissions.success_saved'));
      navigate('/users');
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error(t('permissions.error_saving'));
    } finally {
      setSaving(false);
    }
  }

  const getResourceName = (resource: string): string => {
    const names: Record<string, { ar: string; en: string }> = {
      dashboard: { ar: 'لوحة التحكم', en: 'Dashboard' },
      customers: { ar: 'العملاء', en: 'Customers' },
      vehicles: { ar: 'المركبات', en: 'Vehicles' },
      work_orders: { ar: 'أوامر العمل', en: 'Work Orders' },
      invoices: { ar: 'الفواتير', en: 'Invoices' },
      inventory: { ar: 'المخزون', en: 'Inventory' },
      expenses: { ar: 'المصروفات', en: 'Expenses' },
      salaries: { ar: 'الرواتب', en: 'Salaries' },
      technicians: { ar: 'الفنيين', en: 'Technicians' },
      reports: { ar: 'التقارير', en: 'Reports' },
      users: { ar: 'المستخدمين', en: 'Users' },
      roles: { ar: 'الأدوار', en: 'Roles' },
      settings: { ar: 'الإعدادات', en: 'Settings' },
      audit_logs: { ar: 'سجلات المراجعة', en: 'Audit Logs' },
    };
    return i18n.language === 'ar' ? names[resource]?.ar || resource : names[resource]?.en || resource;
  };

  const getActionColor = (action: string): string => {
    const colors: Record<string, string> = {
      view: 'text-blue-600',
      create: 'text-green-600',
      update: 'text-amber-600',
      delete: 'text-red-600',
      export: 'text-purple-600',
      print: 'text-indigo-600',
      approve: 'text-teal-600',
    };
    return colors[action] || 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">{t('users.error_loading')}</p>
      </div>
    );
  }

  const groupedPermissions = groupPermissionsByResource();
  const resourceOrder = [
    'dashboard', 'customers', 'vehicles', 'work_orders', 'invoices',
    'inventory', 'expenses', 'salaries', 'technicians', 'reports',
    'users', 'roles', 'settings', 'audit_logs'
  ];

  const sortedResources = resourceOrder.filter(r => groupedPermissions[r]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/users')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('common.back')}
          </button>

          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {t('permissions.manage_permissions')}
                  </h1>
                  <p className="text-gray-600 mt-1">
                    {user.full_name} ({user.email})
                  </p>
                  <p className="text-sm text-blue-600 font-medium mt-1">
                    {selectedPermissionIds.size} {t('permissions.permissions_selected')}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 flex items-center gap-2 text-base font-semibold shadow-lg"
              >
                {saving ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    {t('common.saving')}
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {t('common.save')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>{t('common.note')}:</strong> {t('permissions.override_note')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedResources.map(resource => {
            const resourcePerms = groupedPermissions[resource];
            const selectedCount = resourcePerms.filter(p => selectedPermissionIds.has(p.id)).length;
            const allSelected = selectedCount === resourcePerms.length;

            return (
              <div key={resource} className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:shadow-xl transition-all">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 border-b-2 border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 text-base">
                      {getResourceName(resource)}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-600 bg-white px-3 py-1 rounded-full">
                        {selectedCount}/{resourcePerms.length}
                      </span>
                      {allSelected && (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  {resourcePerms.map(permission => (
                    <label
                      key={permission.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedPermissionIds.has(permission.id)
                          ? 'border-green-400 bg-green-50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPermissionIds.has(permission.id)}
                        onChange={() => togglePermission(permission.id)}
                        className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                      />
                      <span className={`text-sm font-medium flex-1 ${getActionColor(permission.action)}`}>
                        {i18n.language === 'ar' ? permission.name_ar : permission.name_en}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={() => navigate('/users')}
            className="px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 flex items-center gap-2 text-base font-semibold shadow-lg"
          >
            {saving ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                {t('common.saving')}
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                {t('common.save')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
