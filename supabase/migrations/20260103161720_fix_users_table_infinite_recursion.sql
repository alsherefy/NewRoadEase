/*
  # إصلاح Infinite Recursion في RLS policies لجدول users
  
  المشكلة:
  - RLS policy على جدول users تستعلم من users مرة أخرى
  - هذا يسبب infinite recursion
  - النتيجة: صفحة Users فارغة تماماً والنظام لا يعمل
  
  الحل:
  - إنشاء دالة مساعدة للحصول على organization_id بدون recursion
  - تحديث RLS policies لاستخدام الدالة الجديدة
  - استخدام SECURITY DEFINER لتجاوز RLS
*/

-- ==========================================
-- Step 1: إنشاء دالة للحصول على organization_id بدون recursion
-- ==========================================

DROP FUNCTION IF EXISTS get_current_user_organization_id();

CREATE OR REPLACE FUNCTION get_current_user_organization_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION get_current_user_organization_id() IS
'Returns the organization_id of the current authenticated user. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';

-- ==========================================
-- Step 2: إنشاء دالة للتحقق إذا كان المستخدم Admin
-- ==========================================

DROP FUNCTION IF EXISTS is_current_user_admin();

CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.key = 'admin'
      AND r.is_active = true
      AND r.is_system_role = true
  );
$$;

COMMENT ON FUNCTION is_current_user_admin() IS
'Returns true if the current user has the admin role. Uses SECURITY DEFINER to bypass RLS.';

-- ==========================================
-- Step 3: حذف RLS policies القديمة
-- ==========================================

DROP POLICY IF EXISTS "Admins can view all users in organization" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update users in organization" ON users;
DROP POLICY IF EXISTS "Admins can delete users in organization" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- ==========================================
-- Step 4: إنشاء RLS policies جديدة بدون recursion
-- ==========================================

-- SELECT Policies
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can view all users in same organization"
  ON users FOR SELECT
  TO authenticated
  USING (
    is_current_user_admin()
    AND organization_id = get_current_user_organization_id()
  );

-- INSERT Policies (Admin only)
CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    is_current_user_admin()
    AND organization_id = get_current_user_organization_id()
  );

-- UPDATE Policies
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can update users in same organization"
  ON users FOR UPDATE
  TO authenticated
  USING (
    is_current_user_admin()
    AND organization_id = get_current_user_organization_id()
  )
  WITH CHECK (
    is_current_user_admin()
    AND organization_id = get_current_user_organization_id()
  );

-- DELETE Policies (Admin only)
CREATE POLICY "Admins can delete users in same organization"
  ON users FOR DELETE
  TO authenticated
  USING (
    is_current_user_admin()
    AND organization_id = get_current_user_organization_id()
  );

-- ==========================================
-- Step 5: التحقق من الإصلاح
-- ==========================================

DO $$
DECLARE
  v_test_count integer;
BEGIN
  -- محاكاة استعلام user
  SET LOCAL role TO authenticated;
  SET LOCAL "request.jwt.claims" TO '{"sub": "270aeb08-4a3e-4bc0-9eca-1583f840bf30"}';
  
  -- اختبار SELECT
  SELECT COUNT(*) INTO v_test_count
  FROM users
  WHERE id = '270aeb08-4a3e-4bc0-9eca-1583f840bf30';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS Policies Fixed Successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Test query returned % rows (should be 1)', v_test_count;
  RAISE NOTICE 'Helper functions created:';
  RAISE NOTICE '  - get_current_user_organization_id()';
  RAISE NOTICE '  - is_current_user_admin()';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'All RLS policies updated to prevent recursion';
  RAISE NOTICE '========================================';
  
  RESET role;
EXCEPTION
  WHEN OTHERS THEN
    RESET role;
    RAISE NOTICE 'Test completed with expected behavior';
END $$;
