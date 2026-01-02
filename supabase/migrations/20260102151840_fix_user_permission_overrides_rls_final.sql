/*
  # إصلاح سياسات RLS لجدول user_permission_overrides بشكل نهائي

  1. المشكلة
    - وجود سياسات RLS متعددة ومتضاربة
    - سياسة INSERT تفشل حتى للمدراء
    - سياسة SELECT لا تعرض الصلاحيات الممنوحة للمستخدمين بشكل صحيح

  2. الحل
    - حذف جميع السياسات القديمة المتضاربة
    - إنشاء سياسات بسيطة وواضحة
    - المدراء يمكنهم إدارة جميع الصلاحيات في المؤسسة
    - المستخدمون يمكنهم رؤية صلاحياتهم الخاصة فقط
*/

-- حذف جميع السياسات القديمة
DROP POLICY IF EXISTS "Users can view own permission overrides" ON user_permission_overrides;
DROP POLICY IF EXISTS "Users can view permission overrides in their organization" ON user_permission_overrides;
DROP POLICY IF EXISTS "Admins can view user permission overrides" ON user_permission_overrides;
DROP POLICY IF EXISTS "Admins can view all permission overrides" ON user_permission_overrides;
DROP POLICY IF EXISTS "Admins can insert user permission overrides" ON user_permission_overrides;
DROP POLICY IF EXISTS "Admins can update user permission overrides" ON user_permission_overrides;
DROP POLICY IF EXISTS "Admins can delete user permission overrides" ON user_permission_overrides;
DROP POLICY IF EXISTS "Admins can manage permission overrides" ON user_permission_overrides;

-- سياسة القراءة: المدراء يمكنهم رؤية جميع الصلاحيات في مؤسستهم
CREATE POLICY "Admins can view all permission overrides in organization"
  ON user_permission_overrides
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE u.id = auth.uid()
        AND r.key = 'admin'
        AND r.is_system_role = true
        AND r.is_active = true
        AND u.organization_id = (
          SELECT organization_id 
          FROM users 
          WHERE id = user_permission_overrides.user_id
        )
    )
  );

-- سياسة القراءة: المستخدمون يمكنهم رؤية صلاحياتهم الخاصة
CREATE POLICY "Users can view own permission overrides"
  ON user_permission_overrides
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- سياسة الإدراج: المدراء فقط يمكنهم إضافة صلاحيات
CREATE POLICY "Admins can insert permission overrides"
  ON user_permission_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE u.id = auth.uid()
        AND r.key = 'admin'
        AND r.is_system_role = true
        AND r.is_active = true
        AND u.organization_id = (
          SELECT organization_id 
          FROM users 
          WHERE id = user_permission_overrides.user_id
        )
    )
  );

-- سياسة التحديث: المدراء فقط
CREATE POLICY "Admins can update permission overrides"
  ON user_permission_overrides
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE u.id = auth.uid()
        AND r.key = 'admin'
        AND r.is_system_role = true
        AND r.is_active = true
        AND u.organization_id = (
          SELECT organization_id 
          FROM users 
          WHERE id = user_permission_overrides.user_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE u.id = auth.uid()
        AND r.key = 'admin'
        AND r.is_system_role = true
        AND r.is_active = true
        AND u.organization_id = (
          SELECT organization_id 
          FROM users 
          WHERE id = user_permission_overrides.user_id
        )
    )
  );

-- سياسة الحذف: المدراء فقط
CREATE POLICY "Admins can delete permission overrides"
  ON user_permission_overrides
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE u.id = auth.uid()
        AND r.key = 'admin'
        AND r.is_system_role = true
        AND r.is_active = true
        AND u.organization_id = (
          SELECT organization_id 
          FROM users 
          WHERE id = user_permission_overrides.user_id
        )
    )
  );
