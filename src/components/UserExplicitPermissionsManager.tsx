import { useState, useEffect } from 'react';
import { User } from '../types';
import { X, Save, CheckSquare, Shield, Loader } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { translatePermission } from '../utils/translationHelpers';

interface UserExplicitPermissionsManagerProps {
  user: User;
  onClose: () => void;
  onSave: () => void;
}

interface Permission {
  id: string;
  key: string;
  resource: string;
  action: string;
  category: string;
  display_order: number;
  is_active: boolean;
}

export function UserExplicitPermissionsManager({ user, onClose, onSave }: UserExplicitPermissionsManagerProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPermissions();
  }, [user.id]);

  async function loadPermissions() {
    try {
      setLoading(true);

      const [allPermsResult, userPermsResult] = await Promise.all([
        supabase
          .from('permissions')
          .select('*')
          .eq('is_active', true)
          .order('resource')
          .order('display_order'),
        supabase
          .from('user_permission_overrides')
          .select('permission_id')
          .eq('user_id', user.id)
          .eq('is_granted', true)
      ]);

      if (allPermsResult.error) throw allPermsResult.error;
      if (userPermsResult.error) throw userPermsResult.error;

      setPermissions(allPermsResult.data || []);

      const selectedIds = new Set(
        (userPermsResult.data || []).map((item: any) => item.permission_id)
      );
      setSelectedPermissions(selectedIds);

    } catch (error) {
      console.error('Error loading permissions:', error);
      toast.error(t('permissions.error_loading'));
    } finally {
      setLoading(false);
    }
  }

  function togglePermission(permissionId: string) {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);
    }
    setSelectedPermissions(newSelected);
  }

  function toggleAllResourcePermissions(resourcePermissions: Permission[], allSelected: boolean) {
    const newSelected = new Set(selectedPermissions);
    resourcePermissions.forEach(perm => {
      if (allSelected) {
        newSelected.delete(perm.id);
      } else {
        newSelected.add(perm.id);
      }
    });
    setSelectedPermissions(newSelected);
  }

  function groupPermissionsByResource() {
    const grouped: Record<string, Permission[]> = {};
    permissions.forEach(permission => {
      const resource = permission.resource || 'other';
      if (!grouped[resource]) {
        grouped[resource] = [];
      }
      grouped[resource].push(permission);
    });
    return grouped;
  }

  function countSelectedInResource(resourcePermissions: Permission[]) {
    let selected = 0;
    resourcePermissions.forEach(p => {
      if (selectedPermissions.has(p.id)) selected++;
    });
    return selected;
  }

  function getResourceDisplayName(resource: string): string {
    const resourceNameMap: Record<string, string> = {
      dashboard: t('nav.dashboard'),
      customers: t('nav.customers'),
      vehicles: t('nav.vehicles') || 'Vehicles',
      work_orders: t('nav.work_orders'),
      invoices: t('nav.invoices'),
      inventory: t('nav.inventory'),
      expenses: t('nav.expenses'),
      salaries: t('nav.salaries') || 'Salaries',
      technicians: t('nav.technicians'),
      reports: t('nav.reports'),
      users: t('nav.users'),
      roles: t('nav.rolesManagement') || 'Roles',
      settings: t('nav.settings'),
      audit_logs: t('nav.auditLogs'),
    };
    return resourceNameMap[resource] || resource;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error('No active session');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/users/${user.id}/permissions`;

      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          permission_ids: Array.from(selectedPermissions)
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to update permissions');
      }

      toast.success(t('permissions.success_saved'));
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error(t('permissions.error_saving'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full">
          <div className="flex items-center justify-center gap-3">
            <Loader className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-gray-700">{t('common.loading')}</span>
          </div>
        </div>
      </div>
    );
  }

  const groupedPermissions = groupPermissionsByResource();
  const sortedResources = Object.keys(groupedPermissions).sort((a, b) => {
    const orderMap: Record<string, number> = {
      dashboard: 1,
      customers: 2,
      vehicles: 3,
      work_orders: 4,
      invoices: 5,
      inventory: 6,
      expenses: 7,
      salaries: 8,
      technicians: 9,
      reports: 10,
      users: 11,
      roles: 12,
      settings: 13,
      audit_logs: 14,
    };
    return (orderMap[a] || 999) - (orderMap[b] || 999);
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {t('permissions.manage_user_permissions')}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {user.full_name} - {user.email}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">{t('permissions.explicit_permissions_note')}</p>
                <p className="mt-1">{t('permissions.explicit_permissions_description')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-240px)]">
          <div className="space-y-4">
            {sortedResources.map((resource) => {
              const resourcePermissions = groupedPermissions[resource];
              const selectedCount = countSelectedInResource(resourcePermissions);
              const allSelected = selectedCount === resourcePermissions.length;

              return (
                <div
                  key={resource}
                  className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">
                          {getResourceDisplayName(resource)}
                        </h3>
                        <p className="text-xs text-gray-600 mt-1">
                          {selectedCount} / {resourcePermissions.length} {t('permissions.selected')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleAllResourcePermissions(resourcePermissions, allSelected)}
                        className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        {allSelected ? t('permissions.deselect_all') : t('permissions.select_all')}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {resourcePermissions
                        .sort((a, b) => a.display_order - b.display_order)
                        .map((permission) => {
                          const isSelected = selectedPermissions.has(permission.id);

                          return (
                            <div
                              key={permission.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-green-50 border-green-500 shadow-sm'
                                  : 'bg-white border-gray-200 hover:border-gray-300'
                              }`}
                              onClick={() => togglePermission(permission.id)}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm font-medium ${
                                  isSelected ? 'text-gray-800' : 'text-gray-600'
                                }`}>
                                  {translatePermission(permission.key, t)}
                                </div>
                              </div>
                              {isSelected && (
                                <CheckSquare className="w-5 h-5 flex-shrink-0 text-green-600" />
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex gap-3 justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{selectedPermissions.size}</span> {t('permissions.permissions_selected')}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all flex items-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <Save className="w-4 h-4" />
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
