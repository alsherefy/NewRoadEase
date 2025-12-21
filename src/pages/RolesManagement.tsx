import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Plus, Edit2, Trash2, Users, Lock, Settings as SettingsIcon, Save, X } from 'lucide-react';
import { rolesService } from '../services/rolesService';
import { permissionsService } from '../services/permissionsService';
import { translateRole, getRoleColor, getRoleBgColor, translatePermission } from '../utils/translationHelpers';
import type { Role, Permission } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';

interface RoleWithDetails extends Role {
  userCount?: number;
  permissionsCount?: number;
}

export default function RolesManagement() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [roles, setRoles] = useState<RoleWithDetails[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);

  const [newRoleKey, setNewRoleKey] = useState('');
  const [editingIsActive, setEditingIsActive] = useState(true);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rolesData, permissionsData] = await Promise.all([
        rolesService.getAllRoles(),
        permissionsService.getAllPermissions()
      ]);

      const rolesWithDetails = await Promise.all(
        rolesData.map(async (role) => {
          try {
            const [users, rolePermissions] = await Promise.all([
              rolesService.getRoleUsers(role.id),
              rolesService.getRolePermissions(role.id)
            ]);
            return {
              ...role,
              userCount: users.length,
              permissionsCount: rolePermissions.length
            };
          } catch {
            return {
              ...role,
              userCount: 0,
              permissionsCount: 0
            };
          }
        })
      );

      setRoles(rolesWithDetails);
      setPermissions(permissionsData);
    } catch (error) {
      showToast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setEditingIsActive(role.is_active);
    setShowEditModal(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedRole) return;

    try {
      await rolesService.updateRole(selectedRole.id, {
        is_active: editingIsActive
      });

      showToast(t('admin.roles.roleUpdated'), 'success');
      setShowEditModal(false);
      loadData();
    } catch (error) {
      showToast(t('common.error'), 'error');
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (role.is_system_role) {
      showToast(t('admin.roles.cannotDeleteSystemRole'), 'error');
      return;
    }

    const confirmed = await confirm(
      t('admin.roles.deleteRoleConfirm', { role: translateRole(role.key as any, t) })
    );

    if (confirmed) {
      try {
        await rolesService.deleteRole(role.id);
        showToast(t('admin.roles.roleDeleted'), 'success');
        loadData();
      } catch (error) {
        showToast(t('common.error'), 'error');
      }
    }
  };

  const handleManagePermissions = async (role: Role) => {
    try {
      setSelectedRole(role);
      const rolePermissions = await rolesService.getRolePermissions(role.id);
      setSelectedPermissionIds(rolePermissions.map(p => p.id));
      setShowPermissionsModal(true);
    } catch (error) {
      showToast(t('common.error'), 'error');
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;

    try {
      await rolesService.updateRolePermissions(selectedRole.id, selectedPermissionIds);
      showToast(t('admin.roles.permissionsUpdated'), 'success');
      setShowPermissionsModal(false);
      loadData();
    } catch (error) {
      showToast(t('common.error'), 'error');
    }
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissionIds(prev =>
      prev.includes(permissionId)
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const groupPermissionsByCategory = () => {
    const grouped: Record<string, Permission[]> = {};
    permissions.forEach(permission => {
      const category = permission.category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(permission);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 rounded-xl shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t('admin.roles.title')}</h1>
              <p className="text-gray-600 mt-1">{t('admin.roles.subtitle')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((role) => (
          <div key={role.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-200">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${getRoleBgColor(role.key as any)}`}>
                    <Shield className={`w-6 h-6 ${getRoleColor(role.key as any)}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {translateRole(role.key as any, t)}
                    </h3>
                    {role.is_system_role && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {t('admin.roles.systemRole')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditRole(role)}
                    className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {!role.is_system_role && (
                    <button
                      onClick={() => handleDeleteRole(role)}
                      className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t('admin.roles.usersCount')}
                  </span>
                  <span className="font-semibold text-gray-900">{role.userCount || 0}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    {t('admin.roles.permissionsCount')}
                  </span>
                  <span className="font-semibold text-gray-900">{role.permissionsCount || 0}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t('admin.roles.status')}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    role.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {role.is_active ? t('admin.roles.active') : t('admin.roles.inactive')}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleManagePermissions(role)}
                className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all flex items-center justify-center gap-2"
              >
                <SettingsIcon className="w-4 h-4" />
                {t('admin.roles.managePermissions')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showEditModal && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {t('admin.roles.editRole')}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.roles.roleName')}
                </label>
                <input
                  type="text"
                  value={translateRole(selectedRole.key as any, t)}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingIsActive}
                    onChange={(e) => setEditingIsActive(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {t('admin.roles.activeRole')}
                  </span>
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleUpdateRole}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPermissionsModal && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {t('admin.roles.managePermissions')}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {translateRole(selectedRole.key as any, t)}
                </p>
              </div>
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="space-y-6">
                {Object.entries(groupPermissionsByCategory()).map(([category, perms]) => (
                  <div key={category} className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">
                      {t(`permissions.categories.${category}`)}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {perms
                        .sort((a, b) => a.display_order - b.display_order)
                        .map((permission) => (
                          <label
                            key={permission.id}
                            className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-orange-300 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPermissionIds.includes(permission.id)}
                              onChange={() => togglePermission(permission.id)}
                              className="mt-1 w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">
                                {translatePermission(permission.key, t)}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {permission.key}
                              </div>
                            </div>
                          </label>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-between">
              <div className="text-sm text-gray-600">
                {t('admin.roles.selectedPermissions')}: <span className="font-semibold">{selectedPermissionIds.length}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPermissionsModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSavePermissions}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
