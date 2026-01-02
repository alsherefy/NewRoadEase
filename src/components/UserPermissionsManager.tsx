import { useState, useEffect } from 'react';
import { User } from '../types';
import { X, Save, CheckSquare, Square, MinusSquare } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { translatePermission } from '../utils/translationHelpers';

interface UserPermissionsManagerProps {
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

export function UserPermissionsManager({ user, onClose, onSave }: UserPermissionsManagerProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);

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
      setSelectedPermissionIds(
        (userPermsResult.data || []).map(p => p.permission_id)
      );
    } catch (error) {
      console.error('Error loading permissions:', error);
      toast.error(t('permissions.error_loading'));
    } finally {
      setLoading(false);
    }
  }

  function togglePermission(permissionId: string) {
    setSelectedPermissionIds(prev =>
      prev.includes(permissionId)
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    );
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

  function isResourceFullySelected(resourcePermissions: Permission[]): boolean {
    return resourcePermissions.length > 0 &&
      resourcePermissions.every(p => selectedPermissionIds.includes(p.id));
  }

  function isResourcePartiallySelected(resourcePermissions: Permission[]): boolean {
    const selectedCount = resourcePermissions.filter(p =>
      selectedPermissionIds.includes(p.id)
    ).length;
    return selectedCount > 0 && selectedCount < resourcePermissions.length;
  }

  function toggleAllResourcePermissions(resourcePermissions: Permission[]) {
    const allSelected = isResourceFullySelected(resourcePermissions);
    const permissionIds = resourcePermissions.map(p => p.id);

    if (allSelected) {
      setSelectedPermissionIds(prev =>
        prev.filter(id => !permissionIds.includes(id))
      );
    } else {
      setSelectedPermissionIds(prev => {
        const newIds = [...prev];
        permissionIds.forEach(id => {
          if (!newIds.includes(id)) {
            newIds.push(id);
          }
        });
        return newIds;
      });
    }
  }

  function getResourceDisplayName(resource: string): string {
    const resourceNameMap: Record<string, string> = {
      dashboard: t('nav.dashboard'),
      customers: t('nav.customers'),
      vehicles: t('nav.vehicles'),
      work_orders: t('nav.work_orders'),
      invoices: t('nav.invoices'),
      inventory: t('nav.inventory'),
      expenses: t('nav.expenses'),
      salaries: t('nav.salaries'),
      technicians: t('nav.technicians'),
      reports: t('nav.reports'),
      users: t('nav.users'),
      roles: t('nav.roles'),
      settings: t('nav.settings'),
      audit_logs: t('nav.audit_logs'),
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

      const { error: deleteError } = await supabase
        .from('user_permission_overrides')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      if (selectedPermissionIds.length > 0) {
        const permissionsToInsert = selectedPermissionIds.map(permissionId => ({
          user_id: user.id,
          permission_id: permissionId,
          is_granted: true,
          granted_by: session.session.user.id
        }));

        const { error: insertError } = await supabase
          .from('user_permission_overrides')
          .insert(permissionsToInsert);

        if (insertError) throw insertError;
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
          <div className="text-center">{t('common.loading')}</div>
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
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {t('permissions.manage_permissions')}
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

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="space-y-4">
            {sortedResources.map((resource) => {
              const resourcePermissions = groupedPermissions[resource];
              const isFullySelected = isResourceFullySelected(resourcePermissions);
              const isPartiallySelected = isResourcePartiallySelected(resourcePermissions);
              const selectedCount = resourcePermissions.filter(p =>
                selectedPermissionIds.includes(p.id)
              ).length;

              return (
                <div
                  key={resource}
                  className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  <div
                    onClick={() => toggleAllResourcePermissions(resourcePermissions)}
                    className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 cursor-pointer hover:from-green-100 hover:to-emerald-100 transition-all border-b border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      {isFullySelected ? (
                        <CheckSquare className="w-6 h-6 text-green-600" />
                      ) : isPartiallySelected ? (
                        <MinusSquare className="w-6 h-6 text-green-500" />
                      ) : (
                        <Square className="w-6 h-6 text-gray-400" />
                      )}
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">
                          {getResourceDisplayName(resource)}
                        </h3>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {selectedCount} / {resourcePermissions.length} {t('permissions.selected')}
                        </p>
                      </div>
                      {isFullySelected && (
                        <div className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-full">
                          {t('common.all')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {resourcePermissions
                        .sort((a, b) => a.display_order - b.display_order)
                        .map((permission) => {
                          const isGranted = selectedPermissionIds.includes(permission.id);
                          return (
                            <label
                              key={permission.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                isGranted
                                  ? 'bg-green-50 border-green-500 shadow-md'
                                  : 'bg-white border-gray-200 hover:border-green-300 hover:shadow-sm'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isGranted}
                                onChange={() => togglePermission(permission.id)}
                                className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                              />
                              <div className="flex-1">
                                <div className={`text-sm font-medium ${
                                  isGranted ? 'text-green-800' : 'text-gray-700'
                                }`}>
                                  {translatePermission(permission.key, t)}
                                </div>
                              </div>
                              {isGranted && (
                                <CheckSquare className="w-5 h-5 text-green-600 flex-shrink-0" />
                              )}
                            </label>
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
              <span className="font-semibold text-gray-900">{selectedPermissionIds.length}</span> {t('permissions.selected')}
            </div>
            <div className="text-xs text-gray-500">
              {t('permissions.out_of')} {permissions.length} {t('permissions.permissions')}
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
