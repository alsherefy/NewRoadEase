import { apiClient } from './apiClient';
import type { Role, RoleWithPermissions, Permission, UserRole } from '../types';

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
    return apiClient.get('/roles');
  },

  async getRoleById(roleId: string): Promise<RoleWithPermissions> {
    return apiClient.get(`/roles/${roleId}`);
  },

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    return apiClient.get(`/roles/${roleId}/permissions`);
  },

  async createRole(data: CreateRoleData): Promise<Role> {
    return apiClient.post('/roles', data);
  },

  async updateRole(roleId: string, data: UpdateRoleData): Promise<Role> {
    return apiClient.put(`/roles/${roleId}`, data);
  },

  async deleteRole(roleId: string): Promise<void> {
    return apiClient.delete(`/roles/${roleId}`);
  },

  async updateRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    return apiClient.put(`/roles/${roleId}/permissions`, { permission_ids: permissionIds });
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
