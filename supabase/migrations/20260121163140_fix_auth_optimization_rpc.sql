/*
  # إصلاح RPC Function للحصول على بيانات المستخدم

  1. المشكلة
    - الـ function السابق يستخدم auth.uid() الذي لا يعمل مع service role client
    - يجب تمرير user_id كـ parameter
    
  2. الحل
    - تعديل الـ function لاستقبال p_user_id كـ parameter
    - استبدال auth.uid() بـ p_user_id في جميع الاستعلامات
*/

DROP FUNCTION IF EXISTS get_my_auth_context();

CREATE OR REPLACE FUNCTION get_user_auth_context(p_user_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $$
  WITH user_info AS (
    SELECT 
      u.id,
      u.email,
      u.full_name,
      u.organization_id,
      u.is_active
    FROM users u
    WHERE u.id = p_user_id
  ),
  user_role_list AS (
    SELECT array_agg(DISTINCT r.key) as roles
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
  ),
  user_perms AS (
    SELECT json_agg(DISTINCT p.resource || '.' || p.action) as permissions
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id
  )
  SELECT json_build_object(
    'user_id', ui.id,
    'email', ui.email,
    'full_name', ui.full_name,
    'organization_id', ui.organization_id,
    'is_active', ui.is_active,
    'roles', COALESCE(url.roles, ARRAY[]::text[]),
    'permissions', COALESCE(up.permissions, json_build_array())
  )
  FROM user_info ui
  CROSS JOIN user_role_list url
  CROSS JOIN user_perms up;
$$;

GRANT EXECUTE ON FUNCTION get_user_auth_context(uuid) TO service_role;