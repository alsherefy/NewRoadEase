/*
  # Fix RBAC Functions - Remove Old Role Reference

  ## Purpose
  Fix database functions that reference the old users.role column which was removed during RBAC migration.

  ## Changes
  - Update has_permission_rbac function to check for admin role via user_roles table
  - Update has_any_permission_rbac function to check for admin role via user_roles table
  - Ensure admin users automatically have all permissions

  ## Notes
  - Admins are identified by having the 'admin' role in the roles table
  - This maintains the same behavior as before but uses the new RBAC structure
*/

-- Fix has_permission_rbac function to use RBAC system
CREATE OR REPLACE FUNCTION has_permission_rbac(
  p_user_id uuid,
  p_permission_key text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  -- Check if user has admin role via user_roles
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id 
      AND r.key = 'admin'
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM get_user_all_permissions(p_user_id)
    WHERE permission_key = p_permission_key
  );
$$;

-- Fix has_any_permission_rbac function to use RBAC system
CREATE OR REPLACE FUNCTION has_any_permission_rbac(
  p_user_id uuid,
  p_permission_keys text[]
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  -- Check if user has admin role via user_roles
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id 
      AND r.key = 'admin'
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM get_user_all_permissions(p_user_id)
    WHERE permission_key = ANY(p_permission_keys)
  );
$$;
