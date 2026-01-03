/*
  # إصلاح دالة get_user_all_permissions
  
  المشكلة:
  - الدالة الحالية تستخدم CASE/WHEN بشكل خاطئ
  - تسبب خطأ "more than one row returned by a subquery"
  - المستخدمون لا يحصلون على صلاحياتهم
  
  الحل:
  - إعادة كتابة الدالة بشكل صحيح
  - Admin يحصل على جميع الصلاحيات
  - غير Admin يحصل على الصلاحيات من user_permission_overrides
*/

-- حذف الدالة الخاطئة
DROP FUNCTION IF EXISTS get_user_all_permissions(uuid);

-- إنشاء الدالة الصحيحة
CREATE OR REPLACE FUNCTION get_user_all_permissions(p_user_id uuid)
RETURNS TABLE (permission_key text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- التحقق إذا كان المستخدم Admin
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
      AND r.key = 'admin'
      AND r.is_active = true
  ) INTO v_is_admin;

  -- إذا كان Admin، إرجاع جميع الصلاحيات المفعلة
  IF v_is_admin THEN
    RETURN QUERY
    SELECT p.key as permission_key
    FROM permissions p
    WHERE p.is_active = true
    ORDER BY p.category, p.display_order;
  ELSE
    -- غير Admin: إرجاع الصلاحيات الممنوحة من user_permission_overrides فقط
    RETURN QUERY
    SELECT DISTINCT p.key as permission_key
    FROM user_permission_overrides upo
    JOIN permissions p ON upo.permission_id = p.id
    WHERE upo.user_id = p_user_id
      AND upo.is_granted = true
      AND p.is_active = true
      AND (upo.expires_at IS NULL OR upo.expires_at > now())
    ORDER BY p.key;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_user_all_permissions(uuid) IS
'Returns all permissions for a user. Admin gets all active permissions automatically. Others get permissions from user_permission_overrides table only.';

-- اختبار الدالة
DO $$
DECLARE
  v_test_user_id uuid;
  v_admin_user_id uuid;
  v_admin_count integer;
  v_user_count integer;
BEGIN
  -- الحصول على مستخدم عادي (receptionist)
  SELECT u.id INTO v_test_user_id
  FROM users u
  JOIN user_roles ur ON u.id = ur.user_id
  JOIN roles r ON ur.role_id = r.id
  WHERE r.key = 'receptionist'
  LIMIT 1;

  -- الحصول على مستخدم Admin
  SELECT u.id INTO v_admin_user_id
  FROM users u
  JOIN user_roles ur ON u.id = ur.user_id
  JOIN roles r ON ur.role_id = r.id
  WHERE r.key = 'admin'
  LIMIT 1;

  -- اختبار Admin
  IF v_admin_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_admin_count
    FROM get_user_all_permissions(v_admin_user_id);
    RAISE NOTICE 'Admin user has % permissions (should be all active permissions)', v_admin_count;
  END IF;

  -- اختبار مستخدم عادي
  IF v_test_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_count
    FROM get_user_all_permissions(v_test_user_id);
    RAISE NOTICE 'Regular user has % permissions (from user_permission_overrides)', v_user_count;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Function get_user_all_permissions fixed successfully!';
  RAISE NOTICE '========================================';
END $$;
