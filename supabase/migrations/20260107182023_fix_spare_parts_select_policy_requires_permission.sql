/*
  # Fix Spare Parts SELECT Policy - Require Permission

  1. Problem
    - Users cannot view inventory even with inventory.view permission
    - The SELECT policy on spare_parts doesn't check user_has_permission
    - Only checks organization_id and deleted_at
  
  2. Solution
    - Update SELECT policy to require inventory.view permission
    - Match other CRUD policies that correctly check permissions
  
  3. Security
    - More secure: requires explicit permission grant
    - Consistent with all other tables
*/

-- Drop the old policy
DROP POLICY IF EXISTS "Users can view spare parts in organization" ON spare_parts;

-- Create new policy that requires permission
CREATE POLICY "Users can view spare parts with permission"
  ON spare_parts FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND deleted_at IS NULL
    AND user_has_permission(auth.uid(), 'inventory.view')
  );
