/*
  # تحويل نظام الصلاحيات من منح تلقائي إلى منح يدوي

  ## المشكلة
  - النظام الحالي يمنح الصلاحيات تلقائياً بناءً على الدور (role_permissions)
  - المطلوب: الصلاحيات تُمنح يدوياً من المدير عند إنشاء المستخدم

  ## التغييرات
  1. تعديل دالة get_user_all_permissions() - إزالة اعتماد على role_permissions
  2. تعديل دالة user_has_permission() - استخدام user_permission_overrides فقط
  3. Admin يحصل على جميع الصلاحيات تلقائياً (bypass)
  4. غير Admin يحتاج سجل صريح في user_permission_overrides

  ## الأمان
  - Admin: جميع الصلاحيات تلقائياً
  - غير Admin: صلاحيات من user_permission_overrides فقط
  - الأدوار (roles) تصبح للتصنيف فقط
  - role_permissions تبقى كـ templates للمرجع

  ## Migration للبيانات الموجودة
  سيتم نقل الصلاحيات من role_permissions إلى user_permission_overrides
  للمستخدمين الحاليين (غير Admin)
*/

-- ==========================================
-- الخطوة 1: تعديل دالة get_user_all_permissions
-- ==========================================

CREATE OR REPLACE FUNCTION get_user_all_permissions(p_user_id uuid)
RETURNS TABLE (permission_key text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  -- Admin يحصل على جميع الصلاحيات
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = p_user_id
        AND r.key = 'admin'
        AND r.is_active = true
    ) THEN (
      -- إرجاع جميع الصلاحيات المفعلة
      SELECT p.key
      FROM permissions p
      WHERE p.is_active = true
    )
    ELSE (
      -- غير Admin: الصلاحيات من user_permission_overrides فقط
      -- فقط الصلاحيات الممنوحة (is_granted = true) وغير المنتهية
      SELECT p.key
      FROM user_permission_overrides upo
      JOIN permissions p ON upo.permission_id = p.id
      WHERE upo.user_id = p_user_id
        AND upo.is_granted = true
        AND p.is_active = true
        AND (upo.expires_at IS NULL OR upo.expires_at > now())
    )
  END as permission_key;
$$;

-- ==========================================
-- الخطوة 2: تعديل دالة user_has_permission
-- ==========================================

CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id uuid,
  p_permission_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
  v_has_permission boolean;
BEGIN
  -- التحقق من أن المستخدم admin
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
      AND r.key = 'admin'
      AND r.is_active = true
  ) INTO v_is_admin;

  -- Admin يملك جميع الصلاحيات
  IF v_is_admin THEN
    RETURN true;
  END IF;

  -- غير Admin: التحقق من user_permission_overrides فقط
  SELECT EXISTS (
    SELECT 1
    FROM user_permission_overrides upo
    JOIN permissions p ON upo.permission_id = p.id
    WHERE upo.user_id = p_user_id
      AND p.key = p_permission_key
      AND upo.is_granted = true
      AND p.is_active = true
      AND (upo.expires_at IS NULL OR upo.expires_at > now())
  ) INTO v_has_permission;

  RETURN v_has_permission;
END;
$$;

-- ==========================================
-- الخطوة 3: Migration للبيانات الموجودة
-- ==========================================

-- نقل الصلاحيات من role_permissions إلى user_permission_overrides
-- لجميع المستخدمين غير Admin
INSERT INTO user_permission_overrides (user_id, permission_id, is_granted, reason)
SELECT DISTINCT
  ur.user_id,
  rp.permission_id,
  true as is_granted,
  'تحويل تلقائي من نظام الصلاحيات القديم' as reason
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
JOIN role_permissions rp ON r.id = rp.role_id
WHERE r.key != 'admin'  -- استثناء Admin
  AND r.is_active = true
  AND NOT EXISTS (
    -- تجنب التكرار إذا كانت الصلاحية موجودة مسبقاً
    SELECT 1
    FROM user_permission_overrides upo
    WHERE upo.user_id = ur.user_id
      AND upo.permission_id = rp.permission_id
  )
ON CONFLICT (user_id, permission_id) DO NOTHING;

-- ==========================================
-- الخطوة 4: إنشاء دالة مساعدة لجلب عدد الصلاحيات
-- ==========================================

CREATE OR REPLACE FUNCTION get_user_permissions_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::integer
  FROM (
    SELECT permission_key FROM get_user_all_permissions(p_user_id)
  ) subquery;
$$;

-- ==========================================
-- الخطوة 5: تحديث التعليقات على الجداول
-- ==========================================

COMMENT ON TABLE role_permissions IS 'قوالب صلاحيات الأدوار (للمرجع فقط - لا تُستخدم في التحقق من الصلاحيات)';
COMMENT ON TABLE user_permission_overrides IS 'الصلاحيات الفعلية للمستخدمين (المصدر الوحيد لفحص الصلاحيات)';
COMMENT ON COLUMN user_permission_overrides.is_granted IS 'true = منح الصلاحية، false = إلغاء الصلاحية';

-- ==========================================
-- الخطوة 6: إضافة Indexes للأداء
-- ==========================================

-- Index لتسريع البحث في user_permission_overrides للصلاحيات الممنوحة
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_active_grants
  ON user_permission_overrides(user_id, permission_id)
  WHERE is_granted = true AND expires_at IS NULL;

-- Index لتسريع البحث في user_permission_overrides للصلاحيات الممنوحة مع تاريخ انتهاء
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_active_with_expiry
  ON user_permission_overrides(user_id, permission_id, expires_at)
  WHERE is_granted = true AND expires_at IS NOT NULL;

-- ==========================================
-- Log Completion
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '✅ نظام الصلاحيات تم تحويله بنجاح من منح تلقائي إلى منح يدوي';
  RAISE NOTICE '📊 تم نقل الصلاحيات الحالية إلى user_permission_overrides';
  RAISE NOTICE '👮 Admin يحصل على جميع الصلاحيات تلقائياً';
  RAISE NOTICE '👤 غير Admin يحتاج صلاحيات صريحة في user_permission_overrides';
END $$;
