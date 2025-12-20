/*
  # Fix Expenses RLS Policies for Multi-Role Access
  
  1. Changes
    - Drop old RLS policies for expenses table
    - Create new policies that check organization_id
    - Allow receptionist, customer_service, and admin roles to view expenses
    - Only admin can create, update, and delete expenses
  
  2. Security
    - All policies now check organization_id for proper data isolation
    - Receptionist and customer service can view expenses (read-only)
    - Admin has full access
*/

DROP POLICY IF EXISTS "Users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Users can create expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete expenses" ON expenses;

CREATE POLICY "Admin, customer service, and receptionist can view expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin can create expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can delete expenses"
  ON expenses FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view expense installments" ON expense_installments;
DROP POLICY IF EXISTS "Users can update expense installments" ON expense_installments;

CREATE POLICY "All authenticated users can view expense installments"
  ON expense_installments FOR SELECT
  TO authenticated
  USING (
    expense_id IN (
      SELECT id FROM expenses WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admin can update expense installments"
  ON expense_installments FOR UPDATE
  TO authenticated
  USING (
    expense_id IN (
      SELECT id FROM expenses WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
      )
    )
  )
  WITH CHECK (
    expense_id IN (
      SELECT id FROM expenses WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );
