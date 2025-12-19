import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { User, UserPermission, PermissionKey } from '../types';
import {
  Users as UsersIcon,
  UserPlus,
  Edit,
  Trash2,
  Check,
  X,
  Shield,
  ShieldAlert,
  Eye,
  EyeOff,
  Loader,
  AlertCircle,
  Key,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';

interface UserWithPerms extends User {
  permissions?: UserPermission[];
}

export function Users() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [users, setUsers] = useState<UserWithPerms[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithPerms | null>(null);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithPerms | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordFormData, setPasswordFormData] = useState({
    user_id: '',
    new_password: '',
    confirm_password: '',
  });
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleFormData, setRoleFormData] = useState({
    user_id: '',
    role: 'employee' as 'admin' | 'employee' | 'customer_service',
  });

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'employee' as 'admin' | 'employee' | 'customer_service',
  });

  const PERMISSION_LABELS: Record<PermissionKey, string> = {
    dashboard: t('permissions.dashboard'),
    customers: t('permissions.customers'),
    work_orders: t('permissions.work_orders'),
    invoices: t('permissions.invoices'),
    inventory: t('permissions.inventory'),
    technicians: t('permissions.technicians'),
    reports: t('permissions.reports'),
    settings: t('permissions.settings'),
    users: t('permissions.users'),
  };

  const [permissionsData, setPermissionsData] = useState<
    Record<PermissionKey, { can_view: boolean; can_edit: boolean }>
  >({
    dashboard: { can_view: false, can_edit: false },
    customers: { can_view: false, can_edit: false },
    work_orders: { can_view: false, can_edit: false },
    invoices: { can_view: false, can_edit: false },
    inventory: { can_view: false, can_edit: false },
    technicians: { can_view: false, can_edit: false },
    reports: { can_view: false, can_edit: false },
    settings: { can_view: false, can_edit: false },
    users: { can_view: false, can_edit: false },
  });

  useEffect(() => {
    if (isAdmin()) {
      loadUsers();
    }
  }, []);

  async function loadUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          permissions:user_permissions(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      full_name: '',
      role: 'employee',
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error(t('users.error_unauthorized'));
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: formData.role,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || t('users.error_create'));
      }

      await loadUsers();
      setShowModal(false);
      setFormData({
        email: '',
        password: '',
        full_name: '',
        role: 'employee',
      });
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || t('users.error_create'));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(userId: string) {
    const confirmed = await confirm({
      title: t('users.confirm_delete_title'),
      message: t('users.confirm_delete'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      isDangerous: true,
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);

      if (error) throw error;
      await loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(t('users.error_delete'));
    }
  }

  async function toggleUserStatus(userId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;
      await loadUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
    }
  }

  function openPermissionsModal(user: UserWithPerms) {
    setSelectedUser(user);

    const perms: Record<PermissionKey, { can_view: boolean; can_edit: boolean }> = {
      dashboard: { can_view: false, can_edit: false },
      customers: { can_view: false, can_edit: false },
      work_orders: { can_view: false, can_edit: false },
      invoices: { can_view: false, can_edit: false },
      inventory: { can_view: false, can_edit: false },
      technicians: { can_view: false, can_edit: false },
      reports: { can_view: false, can_edit: false },
      settings: { can_view: false, can_edit: false },
      users: { can_view: false, can_edit: false },
    };

    user.permissions?.forEach((p) => {
      perms[p.permission_key] = {
        can_view: p.can_view,
        can_edit: p.can_edit,
      };
    });

    setPermissionsData(perms);
    setShowPermissionsModal(true);
  }

  async function savePermissions() {
    if (!selectedUser) return;
    setLoading(true);

    try {
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', selectedUser.id);

      const permissionsToInsert = Object.entries(permissionsData)
        .filter(([_, value]) => value.can_view || value.can_edit)
        .map(([key, value]) => ({
          user_id: selectedUser.id,
          permission_key: key as PermissionKey,
          can_view: value.can_view,
          can_edit: value.can_edit,
        }));

      if (permissionsToInsert.length > 0) {
        const { error } = await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);

        if (error) throw error;
      }

      await loadUsers();
      setShowPermissionsModal(false);
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error(t('users.error_save_permissions'));
    } finally {
      setLoading(false);
    }
  }

  function openPasswordModal(user: UserWithPerms) {
    setSelectedUser(user);
    setPasswordFormData({
      user_id: user.id,
      new_password: '',
      confirm_password: '',
    });
    setShowPasswordModal(true);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();

    if (passwordFormData.new_password !== passwordFormData.confirm_password) {
      toast.error(t('validation.password_mismatch'));
      return;
    }

    if (passwordFormData.new_password.length < 6) {
      toast.error(t('validation.password_min_length'));
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error(t('users.error_unauthorized'));
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/change-password`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: passwordFormData.user_id,
          new_password: passwordFormData.new_password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || t('users.error_password_change'));
      }

      toast.success(t('users.success_password_changed'));
      setShowPasswordModal(false);
      setPasswordFormData({
        user_id: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || t('users.error_password_change'));
    } finally {
      setLoading(false);
    }
  }

  function openRoleModal(user: UserWithPerms) {
    setSelectedUser(user);
    setRoleFormData({
      user_id: user.id,
      role: user.role,
    });
    setShowRoleModal(true);
  }

  async function handleRoleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('users')
        .update({ role: roleFormData.role })
        .eq('id', roleFormData.user_id);

      if (error) throw error;

      toast.success(t('users.success_role_updated'));
      await loadUsers();
      setShowRoleModal(false);
      setRoleFormData({
        user_id: '',
        role: 'employee',
      });
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(t('users.error_update_role'));
    } finally {
      setLoading(false);
    }
  }

  if (!isAdmin()) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {t('users.unauthorized')}
          </h2>
          <p className="text-gray-600">
            {t('users.unauthorized_message')}
          </p>
        </div>
      </div>
    );
  }

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="h-12 w-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-800">{t('users.title')}</h2>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="h-5 w-5" />
          {t('users.add_user')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user) => (
          <div
            key={user.id}
            className="bg-white rounded-xl shadow-md p-6 border-2 border-transparent hover:border-blue-500 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-full p-3 ${
                    user.role === 'admin'
                      ? 'bg-gradient-to-br from-orange-500 to-orange-600'
                      : 'bg-gradient-to-br from-blue-500 to-blue-600'
                  }`}
                >
                  {user.role === 'admin' ? (
                    <Shield className="h-6 w-6 text-white" />
                  ) : (
                    <UsersIcon className="h-6 w-6 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{user.full_name}</h3>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>
              </div>
              <button
                onClick={() => toggleUserStatus(user.id, user.is_active)}
                className={`p-2 rounded-lg transition-colors ${
                  user.is_active
                    ? 'bg-green-100 text-green-600 hover:bg-green-200'
                    : 'bg-red-100 text-red-600 hover:bg-red-200'
                }`}
              >
                {user.is_active ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">{t('users.role')}</span>
                <span
                  className={`text-sm font-bold ${
                    user.role === 'admin'
                      ? 'text-orange-600'
                      : user.role === 'customer_service'
                      ? 'text-green-600'
                      : 'text-blue-600'
                  }`}
                >
                  {user.role === 'admin'
                    ? t('roles.admin')
                    : user.role === 'customer_service'
                    ? t('roles.customer_service')
                    : t('roles.employee')}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">{t('users.status')}</span>
                <span
                  className={`text-sm font-bold ${
                    user.is_active ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {user.is_active ? t('users.active') : t('users.inactive')}
                </span>
              </div>
            </div>

            {(user.role === 'employee' || user.role === 'customer_service') && (
              <button
                onClick={() => openPermissionsModal(user)}
                className="w-full mb-3 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all flex items-center justify-center gap-2"
              >
                <Shield className="h-4 w-4" />
                {t('users.manage_permissions')}
              </button>
            )}

            <button
              onClick={() => openPasswordModal(user)}
              className="w-full mb-3 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-lg hover:from-amber-700 hover:to-amber-800 transition-all flex items-center justify-center gap-2"
            >
              <Key className="h-4 w-4" />
              {t('users.change_password')}
            </button>

            <button
              onClick={() => openRoleModal(user)}
              className="w-full mb-3 px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg hover:from-teal-700 hover:to-teal-800 transition-all flex items-center justify-center gap-2"
            >
              <Edit className="h-4 w-4" />
              {t('users.edit_role')}
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => handleDelete(user.id)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {t('common.delete')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              {t('users.add_user')}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('users.name')}
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('users.email')}
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('users.password')}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                  minLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  dir="ltr"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('validation.password_min_length')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('users.role')}
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as 'admin' | 'employee' | 'customer_service',
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="employee">{t('roles.employee')}</option>
                  <option value="customer_service">{t('roles.customer_service')}</option>
                  <option value="admin">{t('roles.admin')}</option>
                </select>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPermissionsModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 my-8">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="h-8 w-8 text-blue-600" />
              <div>
                <h3 className="text-2xl font-bold text-gray-800">
                  {t('users.manage_permissions_for')} {selectedUser.full_name}
                </h3>
                <p className="text-sm text-gray-600">{selectedUser.email}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                <div
                  key={key}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-gray-800">{label}</span>
                  </div>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissionsData[key as PermissionKey].can_view}
                        onChange={(e) =>
                          setPermissionsData({
                            ...permissionsData,
                            [key]: {
                              ...permissionsData[key as PermissionKey],
                              can_view: e.target.checked,
                            },
                          })
                        }
                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{t('permissions.view')}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissionsData[key as PermissionKey].can_edit}
                        onChange={(e) =>
                          setPermissionsData({
                            ...permissionsData,
                            [key]: {
                              ...permissionsData[key as PermissionKey],
                              can_edit: e.target.checked,
                            },
                          })
                        }
                        className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700">{t('permissions.edit')}</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={savePermissions}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? t('common.saving') : t('users.save_permissions')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <Key className="h-8 w-8 text-amber-600" />
              <div>
                <h3 className="text-2xl font-bold text-gray-800">
                  {t('users.change_password')}
                </h3>
                <p className="text-sm text-gray-600">
                  {selectedUser.full_name} - {selectedUser.email}
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('users.new_password')}
                </label>
                <input
                  type="password"
                  value={passwordFormData.new_password}
                  onChange={(e) =>
                    setPasswordFormData({
                      ...passwordFormData,
                      new_password: e.target.value,
                    })
                  }
                  required
                  minLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  dir="ltr"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('validation.password_min_length')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('users.confirm_password')}
                </label>
                <input
                  type="password"
                  value={passwordFormData.confirm_password}
                  onChange={(e) =>
                    setPasswordFormData({
                      ...passwordFormData,
                      confirm_password: e.target.value,
                    })
                  }
                  required
                  minLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  dir="ltr"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {loading ? t('common.saving') : t('users.change_password')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <Edit className="h-8 w-8 text-teal-600" />
              <div>
                <h3 className="text-2xl font-bold text-gray-800">
                  {t('users.edit_role')}
                </h3>
                <p className="text-sm text-gray-600">
                  {selectedUser.full_name} - {selectedUser.email}
                </p>
              </div>
            </div>

            <form onSubmit={handleRoleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('users.new_role')}
                </label>
                <select
                  value={roleFormData.role}
                  onChange={(e) =>
                    setRoleFormData({
                      ...roleFormData,
                      role: e.target.value as 'admin' | 'employee' | 'customer_service',
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="employee">{t('roles.employee')}</option>
                  <option value="customer_service">{t('roles.customer_service')}</option>
                  <option value="admin">{t('roles.admin')}</option>
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>{t('users.note')}:</strong> {t('users.role_change_warning')}
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  {loading ? t('common.saving') : t('users.update_role')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {ConfirmDialogComponent}
    </div>
  );
}
