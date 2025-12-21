/**
 * Translation Helper Utilities
 *
 * This module provides helper functions to translate system data (roles, permissions)
 * from database keys to localized text using the i18n system.
 */

import { TFunction } from 'i18next';

/**
 * Role keys from the database
 */
export type RoleKey = 'admin' | 'customer_service' | 'receptionist';

/**
 * Get translated role name
 * @param roleKey - The role key from database (admin, customer_service, receptionist)
 * @param t - Translation function from useTranslation hook
 * @returns Translated role name
 */
export function translateRole(roleKey: RoleKey, t: TFunction): string {
  return t(`roles.${roleKey}.name`);
}

/**
 * Get translated role description
 * @param roleKey - The role key from database
 * @param t - Translation function from useTranslation hook
 * @returns Translated role description
 */
export function translateRoleDescription(roleKey: RoleKey, t: TFunction): string {
  return t(`roles.${roleKey}.description`);
}

/**
 * Get translated permission name
 * @param permissionKey - The permission key from database (e.g., "customers.view")
 * @param t - Translation function from useTranslation hook
 * @returns Translated permission name
 */
export function translatePermission(permissionKey: string, t: TFunction): string {
  return t(`permissions.details.${permissionKey}.name`);
}

/**
 * Get translated permission description
 * @param permissionKey - The permission key from database (e.g., "customers.view")
 * @param t - Translation function from useTranslation hook
 * @returns Translated permission description
 */
export function translatePermissionDescription(permissionKey: string, t: TFunction): string {
  return t(`permissions.details.${permissionKey}.description`);
}

/**
 * Get role color class for UI styling
 * @param roleKey - The role key from database
 * @returns Tailwind CSS color class
 */
export function getRoleColor(roleKey: RoleKey): string {
  const colorMap: Record<RoleKey, string> = {
    admin: 'text-orange-600',
    customer_service: 'text-green-600',
    receptionist: 'text-blue-600',
  };
  return colorMap[roleKey] || 'text-gray-600';
}

/**
 * Get role background color class for UI styling
 * @param roleKey - The role key from database
 * @returns Tailwind CSS background color class
 */
export function getRoleBgColor(roleKey: RoleKey): string {
  const colorMap: Record<RoleKey, string> = {
    admin: 'bg-orange-100',
    customer_service: 'bg-green-100',
    receptionist: 'bg-blue-100',
  };
  return colorMap[roleKey] || 'bg-gray-100';
}

/**
 * Get role gradient class for UI styling
 * @param roleKey - The role key from database
 * @returns Tailwind CSS gradient class
 */
export function getRoleGradient(roleKey: RoleKey): string {
  const gradientMap: Record<RoleKey, string> = {
    admin: 'from-orange-500 to-orange-600',
    customer_service: 'from-green-500 to-green-600',
    receptionist: 'from-blue-500 to-blue-600',
  };
  return gradientMap[roleKey] || 'from-gray-500 to-gray-600';
}

/**
 * Check if permission exists in translation files
 * @param permissionKey - The permission key to check
 * @param t - Translation function from useTranslation hook
 * @returns true if permission translation exists
 */
export function hasPermissionTranslation(permissionKey: string, t: TFunction): boolean {
  try {
    const translation = t(`permissions.details.${permissionKey}.name`);
    return !translation.includes('permissions.details.');
  } catch {
    return false;
  }
}

/**
 * Parse permission key into resource and action
 * @param permissionKey - The permission key (e.g., "customers.view")
 * @returns Object with resource and action
 */
export function parsePermissionKey(permissionKey: string): { resource: string; action: string } {
  const [resource, action] = permissionKey.split('.');
  return { resource: resource || '', action: action || '' };
}
