import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usersService } from '../services';
import { supabase } from '../lib/supabase';
import { User } from '../types';
import {
  Users as UsersIcon,
  UserPlus,
  Edit,
  Trash2,
  Shield,
  ShieldAlert,
  Eye,
  EyeOff,
  Loader,
  Key,
  FileText,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import { UserPermissionsManager } from '../components/UserPermissionsManager';
import AuditLogs from './AuditLogs';

type TabType = 'users' | 'audit';

function getUserPrimaryRole(user: User): 'admin' | 'customer_service' | 'receptionist' {
  if (user.user_roles && user.user_roles.length > 0) {
    const roleKey = user.user_roles[0].role?.key;
    if (roleKey === 'admin' || roleKey === 'customer_service' || roleKey === 'receptionist') {
      return roleKey;
    }
  }
  return 'receptionist';
}

export function Users() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState<User | null>(null);
  const [passwordFormData, setPasswordFormData] = useState({
    user_id: '',
    new_password: '',
    confirm_password: '',
  });
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleFormData, setRoleFormData] = useState({
    user_id: '',
    role: 'receptionist' as 'admin' | 'customer_service' | 'receptionist',
  });

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'receptionist' as 'admin' | 'customer_service' | 'receptionist',
  });
  const [availablePermissions, setAvailablePermissions] = useState<Array<{
    id: string;
    key: string;
    resource: string;
    action: string;
    name_ar: string;
    name_en: string;
  }>>([]);
  const [selectedNewUserPermissions, setSelectedNewUserPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (isAdmin()) {
      loadUsers();
      loadAvailablePermissions();
    }
  }, []);

  async function loadAvailablePermissions() {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('id, key, resource, action, name_ar, name_en')
        .eq('is_active', true)
        .order('resource')
        .order('display_order');

      if (error) throw error;
      setAvailablePermissions(data || []);
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  }

  async function loadUsers() {
    try {
      const data = await usersService.getAllUsers();
      setUsers(data as User[]);
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
      role: 'receptionist',
    });
    setSelectedNewUserPermissions([]);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (formData.role !== 'admin' && selectedNewUserPermissions.length === 0) {
      toast.error(t('users.select_permissions_required'));
      return;
    }

    setLoading(true);

    try {
      const newUser = await usersService.createUser({
        email: formData.email,
        password: formData.password,
        name: formData.full_name,
        role: formData.role,
      });

      if (formData.role !== 'admin' && selectedNewUserPermissions.length > 0) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          const overridesToInsert = selectedNewUserPermissions.map(permissionId => ({
            user_id: newUser.id,
            permission_id: permissionId,
            is_granted: true,
            granted_by: sessionData.session.user.id,
            reason: 'Initial permissions on user creation'
          }));

          const { error } = await supabase
            .from('user_permission_overrides')
            .insert(overridesToInsert);

          if (error) throw error;
        }
      }

      toast.success(t('users.success_created'));
      await loadUsers();
      setShowModal(false);
      setFormData({
        email: '',
        password: '',
        full_name: '',
        role: 'receptionist',
      });
      setSelectedNewUserPermissions([]);
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
      await usersService.deleteUser(userId);
      await loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(t('users.error_delete'));
    }
  }

  async function toggleUserStatus(userId: string, currentStatus: boolean) {
    try {
      await usersService.updateUser(userId, { is_active: !currentStatus });
      await loadUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
    }
  }

  function openPermissionsModal(user: User) {
    setPermissionsUser(user);
    setShowPermissionsModal(true);
  }

  function closePermissionsModal() {
    setPermissionsUser(null);
    setShowPermissionsModal(false);
  }

  async function handlePermissionsSaved() {
    await loadUsers();
    closePermissionsModal();
  }

  function openPasswordModal(user: User) {
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

  function openRoleModal(user: User) {
    setSelectedUser(user);
    setRoleFormData({
      user_id: user.id,
      role: getUserPrimaryRole(user),
    });
    setShowRoleModal(true);
  }

  async function handleRoleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await usersService.updateUser(roleFormData.user_id, { role: roleFormData.role });

      toast.success(t('users.success_role_updated'));
      await loadUsers();
      setShowRoleModal(false);
      setRoleFormData({
        user_id: '',
        role: 'receptionist',
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

  const tabs = [
    { id: 'users' as TabType, label: t('nav.users'), icon: UsersIcon },
    { id: 'audit' as TabType, label: t('nav.auditLogs'), icon: FileText },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return renderUsersTab();
      case 'audit':
        return <AuditLogs />;
      default:
        return renderUsersTab();
    }
  };

  const renderUsersTab = () => {
    if (loading && users.length === 0) {
      return (
        <div className="flex items-center justify-center h-64">
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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {users.map((user) => (
            <div key={user.id} className="bg-white rounded-xl shadow-md p-6 border-2 border-transparent hover:border-blue-500 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-full p-3 ${
                      getUserPrimaryRole(user) === 'admin'
                        ? 'bg-gradient-to-br from-orange-500 to-orange-600'
                        : 'bg-gradient-to-br from-blue-500 to-blue-600'
                    }`}
                  >
                    {getUserPrimaryRole(user) === 'admin' ? (
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
                      getUserPrimaryRole(user) === 'admin'
                        ? 'text-orange-600'
                        : getUserPrimaryRole(user) === 'customer_service'
                        ? 'text-green-600'
                        : 'text-blue-600'
                    }`}
                  >
                    {getUserPrimaryRole(user) === 'admin'
                      ? t('roles.admin.name')
                      : getUserPrimaryRole(user) === 'customer_service'
                      ? t('roles.customer_service.name')
                      : t('roles.receptionist.name')}
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

              {(getUserPrimaryRole(user) === 'customer_service' || getUserPrimaryRole(user) === 'receptionist') && (
                <button
                  onClick={() => openPermissionsModal(user)}
                  className="w-full mb-3 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all flex items-center justify-center gap-2"
                >
                  <Shield className="h-4 w-4" />
                  {t('users.manage_permissions')}
                </button>
              )}

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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 my-8">
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
                    onChange={(e) => {
                      const newRole = e.target.value as 'admin' | 'customer_service' | 'receptionist';
                      setFormData({
                        ...formData,
                        role: newRole,
                      });
                      if (newRole === 'admin') {
                        setSelectedNewUserPermissions([]);
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="admin">{t('roles.admin.name')}</option>
                    <option value="customer_service">{t('roles.customer_service.name')}</option>
                    <option value="receptionist">{t('roles.receptionist.name')}</option>
                  </select>
                  {formData.role === 'admin' && (
                    <p className="text-xs text-orange-600 mt-1 font-medium">
                      {t('users.admin_all_permissions')}
                    </p>
                  )}
                </div>

                {formData.role !== 'admin' && (
                  <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      <Shield className="inline h-4 w-4 ml-1" />
                      {t('users.select_permissions')} ({selectedNewUserPermissions.length})
                    </label>
                    <div className="max-h-80 overflow-y-auto space-y-2">
                      {(() => {
                        const grouped: Record<string, typeof availablePermissions> = {};
                        availablePermissions.forEach(p => {
                          if (!grouped[p.resource]) grouped[p.resource] = [];
                          grouped[p.resource].push(p);
                        });
                        return Object.entries(grouped).map(([resource, perms]) => (
                          <div key={resource} className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-sm text-gray-800">
                                {resource === 'dashboard' ? 'لوحة التحكم' :
                                 resource === 'customers' ? 'العملاء' :
                                 resource === 'vehicles' ? 'المركبات' :
                                 resource === 'work_orders' ? 'أوامر العمل' :
                                 resource === 'invoices' ? 'الفواتير' :
                                 resource === 'inventory' ? 'المخزون' :
                                 resource === 'expenses' ? 'المصروفات' :
                                 resource === 'salaries' ? 'الرواتب' :
                                 resource === 'technicians' ? 'الفنيين' :
                                 resource === 'reports' ? 'التقارير' :
                                 resource === 'users' ? 'المستخدمين' :
                                 resource === 'roles' ? 'الأدوار' :
                                 resource === 'settings' ? 'الإعدادات' :
                                 resource === 'audit_logs' ? 'سجلات المراجعة' : resource}
                              </h4>
                              <button
                                type="button"
                                onClick={() => {
                                  const allSelected = perms.every(p => selectedNewUserPermissions.includes(p.id));
                                  if (allSelected) {
                                    setSelectedNewUserPermissions(prev => prev.filter(id => !perms.map(p => p.id).includes(id)));
                                  } else {
                                    setSelectedNewUserPermissions(prev => [...new Set([...prev, ...perms.map(p => p.id)])]);
                                  }
                                }}
                                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                {perms.every(p => selectedNewUserPermissions.includes(p.id)) ? 'إلغاء الكل' : 'تحديد الكل'}
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {perms.map(perm => (
                                <label key={perm.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                                  <input
                                    type="checkbox"
                                    checked={selectedNewUserPermissions.includes(perm.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedNewUserPermissions(prev => [...prev, perm.id]);
                                      } else {
                                        setSelectedNewUserPermissions(prev => prev.filter(id => id !== perm.id));
                                      }
                                    }}
                                    className="w-4 h-4 text-blue-600 rounded"
                                  />
                                  <span className="text-gray-700">{perm.name_ar}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

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
                        role: e.target.value as 'admin' | 'customer_service' | 'receptionist',
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="admin">{t('roles.admin.name')}</option>
                    <option value="customer_service">{t('roles.customer_service.name')}</option>
                    <option value="receptionist">{t('roles.receptionist.name')}</option>
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

        {showPermissionsModal && permissionsUser && (
          <UserPermissionsManager
            user={permissionsUser}
            onClose={closePermissionsModal}
            onSave={handlePermissionsSaved}
          />
        )}

        {ConfirmDialogComponent}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>{renderTabContent()}</div>
    </div>
  );
}
