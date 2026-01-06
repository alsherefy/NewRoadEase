import { ForbiddenError } from "./types.ts";
import { AuthContext } from "./middleware/authWithPermissions.ts";

const PERMISSION_TRANSLATIONS: Record<string, { ar: string; en: string }> = {
  'dashboard.view': { ar: 'عرض لوحة التحكم', en: 'view dashboard' },
  'customers.view': { ar: 'عرض العملاء', en: 'view customers' },
  'customers.create': { ar: 'إضافة عملاء', en: 'create customers' },
  'customers.update': { ar: 'تعديل العملاء', en: 'update customers' },
  'customers.delete': { ar: 'حذف العملاء', en: 'delete customers' },
  'work_orders.view': { ar: 'عرض أوامر العمل', en: 'view work orders' },
  'work_orders.create': { ar: 'إنشاء أوامر عمل', en: 'create work orders' },
  'work_orders.update': { ar: 'تعديل أوامر العمل', en: 'update work orders' },
  'work_orders.delete': { ar: 'حذف أوامر العمل', en: 'delete work orders' },
  'invoices.view': { ar: 'عرض الفواتير', en: 'view invoices' },
  'invoices.create': { ar: 'إنشاء فواتير', en: 'create invoices' },
  'invoices.update': { ar: 'تعديل الفواتير', en: 'update invoices' },
  'invoices.delete': { ar: 'حذف الفواتير', en: 'delete invoices' },
  'inventory.view': { ar: 'عرض المخزون', en: 'view inventory' },
  'inventory.create': { ar: 'إضافة للمخزون', en: 'add to inventory' },
  'inventory.update': { ar: 'تعديل المخزون', en: 'update inventory' },
  'inventory.delete': { ar: 'حذف من المخزون', en: 'delete from inventory' },
  'expenses.view': { ar: 'عرض المصروفات', en: 'view expenses' },
  'expenses.create': { ar: 'إضافة مصروفات', en: 'create expenses' },
  'expenses.update': { ar: 'تعديل المصروفات', en: 'update expenses' },
  'expenses.delete': { ar: 'حذف المصروفات', en: 'delete expenses' },
  'salaries.view': { ar: 'عرض الرواتب', en: 'view salaries' },
  'salaries.create': { ar: 'إضافة رواتب', en: 'create salaries' },
  'salaries.update': { ar: 'تعديل الرواتب', en: 'update salaries' },
  'salaries.delete': { ar: 'حذف الرواتب', en: 'delete salaries' },
  'technicians.view': { ar: 'عرض الفنيين', en: 'view technicians' },
  'technicians.create': { ar: 'إضافة فنيين', en: 'create technicians' },
  'technicians.update': { ar: 'تعديل الفنيين', en: 'update technicians' },
  'technicians.delete': { ar: 'حذف الفنيين', en: 'delete technicians' },
  'reports.view': { ar: 'عرض التقارير', en: 'view reports' },
  'settings.view': { ar: 'عرض الإعدادات', en: 'view settings' },
  'settings.update': { ar: 'تعديل الإعدادات', en: 'update settings' },
  'users.view': { ar: 'عرض المستخدمين', en: 'view users' },
  'users.create': { ar: 'إضافة مستخدمين', en: 'create users' },
  'users.update': { ar: 'تعديل المستخدمين', en: 'update users' },
  'users.delete': { ar: 'حذف المستخدمين', en: 'delete users' },
};

export function hasPermission(auth: AuthContext, permissionKey: string): boolean {
  if (auth.isAdmin) {
    return true;
  }

  return auth.permissions.includes(permissionKey);
}

export function requirePermission(auth: AuthContext, permissionKey: string): void {
  if (!hasPermission(auth, permissionKey)) {
    const translation = PERMISSION_TRANSLATIONS[permissionKey] || {
      ar: permissionKey,
      en: permissionKey,
    };

    throw new ForbiddenError(
      `ليس لديك صلاحية ${translation.ar} - You do not have permission to ${translation.en}`
    );
  }
}

export function hasAnyPermission(auth: AuthContext, permissionKeys: string[]): boolean {
  if (auth.isAdmin) {
    return true;
  }

  return permissionKeys.some((key) => auth.permissions.includes(key));
}

export function hasAllPermissions(auth: AuthContext, permissionKeys: string[]): boolean {
  if (auth.isAdmin) {
    return true;
  }

  return permissionKeys.every((key) => auth.permissions.includes(key));
}

export function requireAnyPermission(auth: AuthContext, permissionKeys: string[]): void {
  if (!hasAnyPermission(auth, permissionKeys)) {
    throw new ForbiddenError(
      'ليس لديك الصلاحيات المطلوبة - You do not have the required permissions'
    );
  }
}

export function requireAllPermissions(auth: AuthContext, permissionKeys: string[]): void {
  if (!hasAllPermissions(auth, permissionKeys)) {
    throw new ForbiddenError(
      'ليس لديك جميع الصلاحيات المطلوبة - You do not have all required permissions'
    );
  }
}