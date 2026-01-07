/*
  # Fix All SELECT Policies to Require Permissions

  1. Problem
    - Most tables have SELECT policies that only check organization_id
    - Users can view data without proper permission checks
    - Inconsistent with INSERT/UPDATE/DELETE policies
  
  2. Solution
    - Update all SELECT policies to require appropriate view permissions
    - Maintain organization_id check for multi-tenancy
    - Keep deleted_at checks where applicable
  
  3. Tables Fixed
    - customers → requires customers.view
    - vehicles → requires vehicles.view
    - technicians → requires technicians.view
    - work_orders → requires work_orders.view
    - work_order_services → requires work_orders.view
    - invoices → requires invoices.view
    - invoice_items → requires invoices.view
    - expenses → requires expenses.view
    - expense_installments → requires expenses.view
    - salaries → requires salaries.view
    - technician_assignments → requires technicians.view
  
  4. Security
    - Enforces permission-based access control
    - Consistent security model across all tables
*/

-- CUSTOMERS
DROP POLICY IF EXISTS "Users can view customers in organization" ON customers;
CREATE POLICY "Users can view customers with permission"
  ON customers FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND deleted_at IS NULL
    AND user_has_permission(auth.uid(), 'customers.view')
  );

-- VEHICLES
DROP POLICY IF EXISTS "Users can view vehicles in organization" ON vehicles;
CREATE POLICY "Users can view vehicles with permission"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
      AND deleted_at IS NULL
    )
    AND deleted_at IS NULL
    AND user_has_permission(auth.uid(), 'vehicles.view')
  );

-- TECHNICIANS
DROP POLICY IF EXISTS "Users can view technicians in organization" ON technicians;
CREATE POLICY "Users can view technicians with permission"
  ON technicians FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND deleted_at IS NULL
    AND user_has_permission(auth.uid(), 'technicians.view')
  );

-- TECHNICIAN ASSIGNMENTS (uses service_id, not work_order_id)
DROP POLICY IF EXISTS "Users can view technician assignments in organization" ON technician_assignments;
CREATE POLICY "Users can view technician assignments with permission"
  ON technician_assignments FOR SELECT
  TO authenticated
  USING (
    service_id IN (
      SELECT wos.id FROM work_order_services wos
      JOIN work_orders wo ON wos.work_order_id = wo.id
      WHERE wo.organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
      AND wo.deleted_at IS NULL
    )
    AND user_has_permission(auth.uid(), 'technicians.view')
  );

-- WORK ORDERS
DROP POLICY IF EXISTS "Users can view work orders in organization" ON work_orders;
CREATE POLICY "Users can view work orders with permission"
  ON work_orders FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND deleted_at IS NULL
    AND user_has_permission(auth.uid(), 'work_orders.view')
  );

-- WORK ORDER SERVICES
DROP POLICY IF EXISTS "Users can view work order services in organization" ON work_order_services;
CREATE POLICY "Users can view work order services with permission"
  ON work_order_services FOR SELECT
  TO authenticated
  USING (
    work_order_id IN (
      SELECT id FROM work_orders 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
      AND deleted_at IS NULL
    )
    AND user_has_permission(auth.uid(), 'work_orders.view')
  );

-- INVOICES
DROP POLICY IF EXISTS "Users can view invoices in organization" ON invoices;
CREATE POLICY "Users can view invoices with permission"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND deleted_at IS NULL
    AND user_has_permission(auth.uid(), 'invoices.view')
  );

-- INVOICE ITEMS
DROP POLICY IF EXISTS "Users can view invoice items in organization" ON invoice_items;
CREATE POLICY "Users can view invoice items with permission"
  ON invoice_items FOR SELECT
  TO authenticated
  USING (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
      AND deleted_at IS NULL
    )
    AND user_has_permission(auth.uid(), 'invoices.view')
  );

-- EXPENSES
DROP POLICY IF EXISTS "Users can view expenses in organization" ON expenses;
CREATE POLICY "Users can view expenses with permission"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND deleted_at IS NULL
    AND user_has_permission(auth.uid(), 'expenses.view')
  );

-- EXPENSE INSTALLMENTS
DROP POLICY IF EXISTS "Users can view expense installments in organization" ON expense_installments;
CREATE POLICY "Users can view expense installments with permission"
  ON expense_installments FOR SELECT
  TO authenticated
  USING (
    expense_id IN (
      SELECT id FROM expenses 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
      AND deleted_at IS NULL
    )
    AND user_has_permission(auth.uid(), 'expenses.view')
  );

-- SALARIES
DROP POLICY IF EXISTS "Users can view salaries in organization" ON salaries;
CREATE POLICY "Users can view salaries with permission"
  ON salaries FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'salaries.view')
  );
