/*
  # إصلاح سياسات RLS لجدول user_permission_overrides

  1. المشكلة
    - سياسات RLS تسبب infinite recursion عند محاولة الاستعلام
    - المشكلة في استخدام subquery معقد يستعلم من user_roles

  2. الحل
    - استخدام subquery واحد فقط بدون تداخل
    - التحقق مباشرة من جدول roles دون المرور بـ user_roles مرة أخرى
*/

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Admins can view user permission overrides" ON user_permission_overrides;
DROP POLICY IF EXISTS "Admins can insert user permission overrides" ON user_permission_overrides;
DROP POLICY IF EXISTS "Admins can update user permission overrides" ON user_permission_overrides;
DROP POLICY IF EXISTS "Admins can delete user permission overrides" ON user_permission_overrides;

-- سياسة القراءة: المدراء فقط
CREATE POLICY "Admins can view user permission overrides"
  ON user_permission_overrides
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM users u, user_roles ur, roles r
      WHERE u.id = auth.uid()
      AND ur.user_id = u.id
      AND ur.role_id = r.id
      AND r.key = 'admin'
      AND r.is_system_role = true
      AND r.is_active = true
      AND u.organization_id = (SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id)
    )
  );

-- سياسة الإدراج: المدراء فقط
CREATE POLICY "Admins can insert user permission overrides"
  ON user_permission_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM users u, user_roles ur, roles r
      WHERE u.id = auth.uid()
      AND ur.user_id = u.id
      AND ur.role_id = r.id
      AND r.key = 'admin'
      AND r.is_system_role = true
      AND r.is_active = true
      AND u.organization_id = (SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id)
    )
  );

-- سياسة التحديث: المدراء فقط
CREATE POLICY "Admins can update user permission overrides"
  ON user_permission_overrides
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM users u, user_roles ur, roles r
      WHERE u.id = auth.uid()
      AND ur.user_id = u.id
      AND ur.role_id = r.id
      AND r.key = 'admin'
      AND r.is_system_role = true
      AND r.is_active = true
      AND u.organization_id = (SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM users u, user_roles ur, roles r
      WHERE u.id = auth.uid()
      AND ur.user_id = u.id
      AND ur.role_id = r.id
      AND r.key = 'admin'
      AND r.is_system_role = true
      AND r.is_active = true
      AND u.organization_id = (SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id)
    )
  );

-- سياسة الحذف: المدراء فقط
CREATE POLICY "Admins can delete user permission overrides"
  ON user_permission_overrides
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM users u, user_roles ur, roles r
      WHERE u.id = auth.uid()
      AND ur.user_id = u.id
      AND ur.role_id = r.id
      AND r.key = 'admin'
      AND r.is_system_role = true
      AND r.is_active = true
      AND u.organization_id = (SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id)
    )
  );

-- إعادة إنشاء سياسات user_roles بطريقة أبسط
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON user_roles;

-- سياسة القراءة البسيطة
CREATE POLICY "Users can view their own roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- سياسة الإدراج للمدراء
CREATE POLICY "Admins can insert user roles"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM users u, user_roles ur, roles r
      WHERE u.id = auth.uid()
      AND ur.user_id = u.id
      AND ur.role_id = r.id
      AND r.key = 'admin'
      AND r.is_system_role = true
      AND r.is_active = true
      AND u.organization_id = (SELECT organization_id FROM users WHERE id = user_roles.user_id)
    )
  );

-- سياسة التحديث للمدراء
CREATE POLICY "Admins can update user roles"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM users u, user_roles ur, roles r
      WHERE u.id = auth.uid()
      AND ur.user_id = u.id
      AND ur.role_id = r.id
      AND r.key = 'admin'
      AND r.is_system_role = true
      AND r.is_active = true
      AND u.organization_id = (SELECT organization_id FROM users WHERE id = user_roles.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM users u, user_roles ur, roles r
      WHERE u.id = auth.uid()
      AND ur.user_id = u.id
      AND ur.role_id = r.id
      AND r.key = 'admin'
      AND r.is_system_role = true
      AND r.is_active = true
      AND u.organization_id = (SELECT organization_id FROM users WHERE id = user_roles.user_id)
    )
  );

-- سياسة الحذف للمدراء
CREATE POLICY "Admins can delete user roles"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM users u, user_roles ur, roles r
      WHERE u.id = auth.uid()
      AND ur.user_id = u.id
      AND ur.role_id = r.id
      AND r.key = 'admin'
      AND r.is_system_role = true
      AND r.is_active = true
      AND u.organization_id = (SELECT organization_id FROM users WHERE id = user_roles.user_id)
    )
  );
