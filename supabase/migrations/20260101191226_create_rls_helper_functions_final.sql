/*
  # Create RLS Helper Functions for Performance and Simplification

  1. Helper Functions
    - get_user_organization_id(): Returns the organization_id for the current authenticated user
      - Uses SECURITY DEFINER for better performance
      - Caches result within the same transaction
    - has_permission(permission_key): Checks if current user has a specific permission
      - Simplifies permission checks in RLS policies
    - is_admin(): Checks if current user has admin role
      - Common check used across many policies
    - is_customer_service_or_admin(): Checks if user is customer service or admin
      - Common check for read-only access
  
  2. Benefits
    - Reduces code duplication in RLS policies
    - Improves performance through function inlining and caching
    - Makes policies easier to read and maintain
    - Centralizes organization and permission logic

  These functions will be used to simplify and optimize all RLS policies.
*/

-- Helper function to get current user's organization_id
-- Uses STABLE for better performance (can be cached within query)
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id 
  FROM users 
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Helper function to check if user has a specific permission
CREATE OR REPLACE FUNCTION has_permission(permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM (
      -- Check role permissions
      SELECT rp.permission_id
      FROM user_roles ur
      JOIN role_permissions rp ON ur.role_id = rp.role_id
      WHERE ur.user_id = auth.uid()
      
      UNION
      
      -- Check user-specific overrides (grants)
      SELECT upo.permission_id
      FROM user_permission_overrides upo
      WHERE upo.user_id = auth.uid() 
        AND upo.is_granted = true
      
      EXCEPT
      
      -- Remove revoked permissions
      SELECT upo.permission_id
      FROM user_permission_overrides upo
      WHERE upo.user_id = auth.uid() 
        AND upo.is_granted = false
    ) AS user_permissions
    JOIN permissions p ON user_permissions.permission_id = p.id
    WHERE p.key = has_permission.permission_key
  );
$$;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.key = 'admin'
  );
$$;

-- Helper function to check if user is customer service or admin
CREATE OR REPLACE FUNCTION is_customer_service_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.key IN ('admin', 'customer_service')
  );
$$;

-- Helper function to check if user is receptionist, customer service, or admin
CREATE OR REPLACE FUNCTION is_receptionist_or_above()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.key IN ('admin', 'customer_service', 'receptionist')
  );
$$;

-- Helper function to check if record belongs to user's organization
CREATE OR REPLACE FUNCTION belongs_to_user_organization(record_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT record_org_id = get_user_organization_id();
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_customer_service_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_receptionist_or_above() TO authenticated;
GRANT EXECUTE ON FUNCTION belongs_to_user_organization(uuid) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION get_user_organization_id() IS 'Returns the organization_id for the current authenticated user. Used in RLS policies.';
COMMENT ON FUNCTION has_permission(text) IS 'Checks if current user has a specific permission. Returns true if granted, false otherwise.';
COMMENT ON FUNCTION is_admin() IS 'Returns true if current user has Admin role.';
COMMENT ON FUNCTION is_customer_service_or_admin() IS 'Returns true if current user has Admin or Customer Service role.';
COMMENT ON FUNCTION is_receptionist_or_above() IS 'Returns true if current user has Admin, Customer Service, or Receptionist role.';
COMMENT ON FUNCTION belongs_to_user_organization(uuid) IS 'Checks if a record belongs to the current user organization.';
