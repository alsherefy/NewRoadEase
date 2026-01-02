/*
  # Fix RLS Policies to Respect User Permissions

  1. Problem Fixed
    - RLS policies only check organization_id
    - User permissions (role-based and custom overrides) are ignored
    - Receptionists cannot edit expenses/invoices even with permissions granted

  2. Solution
    - Create comprehensive `user_has_permission()` function
    - Update RLS policies for expenses, invoices, and other tables
    - Respect both role permissions and custom user overrides
    - Support admin bypass

  3. New Functions
    - `user_has_permission(p_user_id, p_permission_key)` 
      Returns true if user has the permission through:
      * Being an admin
      * Having a granted permission override
      * Having the permission through their role

  4. Updated RLS Policies
    - expenses: UPDATE, DELETE policies now check permissions
    - invoices: UPDATE, DELETE policies now check permissions
    - work_orders: UPDATE, DELETE policies now check permissions
    - customers: UPDATE, DELETE policies now check permissions
    - spare_parts: UPDATE, DELETE policies now check permissions
    - invoice_items: UPDATE, DELETE policies now check permissions

  This migration ensures that permission system works correctly at database level.
*/

-- =====================================================
-- DROP OLD PERMISSION CHECK FUNCTION IF EXISTS
-- =====================================================

DROP FUNCTION IF EXISTS user_has_permission(uuid, text);

-- =====================================================
-- CREATE COMPREHENSIVE PERMISSION CHECK FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id uuid,
  p_permission_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
  v_has_override boolean;
  v_override_granted boolean;
  v_has_role_permission boolean;
  v_org_id uuid;
BEGIN
  -- Get user's organization
  SELECT organization_id INTO v_org_id
  FROM users
  WHERE id = p_user_id;

  IF v_org_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if user is admin (admins have all permissions)
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
      AND r.key = 'admin'
      AND r.is_active = true
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN true;
  END IF;

  -- Check for permission overrides (custom permissions)
  SELECT 
    EXISTS (
      SELECT 1
      FROM user_permission_overrides upo
      JOIN permissions p ON upo.permission_id = p.id
      WHERE upo.user_id = p_user_id
        AND p.key = p_permission_key
        AND (upo.expires_at IS NULL OR upo.expires_at > now())
    ),
    COALESCE(
      (
        SELECT upo.is_granted
        FROM user_permission_overrides upo
        JOIN permissions p ON upo.permission_id = p.id
        WHERE upo.user_id = p_user_id
          AND p.key = p_permission_key
          AND (upo.expires_at IS NULL OR upo.expires_at > now())
        ORDER BY upo.created_at DESC
        LIMIT 1
      ),
      false
    )
  INTO v_has_override, v_override_granted;

  -- If there's an override, use it (whether granted or denied)
  IF v_has_override THEN
    RETURN v_override_granted;
  END IF;

  -- Check role-based permissions
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id
      AND p.key = p_permission_key
      AND p.is_active = true
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ) INTO v_has_role_permission;

  RETURN v_has_role_permission;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION user_has_permission(uuid, text) TO authenticated;

COMMENT ON FUNCTION user_has_permission IS 'Checks if a user has a specific permission through admin role, permission override, or role-based permission';

-- =====================================================
-- UPDATE EXPENSES RLS POLICIES
-- =====================================================

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "Users can update expenses in organization" ON expenses;
DROP POLICY IF EXISTS "Receptionists can update expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can update expenses in their organization" ON expenses;

-- Create new UPDATE policy with permission check
CREATE POLICY "Users can update expenses with permission"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'expenses.update')
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'expenses.update')
  );

-- Drop existing DELETE policies
DROP POLICY IF EXISTS "Users can delete expenses in organization" ON expenses;
DROP POLICY IF EXISTS "Receptionists can delete expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can delete expenses in their organization" ON expenses;

-- Create new DELETE policy with permission check
CREATE POLICY "Users can delete expenses with permission"
  ON expenses FOR DELETE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'expenses.delete')
  );

-- =====================================================
-- UPDATE INVOICES RLS POLICIES
-- =====================================================

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "Users can update invoices in organization" ON invoices;
DROP POLICY IF EXISTS "Receptionists can update invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices in their organization" ON invoices;

-- Create new UPDATE policy with permission check
CREATE POLICY "Users can update invoices with permission"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'invoices.update')
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'invoices.update')
  );

-- Drop existing DELETE policies
DROP POLICY IF EXISTS "Users can delete invoices in organization" ON invoices;
DROP POLICY IF EXISTS "Receptionists can delete invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can delete invoices in their organization" ON invoices;

-- Create new DELETE policy with permission check
CREATE POLICY "Users can delete invoices with permission"
  ON invoices FOR DELETE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'invoices.delete')
  );

-- =====================================================
-- UPDATE INVOICE_ITEMS RLS POLICIES (RELATED)
-- =====================================================

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "Users can update invoice items in organization" ON invoice_items;
DROP POLICY IF EXISTS "Receptionists can update invoice items" ON invoice_items;

-- Create new UPDATE policy with permission check
CREATE POLICY "Users can update invoice items with permission"
  ON invoice_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND user_has_permission(auth.uid(), 'invoices.update')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND user_has_permission(auth.uid(), 'invoices.update')
  );

-- Drop existing DELETE policies
DROP POLICY IF EXISTS "Users can delete invoice items in organization" ON invoice_items;
DROP POLICY IF EXISTS "Receptionists can delete invoice items" ON invoice_items;

-- Create new DELETE policy with permission check
CREATE POLICY "Users can delete invoice items with permission"
  ON invoice_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND user_has_permission(auth.uid(), 'invoices.delete')
  );

-- =====================================================
-- UPDATE WORK_ORDERS RLS POLICIES
-- =====================================================

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "Users can update work orders in organization" ON work_orders;
DROP POLICY IF EXISTS "Receptionists can update work orders" ON work_orders;

-- Create new UPDATE policy with permission check
CREATE POLICY "Users can update work orders with permission"
  ON work_orders FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'work_orders.update')
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'work_orders.update')
  );

-- Drop existing DELETE policies
DROP POLICY IF EXISTS "Users can delete work orders in organization" ON work_orders;
DROP POLICY IF EXISTS "Receptionists can delete work orders" ON work_orders;

-- Create new DELETE policy with permission check
CREATE POLICY "Users can delete work orders with permission"
  ON work_orders FOR DELETE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'work_orders.delete')
  );

-- =====================================================
-- UPDATE CUSTOMERS RLS POLICIES
-- =====================================================

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "Users can update customers in organization" ON customers;
DROP POLICY IF EXISTS "Receptionists can update customers" ON customers;

-- Create new UPDATE policy with permission check
CREATE POLICY "Users can update customers with permission"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'customers.update')
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'customers.update')
  );

-- Drop existing DELETE policies
DROP POLICY IF EXISTS "Users can delete customers in organization" ON customers;
DROP POLICY IF EXISTS "Receptionists can delete customers" ON customers;

-- Create new DELETE policy with permission check
CREATE POLICY "Users can delete customers with permission"
  ON customers FOR DELETE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'customers.delete')
  );

-- =====================================================
-- UPDATE SPARE_PARTS (INVENTORY) RLS POLICIES
-- =====================================================

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "Users can update spare parts in organization" ON spare_parts;
DROP POLICY IF EXISTS "Receptionists can update spare parts" ON spare_parts;

-- Create new UPDATE policy with permission check
CREATE POLICY "Users can update spare parts with permission"
  ON spare_parts FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'inventory.update')
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'inventory.update')
  );

-- Drop existing DELETE policies
DROP POLICY IF EXISTS "Users can delete spare parts in organization" ON spare_parts;
DROP POLICY IF EXISTS "Receptionists can delete spare parts" ON spare_parts;

-- Create new DELETE policy with permission check
CREATE POLICY "Users can delete spare parts with permission"
  ON spare_parts FOR DELETE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'inventory.delete')
  );

-- =====================================================
-- HELPFUL COMMENTS
-- =====================================================

COMMENT ON POLICY "Users can update expenses with permission" ON expenses IS 'Allows users with expenses.update permission to update expenses';
COMMENT ON POLICY "Users can delete expenses with permission" ON expenses IS 'Allows users with expenses.delete permission to delete expenses';
COMMENT ON POLICY "Users can update invoices with permission" ON invoices IS 'Allows users with invoices.update permission to update invoices';
COMMENT ON POLICY "Users can delete invoices with permission" ON invoices IS 'Allows users with invoices.delete permission to delete invoices';
COMMENT ON POLICY "Users can update work orders with permission" ON work_orders IS 'Allows users with work_orders.update permission to update work orders';
COMMENT ON POLICY "Users can delete work orders with permission" ON work_orders IS 'Allows users with work_orders.delete permission to delete work orders';

-- =====================================================
-- PERFORMANCE OPTIMIZATION
-- =====================================================

-- Add indexes for faster permission lookups
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user_permission 
  ON user_permission_overrides(user_id, permission_id);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_permission 
  ON role_permissions(role_id, permission_id);

CREATE INDEX IF NOT EXISTS idx_permissions_key 
  ON permissions(key) WHERE is_active = true;
