/*
  # Fix RLS Policies for Customers, Work Orders, and Expenses

  1. Changes
    - Drop old RLS policies that use deprecated `is_staff_user()` function
    - Create new policies for customers (INSERT, UPDATE, DELETE)
    - Create new policies for work_orders (UPDATE, DELETE)
    - Create new policies for expenses (INSERT, UPDATE, DELETE)
    - All policies check organization_id for multi-tenancy

  2. Security
    - All authenticated users can view their organization's data
    - All authenticated users can create records for their organization
    - All authenticated users can update their organization's records
    - All authenticated users can delete their organization's records
*/

-- Drop old customers policies that use is_staff_user()
DROP POLICY IF EXISTS "Staff users can update customers" ON customers;
DROP POLICY IF EXISTS "Staff users can delete customers" ON customers;

-- Create new customers policies
CREATE POLICY "Users can update own organization customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own organization customers"
  ON customers FOR DELETE
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Drop old work_orders policies if they exist
DROP POLICY IF EXISTS "Users can update own organization work orders" ON work_orders;
DROP POLICY IF EXISTS "Users can delete own organization work orders" ON work_orders;

-- Create new work_orders policies
CREATE POLICY "Users can update own organization work orders"
  ON work_orders FOR UPDATE
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own organization work orders"
  ON work_orders FOR DELETE
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Drop old expenses policies if they exist
DROP POLICY IF EXISTS "Users can insert own organization expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update own organization expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete own organization expenses" ON expenses;

-- Create new expenses policies
CREATE POLICY "Users can insert own organization expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own organization expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own organization expenses"
  ON expenses FOR DELETE
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));