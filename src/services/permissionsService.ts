import { apiClient } from './apiClient';
import type { Permission, UserPermissionOverride, DetailedPermissionKey } from '../types';

interface CreatePermissionOverrideData {
  user_id: string;
  permission_id: string;
  is_granted: boolean;
  reason?: string;
  expires_at?: string;
}

export const permissionsService = {
  async getAllPermissions(): Promise<Permission[]> {
    return apiClient.get('/permissions');
  },

  async getPermissionsByCategory(category: string): Promise<Permission[]> {
    return apiClient.get(`/permissions?category=${category}`);
  },

  async getUserPermissions(userId: string): Promise<DetailedPermissionKey[]> {
    return apiClient.get(`/users/${userId}/permissions`);
  },

  async getUserPermissionOverrides(userId: string): Promise<UserPermissionOverride[]> {
    return apiClient.get(`/users/${userId}/permission-overrides`);
  },

  async createPermissionOverride(data: CreatePermissionOverrideData): Promise<UserPermissionOverride> {
    return apiClient.post('/permissions/overrides', data);
  },

  async deletePermissionOverride(overrideId: string): Promise<void> {
    return apiClient.delete(`/permissions/overrides/${overrideId}`);
  },

  async checkPermission(userId: string, permissionKey: string): Promise<boolean> {
    const response = await apiClient.get(`/permissions/check?user_id=${userId}&permission=${permissionKey}`);
    return response.has_permission;
  },

  async checkAnyPermission(userId: string, permissionKeys: string[]): Promise<boolean> {
    const response = await apiClient.post('/permissions/check-any', {
      user_id: userId,
      permissions: permissionKeys,
    });
    return response.has_any_permission;
  },
};
