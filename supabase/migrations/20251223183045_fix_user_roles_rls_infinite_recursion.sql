/*
  # إصلاح مشكلة Infinite Recursion في سياسات RLS

  1. المشكلة
    - سياسات RLS في جدول user_roles تسبب infinite recursion
    - يحدث عند محاولة التحقق من الأدوار أثناء الوصول لجدول user_roles

  2. الحل
    - استبدال السياسات بسياسات أبسط لا تستدعي نفسها
    - استخدام استعلامات مباشرة بدون استدعاء دوال تحقق من user_roles

  3. الأدوار المضافة
    - إضافة دور customer_service لكل مؤسسة

  4. التحسينات
    - تبسيط سياسات RLS
    - إصلاح جميع سياسات user_permission_overrides
*/

-- إضافة دور customer_service لكل مؤسسة
INSERT INTO roles (organization_id, key, description, is_system_role, is_active)
SELECT 
  id as organization_id,
  'customer_service' as key,
  'دور خدمة العملاء - صلاحيات متوسطة' as description,
  true as is_system_role,
  true as is_active
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM roles 
  WHERE roles.organization_id = organizations.id 
  AND roles.key = 'customer_service'
);

-- منح صلاحيات لدور customer_service
DO $$
DECLARE
  v_role_id uuid;
  v_permission_id uuid;
BEGIN
  FOR v_role_id IN 
    SELECT id FROM roles WHERE key = 'customer_service' AND is_system_role = true
  LOOP
    FOR v_permission_id IN 
      SELECT id FROM permissions 
      WHERE key IN (
        'dashboard:view',
        'customers:view',
        'customers:create',
        'customers:update',
        'work_orders:view',
        'work_orders:create',
        'work_orders:update',
        'invoices:view',
        'invoices:create',
        'inventory:view'
      )
    LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_permission_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- حذف جميع سياسات user_roles القديمة
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles in their organization" ON user_roles;

-- سياسة القراءة: المستخدمون يمكنهم رؤية أدوارهم فقط
CREATE POLICY "Users can view their own roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- سياسة الإدراج: المدراء فقط (استخدام subquery بسيط بدون infinite recursion)
CREATE POLICY "Admins can insert user roles"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.key = 'admin'
      AND r.is_system_role = true
      AND r.is_active = true
      AND u.organization_id = (SELECT organization_id FROM users WHERE id = user_roles.user_id)
    )
  );

-- سياسة التحديث: المدراء فقط
CREATE POLICY "Admins can update user roles"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.key = 'admin'
      AND r.is_system_role = true
      AND r.is_active = true
      AND u.organization_id = (SELECT organization_id FROM users WHERE id = user_roles.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.key = 'admin'
      AND r.is_system_role = true
      AND r.is_active = true
      AND u.organization_id = (SELECT organization_id FROM users WHERE id = user_roles.user_id)
    )
  );

-- سياسة الحذف: المدراء فقط
CREATE POLICY "Admins can delete user roles"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.key = 'admin'
      AND r.is_system_role = true
      AND r.is_active = true
      AND u.organization_id = (SELECT organization_id FROM users WHERE id = user_roles.user_id)
    )
  );

-- إعادة إنشاء سياسات user_permission_overrides بدون infinite recursion
DROP POLICY IF EXISTS "Admins can view user permission overrides" ON user_permission_overrides;
DROP POLICY IF EXISTS "Admins can insert user permission overrides" ON user_permission_overrides;
DROP POLICY IF EXISTS "Admins can update user permission overrides" ON user_permission_overrides;
DROP POLICY IF EXISTS "Admins can delete user permission overrides" ON user_permission_overrides;

-- سياسة القراءة
CREATE POLICY "Admins can view user permission overrides"
  ON user_permission_overrides
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.key = 'admin'
      AND r.is_system_role = true
      AND r.is_active = true
      AND u.organization_id = (
        SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id
      )
    )
  );

-- سياسة الإدراج
CREATE POLICY "Admins can insert user permission overrides"
  ON user_permission_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.key = 'admin'
      AND r.is_system_role = true
      AND r.is_active = true
      AND u.organization_id = (
        SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id
      )
    )
  );

-- سياسة التحديث
CREATE POLICY "Admins can update user permission overrides"
  ON user_permission_overrides
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.key = 'admin'
      AND r.is_system_role = true
      AND r.is_active = true
      AND u.organization_id = (
        SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.key = 'admin'
      AND r.is_system_role = true
      AND r.is_active = true
      AND u.organization_id = (
        SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id
      )
    )
  );

-- سياسة الحذف
CREATE POLICY "Admins can delete user permission overrides"
  ON user_permission_overrides
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.key = 'admin'
      AND r.is_system_role = true
      AND r.is_active = true
      AND u.organization_id = (
        SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id
      )
    )
  );
