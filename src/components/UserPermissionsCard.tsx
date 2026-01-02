import { useState, useEffect } from 'react';
import { User } from '../types';
import { Shield, CheckCircle2, XCircle, Loader } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';

interface UserPermissionsCardProps {
  user: User;
  onSave: () => void;
}

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

export function UserPermissionsCard({ user, onSave }: UserPermissionsCardProps) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPermissions();
  }, [user.id]);

  async function loadPermissions() {
    try {
      const [allPerms, userOverrides] = await Promise.all([
        supabase
          .from('permissions')
          .select('id, key, resource, action, name_ar, name_en')
          .eq('is_active', true)
          .order('resource')
          .order('display_order'),
        supabase
          .from('user_permission_overrides')
          .select('permission_id, is_granted')
          .eq('user_id', user.id)
          .eq('is_granted', true)
          .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      ]);

      if (allPerms.error) throw allPerms.error;

      setPermissions(allPerms.data || []);

      const grantedIds = new Set(
        (userOverrides.data || []).map(o => o.permission_id)
      );
      setSelectedPermissionIds(grantedIds);
    } catch (error) {
      console.error('Error loading permissions:', error);
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
      onSave();
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
      <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
        <div className="flex items-center justify-center h-32">
          <Loader className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
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
    <div className="bg-white rounded-xl shadow-md border-2 border-green-200">
      <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-green-600" />
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {t('permissions.custom_permissions')}
              </h3>
              <p className="text-xs text-gray-600">
                {selectedPermissionIds.size} {t('permissions.permissions_selected')}
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
          >
            {saving ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                {t('common.saving')}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                {t('common.save')}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-4 max-h-[500px] overflow-y-auto">
        <div className="space-y-3">
          {sortedResources.map(resource => {
            const resourcePerms = groupedPermissions[resource];
            const selectedCount = resourcePerms.filter(p => selectedPermissionIds.has(p.id)).length;
            const allSelected = selectedCount === resourcePerms.length;

            return (
              <div key={resource} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                <div className="bg-gray-50 p-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-800 text-sm">
                      {getResourceName(resource)}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">
                        {selectedCount}/{resourcePerms.length}
                      </span>
                      {allSelected && (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white">
                  <div className="grid grid-cols-2 gap-2">
                    {resourcePerms.map(permission => (
                      <label
                        key={permission.id}
                        className={`flex items-center gap-2 p-2 rounded border-2 cursor-pointer transition-all ${
                          selectedPermissionIds.has(permission.id)
                            ? 'border-green-400 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissionIds.has(permission.id)}
                          onChange={() => togglePermission(permission.id)}
                          className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                        />
                        <span className={`text-xs font-medium ${getActionColor(permission.action)}`}>
                          {i18n.language === 'ar' ? permission.name_ar : permission.name_en}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-3 bg-blue-50 border-t border-blue-200">
        <p className="text-xs text-blue-800">
          <strong>{t('common.note')}:</strong> {t('permissions.override_note')}
        </p>
      </div>
    </div>
  );
}
