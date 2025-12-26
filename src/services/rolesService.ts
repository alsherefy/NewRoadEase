import { apiClient } from './apiClient';
import type { Role, RoleWithPermissions, Permission, UserRole } from '../types';
import { cache, CacheKeys, CacheTTL } from '../utils/cacheUtils';

interface CreateRoleData {
  name: string;
  name_en: string;
  key: string;
  description?: string;
  permission_ids?: string[];
}

interface UpdateRoleData {
  name?: string;
  name_en?: string;
  description?: string;
  is_active?: boolean;
}

interface AssignRoleData {
  user_id: string;
  role_id: string;
}

export const rolesService = {
  async getAllRoles(): Promise<Role[]> {
    return cache.fetchWithCache(
      CacheKeys.ROLES_LIST,
      () => apiClient.get<Role[]>('/roles'),
      CacheTTL.MEDIUM
    );
  },

  async getRoleById(roleId: string): Promise<RoleWithPermissions> {
    return apiClient.get(`/roles/${roleId}`);
  },

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    return apiClient.get(`/roles/${roleId}/permissions`);
  },

  async createRole(data: CreateRoleData): Promise<Role> {
    const result = await apiClient.post<Role>('/roles', data);
    cache.remove(CacheKeys.ROLES_LIST);
    return result;
  },

  async updateRole(roleId: string, data: UpdateRoleData): Promise<Role> {
    const result = await apiClient.put<Role>(`/roles/${roleId}`, data);
    cache.remove(CacheKeys.ROLES_LIST);
    return result;
  },

  async deleteRole(roleId: string): Promise<void> {
    await apiClient.delete(`/roles/${roleId}`);
    cache.remove(CacheKeys.ROLES_LIST);
  },

  async updateRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    await apiClient.put(`/roles/${roleId}/permissions`, { permission_ids: permissionIds });
    cache.remove(CacheKeys.ROLES_LIST);
    cache.remove(CacheKeys.PERMISSIONS_LIST);
  },

  async assignRoleToUser(data: AssignRoleData): Promise<UserRole> {
    return apiClient.post('/roles/assign', data);
  },

  async removeRoleFromUser(userRoleId: string): Promise<void> {
    return apiClient.delete(`/roles/assignments/${userRoleId}`);
  },

  async getUserRoles(userId: string): Promise<UserRole[]> {
    return apiClient.get(`/users/${userId}/roles`);
  },

  async getRoleUsers(roleId: string): Promise<string[]> {
    return apiClient.get(`/roles/${roleId}/users`);
  },
};
