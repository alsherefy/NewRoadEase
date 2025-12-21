/*
  # إنشاء دوال قاعدة البيانات لنظام RBAC
  
  الدوال المنشأة:
  - get_user_all_permissions: جلب جميع صلاحيات المستخدم المحسوبة
  - has_permission_rbac: التحقق من صلاحية محددة
  - has_any_permission_rbac: التحقق من أي صلاحية من قائمة
  - has_role_rbac: التحقق من دور معين
  - count_users_with_role: عدد المستخدمين بدور معين
*/

-- دالة لجلب جميع صلاحيات المستخدم المحسوبة (من الأدوار + الاستثناءات)
CREATE OR REPLACE FUNCTION get_user_all_permissions(p_user_id uuid)
RETURNS TABLE (permission_key text) 
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  -- الصلاحيات من الأدوار
  WITH role_perms AS (
    SELECT DISTINCT p.key as permission_key
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id AND r.is_active = true
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id AND p.is_active = true
    WHERE ur.user_id = p_user_id
  ),
  -- الصلاحيات الاستثنائية الممنوحة
  granted_overrides AS (
    SELECT p.key as permission_key
    FROM user_permission_overrides upo
    JOIN permissions p ON upo.permission_id = p.id AND p.is_active = true
    WHERE upo.user_id = p_user_id
      AND upo.is_granted = true
      AND (upo.expires_at IS NULL OR upo.expires_at > now())
  ),
  -- الصلاحيات الاستثنائية الملغاة
  revoked_overrides AS (
    SELECT p.key as permission_key
    FROM user_permission_overrides upo
    JOIN permissions p ON upo.permission_id = p.id
    WHERE upo.user_id = p_user_id
      AND upo.is_granted = false
      AND (upo.expires_at IS NULL OR upo.expires_at > now())
  )
  -- دمج الصلاحيات: (الأدوار + الممنوحة) - الملغاة
  SELECT permission_key FROM role_perms
  UNION
  SELECT permission_key FROM granted_overrides
  EXCEPT
  SELECT permission_key FROM revoked_overrides;
$$;

-- دالة للتحقق من صلاحية محددة
CREATE OR REPLACE FUNCTION has_permission_rbac(
  p_user_id uuid,
  p_permission_key text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  -- إذا كان المستخدم admin، يملك جميع الصلاحيات
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = p_user_id AND role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM get_user_all_permissions(p_user_id)
    WHERE permission_key = p_permission_key
  );
$$;

-- دالة للتحقق من أي صلاحية من قائمة
CREATE OR REPLACE FUNCTION has_any_permission_rbac(
  p_user_id uuid,
  p_permission_keys text[]
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  -- إذا كان المستخدم admin، يملك جميع الصلاحيات
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = p_user_id AND role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM get_user_all_permissions(p_user_id)
    WHERE permission_key = ANY(p_permission_keys)
  );
$$;

-- دالة للتحقق من دور معين للمستخدم
CREATE OR REPLACE FUNCTION has_role_rbac(
  p_user_id uuid,
  p_role_key text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
      AND r.key = p_role_key
      AND r.is_active = true
  );
$$;

-- دالة لعد المستخدمين بدور معين (مفيدة قبل حذف دور)
CREATE OR REPLACE FUNCTION count_users_with_role(p_role_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(DISTINCT user_id)::integer
  FROM user_roles
  WHERE role_id = p_role_id;
$$;

-- دالة لجلب الأدوار المفعلة لمستخدم معين
CREATE OR REPLACE FUNCTION get_user_active_roles(p_user_id uuid)
RETURNS TABLE (
  role_id uuid,
  role_key text,
  role_name text,
  role_name_en text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    r.id as role_id,
    r.key as role_key,
    r.name as role_name,
    r.name_en as role_name_en
  FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = p_user_id
    AND r.is_active = true
  ORDER BY r.is_system_role DESC, r.name;
$$;
