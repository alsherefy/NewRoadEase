/*
  # إضافة الأدوار المفقودة وإصلاح سياسات RLS

  1. إضافة الأدوار
    - إضافة دور receptionist (موظف استقبال)
    - إضافة دور customer_service (خدمة العملاء) إذا كان مطلوباً

  2. إصلاح سياسات RLS
    - إضافة سياسات RLS لجدول user_permission_overrides
    - السماح للمدراء بإدارة الصلاحيات الاستثنائية

  3. ملاحظات
    - الأدوار الجديدة ستكون نشطة افتراضياً
    - سيتم ربط الأدوار بالمؤسسات الموجودة
*/

-- إضافة دور receptionist لكل مؤسسة
INSERT INTO roles (organization_id, key, description, is_system_role, is_active)
SELECT 
  id as organization_id,
  'receptionist' as key,
  'دور موظف الاستقبال - صلاحيات أساسية' as description,
  true as is_system_role,
  true as is_active
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM roles 
  WHERE roles.organization_id = organizations.id 
  AND roles.key = 'receptionist'
);

-- تفعيل RLS على جدول user_permission_overrides إذا لم يكن مفعلاً
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- حذف السياسات القديمة إن وجدت
DROP POLICY IF EXISTS "Admins can manage user permission overrides" ON user_permission_overrides;
DROP POLICY IF EXISTS "Users can view their own permission overrides" ON user_permission_overrides;

-- سياسة للقراءة: المدراء يمكنهم رؤية كل الصلاحيات الاستثنائية في مؤسستهم
CREATE POLICY "Admins can view user permission overrides"
  ON user_permission_overrides
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.organization_id = (
        SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id
      )
      AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = u.id
        AND r.key = 'admin'
        AND r.is_active = true
      )
    )
  );

-- سياسة للإدراج: المدراء فقط يمكنهم إضافة صلاحيات استثنائية
CREATE POLICY "Admins can insert user permission overrides"
  ON user_permission_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.organization_id = (
        SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id
      )
      AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = u.id
        AND r.key = 'admin'
        AND r.is_active = true
      )
    )
  );

-- سياسة للتحديث: المدراء فقط يمكنهم تحديث الصلاحيات الاستثنائية
CREATE POLICY "Admins can update user permission overrides"
  ON user_permission_overrides
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.organization_id = (
        SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id
      )
      AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = u.id
        AND r.key = 'admin'
        AND r.is_active = true
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.organization_id = (
        SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id
      )
      AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = u.id
        AND r.key = 'admin'
        AND r.is_active = true
      )
    )
  );

-- سياسة للحذف: المدراء فقط يمكنهم حذف الصلاحيات الاستثنائية
CREATE POLICY "Admins can delete user permission overrides"
  ON user_permission_overrides
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.organization_id = (
        SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id
      )
      AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = u.id
        AND r.key = 'admin'
        AND r.is_active = true
      )
    )
  );

-- منح صلاحيات أساسية لدور receptionist
DO $$
DECLARE
  v_role_id uuid;
  v_permission_id uuid;
BEGIN
  FOR v_role_id IN 
    SELECT id FROM roles WHERE key = 'receptionist' AND is_system_role = true
  LOOP
    -- صلاحيات العرض الأساسية
    FOR v_permission_id IN 
      SELECT id FROM permissions 
      WHERE key IN (
        'dashboard:view',
        'customers:view',
        'work_orders:view',
        'invoices:view',
        'inventory:view'
      )
    LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_permission_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
