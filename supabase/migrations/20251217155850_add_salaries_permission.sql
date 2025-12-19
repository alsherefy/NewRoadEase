/*
  # إضافة صلاحية الرواتب

  ## التغييرات
    - تحديث قيد user_permissions لإضافة 'salaries' إلى قائمة الصلاحيات المسموحة

  ## الهدف
    - السماح بإنشاء صلاحيات للمستخدمين للوصول إلى قسم الرواتب
*/

ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_permission_key_check;
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_permission_key_check 
  CHECK (permission_key IN ('dashboard', 'customers', 'work_orders', 'invoices', 'inventory', 'technicians', 'reports', 'settings', 'users', 'expenses', 'salaries'));