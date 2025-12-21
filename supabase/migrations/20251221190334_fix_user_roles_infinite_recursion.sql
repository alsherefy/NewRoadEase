/*
  # Fix Infinite Recursion in user_roles RLS Policy

  ## Problem
  The current policy for viewing user_roles creates an infinite recursion:
  - To check if a user can view user_roles, we check if they're admin
  - To check if they're admin, we need to read user_roles
  - This creates an infinite loop

  ## Solution
  Simplify the SELECT policy to only allow users to view their own roles
  without checking if they're admin through user_roles table.
  Admin access for viewing other users' roles will be handled at the application level.

  ## Changes
  1. Drop the existing SELECT policy that causes recursion
  2. Create a simple policy that allows users to view only their own roles
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;

-- Create a simple policy without recursion
CREATE POLICY "Users can view their own roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
