/*
  # Add RLS Policies for Permissions Table

  1. Problem
    - Users cannot read from permissions table
    - Missing SELECT policy

  2. Solution
    - Add SELECT policy for authenticated users
    - Allow all authenticated users to view active permissions
*/

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can view permissions" ON permissions;
DROP POLICY IF EXISTS "Users can view active permissions" ON permissions;

-- Create SELECT policy for permissions table
CREATE POLICY "Authenticated users can view active permissions"
  ON permissions FOR SELECT
  TO authenticated
  USING (is_active = true);

COMMENT ON POLICY "Authenticated users can view active permissions" ON permissions IS 'Allow authenticated users to view active permissions for UI display';
