/*
  # إضافة نظام المستخدمين والصلاحيات

  ## الجداول الجديدة
  
  1. `users` - جدول المستخدمين
     - `id` (uuid) - المعرف الفريد، مرتبط بـ auth.users
     - `email` (text) - البريد الإلكتروني
     - `full_name` (text) - الاسم الكامل
     - `role` (text) - الدور: 'admin' أو 'employee'
     - `is_active` (boolean) - حالة المستخدم
     - `created_at` (timestamptz) - تاريخ الإنشاء
     - `updated_at` (timestamptz) - تاريخ آخر تحديث
  
  2. `user_permissions` - جدول صلاحيات المستخدمين
     - `id` (uuid) - المعرف الفريد
     - `user_id` (uuid) - معرف المستخدم
     - `permission_key` (text) - مفتاح الصلاحية
     - `can_view` (boolean) - صلاحية العرض
     - `can_edit` (boolean) - صلاحية التعديل
     - `created_at` (timestamptz) - تاريخ الإنشاء

  ## الصلاحيات المتاحة
  
  - customers - العملاء
  - work_orders - أوامر العمل
  - invoices - الفواتير
  - inventory - المخزون
  - technicians - الفنيين
  - reports - التقارير
  - settings - الإعدادات
  - users - إدارة المستخدمين (المدير فقط)

  ## الأمان
  
  - تفعيل RLS على جميع الجداول
  - المدير يمكنه الوصول لكل شيء
  - الموظف يمكنه الوصول فقط حسب الصلاحيات المعطاة له
*/

-- إنشاء جدول المستخدمين
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'employee')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- إنشاء جدول الصلاحيات
CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  permission_key text NOT NULL CHECK (permission_key IN (
    'customers', 
    'work_orders', 
    'invoices', 
    'inventory', 
    'technicians', 
    'reports', 
    'settings', 
    'users'
  )),
  can_view boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, permission_key)
);

-- إضافة فهرس للأداء
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- دالة للحصول على دور المستخدم الحالي
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

-- دالة للتحقق من صلاحية المستخدم
CREATE OR REPLACE FUNCTION check_user_permission(
  p_permission_key text,
  p_requires_edit boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    LEFT JOIN user_permissions up ON u.id = up.user_id AND up.permission_key = p_permission_key
    WHERE u.id = auth.uid()
      AND u.is_active = true
      AND (
        u.role = 'admin' OR
        (up.can_view = true AND (NOT p_requires_edit OR up.can_edit = true))
      )
  );
$$;

-- دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إضافة trigger لتحديث updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- تفعيل RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان لجدول users
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admins can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (get_current_user_role() = 'admin');

-- سياسات الأمان لجدول user_permissions
CREATE POLICY "Users can view own permissions"
  ON user_permissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Admins can insert permissions"
  ON user_permissions FOR INSERT
  TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admins can update permissions"
  ON user_permissions FOR UPDATE
  TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete permissions"
  ON user_permissions FOR DELETE
  TO authenticated
  USING (get_current_user_role() = 'admin');

-- إنشاء مستخدم مدير افتراضي (سيتم تفعيله عند أول تسجيل)
-- هذا سيتم إضافته يدوياً من خلال واجهة التطبيق
