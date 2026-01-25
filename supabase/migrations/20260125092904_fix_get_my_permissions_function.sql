/*
  # Fix get_my_permissions Function

  1. Purpose
    - Fix the get_my_permissions RPC function to work with the correct structure
    - Returns user data along with computed permissions
    - Handles users who don't have a profile in public.users yet

  2. Returns
    - user_id
    - organization_id
    - is_active
    - roles (array)
    - permissions (computed final permissions array)
*/

-- Drop the old incorrect function
DROP FUNCTION IF EXISTS get_my_permissions();

-- Create the correct function that returns all needed user data
CREATE OR REPLACE FUNCTION get_my_permissions()
RETURNS TABLE(
  user_id uuid,
  organization_id uuid,
  is_active boolean,
  roles text[],
  permissions text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_is_active boolean;
  v_roles text[];
  v_final_permissions text[];
BEGIN
  v_user_id := auth.uid();
  
  -- Check if user exists in public.users
  SELECT 
    u.organization_id,
    u.is_active
  INTO v_org_id, v_is_active
  FROM users u
  WHERE u.id = v_user_id;
  
  -- If user doesn't exist in public.users, return empty result
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Get data from user_active_permissions
  SELECT 
    uap.roles,
    -- Compute final permissions: (role_permissions + granted_permissions) - revoked_permissions
    array(
      SELECT DISTINCT unnest(
        array_cat(
          COALESCE(uap.role_permissions, ARRAY[]::text[]),
          COALESCE(uap.granted_permissions, ARRAY[]::text[])
        )
      )
      EXCEPT
      SELECT unnest(COALESCE(uap.revoked_permissions, ARRAY[]::text[]))
    ) as final_perms
  INTO v_roles, v_final_permissions
  FROM user_active_permissions uap
  WHERE uap.user_id = v_user_id;
  
  -- Return the result
  RETURN QUERY
  SELECT 
    v_user_id,
    v_org_id,
    v_is_active,
    COALESCE(v_roles, ARRAY[]::text[]),
    COALESCE(v_final_permissions, ARRAY[]::text[]);
END;
$$;