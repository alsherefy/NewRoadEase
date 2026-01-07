/*
  # Fix Work Order Spare Parts SELECT Policy - Require Permission

  1. Problem
    - Users can view work order spare parts without permission check
    - The SELECT policy only checks organization_id
    - Inconsistent with other CRUD policies that require work_orders.view permission
  
  2. Solution
    - Update SELECT policy to require work_orders.view permission
    - Match INSERT/UPDATE/DELETE policies that correctly check permissions
  
  3. Security
    - More secure: requires explicit permission grant
    - Consistent with all other tables
*/

-- Drop the old policy
DROP POLICY IF EXISTS "Users can view work order spare parts in organization" ON work_order_spare_parts;

-- Create new policy that requires permission
CREATE POLICY "Users can view work order spare parts with permission"
  ON work_order_spare_parts FOR SELECT
  TO authenticated
  USING (
    work_order_id IN (
      SELECT id FROM work_orders 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
      AND deleted_at IS NULL
    )
    AND user_has_permission(auth.uid(), 'work_orders.view')
  );
