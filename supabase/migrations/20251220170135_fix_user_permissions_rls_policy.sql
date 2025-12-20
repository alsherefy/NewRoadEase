/*
  # Fix user_permissions RLS policy to allow admins to view all permissions

  1. Changes
    - Drop existing SELECT policy on user_permissions
    - Create new SELECT policy that allows:
      - Users to view their own permissions
      - Admins to view all permissions
  
  2. Security
    - Maintains user privacy (users can only see their own permissions)
    - Allows admins to manage all user permissions
*/

DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;

CREATE POLICY "Users and Admins can view permissions"
  ON user_permissions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    get_current_user_role() = 'admin'
  );
