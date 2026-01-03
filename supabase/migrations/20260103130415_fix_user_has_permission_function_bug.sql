/*
  # Fix user_has_permission Function Bug
  
  ## Problem
  The user_has_permission function references columns that don't exist in user_roles table:
  - ur.is_active (doesn't exist)
  - ur.expires_at (doesn't exist)
  
  These columns only exist in the roles table, not in user_roles.
  
  ## Solution
  Remove the non-existent column references from the function.
  The function should only check r.is_active (which exists in roles table).
  
  ## Impact
  This fixes the permission checking system which was completely broken,
  causing all permission checks to fail with database errors.
*/

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
  v_has_override boolean;
  v_override_granted boolean;
  v_has_role_permission boolean;
  v_org_id uuid;
BEGIN
  -- Get user's organization
  SELECT organization_id INTO v_org_id
  FROM users
  WHERE id = p_user_id;

  IF v_org_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if user is admin (admins have all permissions)
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
      AND r.key = 'admin'
      AND r.is_active = true
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN true;
  END IF;

  -- Check for permission overrides (custom permissions)
  SELECT 
    EXISTS (
      SELECT 1
      FROM user_permission_overrides upo
      JOIN permissions p ON upo.permission_id = p.id
      WHERE upo.user_id = p_user_id
        AND p.key = p_permission_key
        AND (upo.expires_at IS NULL OR upo.expires_at > now())
    ),
    COALESCE(
      (
        SELECT upo.is_granted
        FROM user_permission_overrides upo
        JOIN permissions p ON upo.permission_id = p.id
        WHERE upo.user_id = p_user_id
          AND p.key = p_permission_key
          AND (upo.expires_at IS NULL OR upo.expires_at > now())
        ORDER BY upo.created_at DESC
        LIMIT 1
      ),
      false
    )
  INTO v_has_override, v_override_granted;

  -- If there's an override, use it (whether granted or denied)
  IF v_has_override THEN
    RETURN v_override_granted;
  END IF;

  -- Check role-based permissions
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id
      AND p.key = p_permission_key
      AND p.is_active = true
  ) INTO v_has_role_permission;

  RETURN v_has_role_permission;
END;
$$;