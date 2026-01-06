/*
  # تبسيط RLS Policies - النسخة المحدثة

  ## المشكلة
  - 269 سياسة RLS في النظام
  - العديد من السياسات متكررة
  - overhead كبير على كل استعلام

  ## الحل
  - دمج السياسات المتشابهة
  - إزالة التكرار
  - تحسين الأداء
*/

-- ==========================================
-- 1. تبسيط policies لـ workshop_settings
-- ==========================================

DO $$
BEGIN
  -- حذف جميع policies القديمة
  DROP POLICY IF EXISTS "Users can view workshop settings" ON workshop_settings;
  DROP POLICY IF EXISTS "Users can update workshop settings" ON workshop_settings;
  DROP POLICY IF EXISTS "Users can insert workshop settings" ON workshop_settings;
  DROP POLICY IF EXISTS "Users can manage workshop settings" ON workshop_settings;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Users can manage workshop settings"
  ON workshop_settings FOR ALL
  TO authenticated
  USING (organization_id = current_user_organization_id())
  WITH CHECK (organization_id = current_user_organization_id());

-- ==========================================
-- 2. تبسيط policies لـ salaries
-- ==========================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view salaries" ON salaries;
  DROP POLICY IF EXISTS "Users can manage salaries" ON salaries;
  DROP POLICY IF EXISTS "Users can insert salaries" ON salaries;
  DROP POLICY IF EXISTS "Users can update salaries" ON salaries;
  DROP POLICY IF EXISTS "Users can delete salaries" ON salaries;
  DROP POLICY IF EXISTS "Users can manage salaries in organization" ON salaries;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Users can manage salaries in organization"
  ON salaries FOR ALL
  TO authenticated
  USING (organization_id = current_user_organization_id())
  WITH CHECK (organization_id = current_user_organization_id());

-- ==========================================
-- 3. إنشاء helper function محسّنة للتحقق من الصلاحيات
-- ==========================================

CREATE OR REPLACE FUNCTION quick_check_permission(
  p_permission_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_current_user_admin()
  OR 
  EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = auth.uid()
      AND p.key = p_permission_key
      AND p.is_active = true
  )
  OR
  EXISTS (
    SELECT 1
    FROM user_permission_overrides upo
    JOIN permissions p ON upo.permission_id = p.id
    WHERE upo.user_id = auth.uid()
      AND p.key = p_permission_key
      AND upo.is_granted = true
      AND (upo.expires_at IS NULL OR upo.expires_at > now())
  );
$$;

COMMENT ON FUNCTION quick_check_permission(text) IS
  'دالة محسّنة للتحقق السريع من صلاحية محددة';

-- ==========================================
-- 4. تحديث الإحصائيات
-- ==========================================

ANALYZE workshop_settings;
ANALYZE salaries;

-- ==========================================
-- 5. تسجيل النتائج
-- ==========================================

DO $$
DECLARE
  total_policies int;
BEGIN
  SELECT COUNT(*) INTO total_policies
  FROM pg_policies
  WHERE schemaname = 'public';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS Policies Simplified';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total active policies: %', total_policies;
  RAISE NOTICE 'Helper function created: quick_check_permission()';
  RAISE NOTICE '========================================';
END $$;