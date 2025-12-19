/*
  # إضافة صلاحية لوحة التحكم

  1. التغييرات
    - إضافة 'dashboard' إلى قائمة الصلاحيات المسموحة في جدول user_permissions
    - تحديث CHECK constraint ليشمل الصلاحية الجديدة
  
  2. الصلاحيات المتاحة بعد التحديث
    - dashboard - لوحة التحكم
    - customers - العملاء
    - work_orders - أوامر العمل
    - invoices - الفواتير
    - inventory - المخزون
    - technicians - الفنيين
    - reports - التقارير
    - settings - الإعدادات
    - users - إدارة المستخدمين
  
  3. ملاحظات
    - الموظفين الذين لا يملكون صلاحية 'dashboard' لن يتمكنوا من رؤية لوحة التحكم
    - المدراء يمكنهم الوصول لكل شيء بشكل افتراضي
*/

-- حذف القيد القديم
ALTER TABLE user_permissions 
DROP CONSTRAINT IF EXISTS user_permissions_permission_key_check;

-- إضافة القيد الجديد مع صلاحية dashboard
ALTER TABLE user_permissions 
ADD CONSTRAINT user_permissions_permission_key_check 
CHECK (permission_key IN (
  'dashboard',
  'customers', 
  'work_orders', 
  'invoices', 
  'inventory', 
  'technicians', 
  'reports', 
  'settings', 
  'users'
));