import { useState, useEffect } from 'react';
import { User, UserPermission, PermissionKey } from '../types';
import { Shield, Check, X, Save } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';

interface UserPermissionsManagerProps {
  user: User;
  onClose: () => void;
  onSave: () => void;
}

interface PermissionState {
  key: PermissionKey;
  can_view: boolean;
  can_edit: boolean;
}

export function UserPermissionsManager({ user, onClose, onSave }: UserPermissionsManagerProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<PermissionState[]>([]);

  const availablePermissions: { key: PermissionKey; label: string }[] = [
    { key: 'dashboard', label: t('permissions.dashboard') },
    { key: 'customers', label: t('permissions.customers') },
    { key: 'work_orders', label: t('permissions.work_orders') },
    { key: 'invoices', label: t('permissions.invoices') },
    { key: 'inventory', label: t('permissions.inventory') },
    { key: 'expenses', label: t('permissions.expenses') },
    { key: 'salaries', label: t('permissions.salaries') },
    { key: 'technicians', label: t('permissions.technicians') },
    { key: 'reports', label: t('permissions.reports') },
    { key: 'users', label: t('permissions.users') },
  ];

  useEffect(() => {
    loadPermissions();
  }, [user.id]);

  async function loadPermissions() {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      const existingPermissions = new Map(
        data?.map(p => [p.permission_key, { can_view: p.can_view, can_edit: p.can_edit }]) || []
      );

      const allPermissions = availablePermissions.map(p => ({
        key: p.key,
        can_view: existingPermissions.get(p.key)?.can_view || false,
        can_edit: existingPermissions.get(p.key)?.can_edit || false,
      }));

      setPermissions(allPermissions);
    } catch (error) {
      console.error('Error loading permissions:', error);
      toast.error(t('permissions.error_loading'));
    } finally {
      setLoading(false);
    }
  }

  function toggleView(key: PermissionKey) {
    setPermissions(prev =>
      prev.map(p =>
        p.key === key
          ? { ...p, can_view: !p.can_view, can_edit: !p.can_view ? false : p.can_edit }
          : p
      )
    );
  }

  function toggleEdit(key: PermissionKey) {
    setPermissions(prev =>
      prev.map(p =>
        p.key === key
          ? { ...p, can_edit: !p.can_edit, can_view: !p.can_edit ? true : p.can_view }
          : p
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', user.id);

      const permissionsToInsert = permissions
        .filter(p => p.can_view || p.can_edit)
        .map(p => ({
          user_id: user.id,
          permission_key: p.key,
          can_view: p.can_view,
          can_edit: p.can_edit,
        }));

      if (permissionsToInsert.length > 0) {
        const { error } = await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);

        if (error) throw error;
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3 space-x-reverse">
            <Shield className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                {t('permissions.manage_permissions')}
              </h2>
              <p className="text-sm text-gray-600">{user.full_name} ({user.email})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            {t('permissions.role_info')}: <span className="font-semibold">{t(`roles.${user.role}`)}</span>
          </p>
          <p className="text-xs text-blue-600 mt-1">
            {t('permissions.custom_override_info')}
          </p>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-4 pb-2 border-b border-gray-200">
            <div className="text-sm font-semibold text-gray-700">{t('permissions.permission')}</div>
            <div className="text-sm font-semibold text-gray-700 text-center">{t('permissions.can_view')}</div>
            <div className="text-sm font-semibold text-gray-700 text-center">{t('permissions.can_edit')}</div>
          </div>

          {availablePermissions.map(perm => {
            const state = permissions.find(p => p.key === perm.key);
            return (
              <div key={perm.key} className="grid grid-cols-3 gap-4 py-3 border-b border-gray-100 hover:bg-gray-50">
                <div className="text-sm text-gray-800">{perm.label}</div>
                <div className="flex justify-center">
                  <button
                    onClick={() => toggleView(perm.key)}
                    className={`p-2 rounded-lg transition-colors ${
                      state?.can_view
                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {state?.can_view ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                  </button>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => toggleEdit(perm.key)}
                    className={`p-2 rounded-lg transition-colors ${
                      state?.can_edit
                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {state?.can_edit ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center space-x-2 space-x-reverse bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className="h-5 w-5" />
            <span>{saving ? t('common.saving') : t('common.save')}</span>
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
