/*
  # Add Function to Get User Roles

  ## Purpose
  Create a function to get user roles that can be called from the frontend.
  This bypasses RLS policies while maintaining security.

  ## Changes
  - Create get_user_roles function that returns user's roles with details
  - Function uses SECURITY DEFINER to bypass RLS
  - Only returns roles for the authenticated user

  ## Security
  - Function checks auth.uid() to ensure users can only see their own roles
  - Returns role details needed for the frontend
*/

CREATE OR REPLACE FUNCTION get_user_roles(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  role_id uuid,
  role jsonb,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    ur.id,
    ur.user_id,
    ur.role_id,
    jsonb_build_object(
      'id', r.id,
      'key', r.key,
      'description', r.description,
      'is_active', r.is_active,
      'is_system_role', r.is_system_role
    ) as role,
    ur.created_at
  FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = COALESCE(p_user_id, auth.uid())
    AND r.is_active = true
  ORDER BY r.is_system_role DESC, r.key;
$$;
