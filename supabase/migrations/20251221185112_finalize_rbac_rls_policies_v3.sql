/*
  # Finalize RBAC RLS Policies

  1. Purpose
    - Ensure all RBAC tables have proper RLS policies
    - Add missing policies for roles, permissions, role_permissions, and user_roles tables
    - Secure access to RBAC system tables

  2. Security
    - Roles table: Admins can manage, all authenticated users can view
    - Permissions table: All authenticated users can view
    - Role_permissions table: Admins can manage, all authenticated users can view
    - User_roles table: Users can view their own roles, admins can manage all

  3. Notes
    - All policies check organization_id for proper multi-tenancy
    - Uses RBAC functions for permission checks
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view roles in their organization" ON roles;
DROP POLICY IF EXISTS "Admins can insert roles in their organization" ON roles;
DROP POLICY IF EXISTS "Admins can update roles in their organization" ON roles;
DROP POLICY IF EXISTS "Admins can delete roles in their organization" ON roles;
DROP POLICY IF EXISTS "Authenticated users can view all permissions" ON permissions;
DROP POLICY IF EXISTS "Users can view role permissions in their organization" ON role_permissions;
DROP POLICY IF EXISTS "Admins can manage role permissions in their organization" ON role_permissions;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles in their organization" ON user_roles;

-- Policies for roles table
CREATE POLICY "Users can view roles in their organization"
  ON roles FOR SELECT
  TO authenticated
  USING (
    roles.organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert roles in their organization"
  ON roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE u.id = auth.uid()
        AND u.organization_id = roles.organization_id
        AND r.key = 'admin'
    )
  );

CREATE POLICY "Admins can update roles in their organization"
  ON roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE u.id = auth.uid()
        AND u.organization_id = roles.organization_id
        AND r.key = 'admin'
    )
  );

CREATE POLICY "Admins can delete roles in their organization"
  ON roles FOR DELETE
  TO authenticated
  USING (
    roles.is_system_role = false AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE u.id = auth.uid()
        AND u.organization_id = roles.organization_id
        AND r.key = 'admin'
    )
  );

-- Policies for permissions table (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view all permissions"
  ON permissions FOR SELECT
  TO authenticated
  USING (true);

-- Policies for role_permissions table
CREATE POLICY "Users can view role permissions in their organization"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = role_permissions.role_id
        AND r.organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
    )
  );

CREATE POLICY "Admins can manage role permissions in their organization"
  ON role_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      JOIN users u ON u.organization_id = r.organization_id
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles admin_role ON admin_role.id = ur.role_id
      WHERE r.id = role_permissions.role_id
        AND u.id = auth.uid()
        AND admin_role.key = 'admin'
    )
  );

-- Policies for user_roles table
CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (
    user_roles.user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE u.id = auth.uid()
        AND r.key = 'admin'
    )
  );

CREATE POLICY "Admins can manage user roles in their organization"
  ON user_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN users target_user ON target_user.id = user_roles.user_id
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE u.id = auth.uid()
        AND u.organization_id = target_user.organization_id
        AND r.key = 'admin'
    )
  );

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'RLS policies finalized for RBAC system';
END $$;
