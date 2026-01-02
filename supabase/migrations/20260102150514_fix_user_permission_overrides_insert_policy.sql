/*
  # Fix INSERT policy for user_permission_overrides table

  1. Changes
    - Drop the existing INSERT policy that has no conditions
    - Create a new INSERT policy that properly checks if the user is an admin
    - Ensures admins can grant permissions to users in their organization

  2. Security
    - Only admins can insert permission overrides
    - Admins can only grant permissions to users in their organization
*/

-- Drop the old INSERT policy
DROP POLICY IF EXISTS "Admins can insert user permission overrides" ON user_permission_overrides;

-- Create new INSERT policy with proper conditions
CREATE POLICY "Admins can insert user permission overrides"
  ON user_permission_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Check if current user is admin
    EXISTS (
      SELECT 1
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE u.id = auth.uid()
        AND r.key = 'admin'
        AND r.is_system_role = true
        AND r.is_active = true
        -- Ensure the target user is in the same organization
        AND u.organization_id = (
          SELECT organization_id 
          FROM users 
          WHERE id = user_permission_overrides.user_id
        )
    )
  );
