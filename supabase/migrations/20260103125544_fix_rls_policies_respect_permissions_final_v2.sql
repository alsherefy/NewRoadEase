/*
  # Fix RLS Policies to Respect RBAC Permissions - Complete Solution

  ## Problem Identified
  Multiple conflicting RLS policies exist on core tables, causing permission checks to be bypassed.
  Since RLS policies work with OR logic, any permissive policy allows the action.
  
  ## Root Cause
  - Policies like "Users can update own organization X" allow all org members without checking permissions
  - These policies conflict with "Users can update X with permission" policies
  - Result: Permission system is completely bypassed
  
  ## Solution Applied
  1. **DROP all conflicting policies** that don't check user permissions
  2. **CREATE new permission-based policies** for all tables:
     - SELECT: Allow viewing organization data (no permission check needed for viewing)
     - INSERT: Require `resource.create` permission
     - UPDATE: Require `resource.update` permission  
     - DELETE: Require `resource.delete` permission
  
  ## Tables Fixed
  - customers
  - vehicles
  - work_orders
  - work_order_services
  - work_order_spare_parts
  - invoices
  - invoice_items
  - spare_parts
  - expenses
  - expense_installments
  - salaries
  - technicians
  - technician_assignments
  
  ## Security Notes
  - All policies enforce organization isolation
  - All write operations require explicit permissions
  - Admin users automatically have all permissions (checked in user_has_permission function)
  - Soft-deleted records are excluded from queries
*/

-- ==========================================
-- CUSTOMERS TABLE
-- ==========================================

DROP POLICY IF EXISTS "Users can view own organization customers" ON customers;
DROP POLICY IF EXISTS "Users can insert own organization customers" ON customers;
DROP POLICY IF EXISTS "Users can update own organization customers" ON customers;
DROP POLICY IF EXISTS "Users can update customers with permission" ON customers;
DROP POLICY IF EXISTS "Users can delete own organization customers" ON customers;
DROP POLICY IF EXISTS "Users can delete customers with permission" ON customers;

CREATE POLICY "Users can view customers in organization"
  ON customers FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND deleted_at IS NULL
  );

CREATE POLICY "Users can create customers with permission"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'customers.create')
  );

CREATE POLICY "Users can update customers with permission"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'customers.update')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'customers.update')
  );

CREATE POLICY "Users can delete customers with permission"
  ON customers FOR DELETE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'customers.delete')
  );

-- ==========================================
-- VEHICLES TABLE
-- ==========================================

DROP POLICY IF EXISTS "Users can view vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can view own organization vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can insert own organization vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can manage vehicles" ON vehicles;

CREATE POLICY "Users can view vehicles in organization"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND deleted_at IS NULL
  );

CREATE POLICY "Users can create vehicles with permission"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'customers.create')
  );

CREATE POLICY "Users can update vehicles with permission"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'customers.update')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'customers.update')
  );

CREATE POLICY "Users can delete vehicles with permission"
  ON vehicles FOR DELETE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'customers.delete')
  );

-- ==========================================
-- WORK_ORDERS TABLE
-- ==========================================

DROP POLICY IF EXISTS "Users can view own organization work orders" ON work_orders;
DROP POLICY IF EXISTS "Users can insert own organization work orders" ON work_orders;
DROP POLICY IF EXISTS "Users can update own organization work orders" ON work_orders;
DROP POLICY IF EXISTS "Users can update work orders with permission" ON work_orders;
DROP POLICY IF EXISTS "Users can delete own organization work orders" ON work_orders;
DROP POLICY IF EXISTS "Users can delete work orders with permission" ON work_orders;

CREATE POLICY "Users can view work orders in organization"
  ON work_orders FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND deleted_at IS NULL
  );

CREATE POLICY "Users can create work orders with permission"
  ON work_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'work_orders.create')
  );

CREATE POLICY "Users can update work orders with permission"
  ON work_orders FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'work_orders.update')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'work_orders.update')
  );

CREATE POLICY "Users can delete work orders with permission"
  ON work_orders FOR DELETE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'work_orders.delete')
  );

-- ==========================================
-- WORK_ORDER_SERVICES TABLE
-- ==========================================

DROP POLICY IF EXISTS "Users can view work order services" ON work_order_services;
DROP POLICY IF EXISTS "Users can view own organization work order services" ON work_order_services;
DROP POLICY IF EXISTS "Users can insert own organization work order services" ON work_order_services;
DROP POLICY IF EXISTS "Users can manage work order services" ON work_order_services;

CREATE POLICY "Users can view work order services in organization"
  ON work_order_services FOR SELECT
  TO authenticated
  USING (
    work_order_id IN (
      SELECT id FROM work_orders 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
      AND deleted_at IS NULL
    )
  );

CREATE POLICY "Users can create work order services with permission"
  ON work_order_services FOR INSERT
  TO authenticated
  WITH CHECK (
    work_order_id IN (
      SELECT id FROM work_orders 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND user_has_permission(auth.uid(), 'work_orders.create')
  );

CREATE POLICY "Users can update work order services with permission"
  ON work_order_services FOR UPDATE
  TO authenticated
  USING (
    work_order_id IN (
      SELECT id FROM work_orders 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
      AND deleted_at IS NULL
    )
    AND user_has_permission(auth.uid(), 'work_orders.update')
  )
  WITH CHECK (
    work_order_id IN (
      SELECT id FROM work_orders 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND user_has_permission(auth.uid(), 'work_orders.update')
  );

CREATE POLICY "Users can delete work order services with permission"
  ON work_order_services FOR DELETE
  TO authenticated
  USING (
    work_order_id IN (
      SELECT id FROM work_orders 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND user_has_permission(auth.uid(), 'work_orders.delete')
  );

-- ==========================================
-- INVOICES TABLE
-- ==========================================

DROP POLICY IF EXISTS "Users can view own organization invoices" ON invoices;
DROP POLICY IF EXISTS "Users can insert own organization invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update own organization invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices with permission" ON invoices;
DROP POLICY IF EXISTS "Users can delete own organization invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete invoices with permission" ON invoices;

CREATE POLICY "Users can view invoices in organization"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND deleted_at IS NULL
  );

CREATE POLICY "Users can create invoices with permission"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'invoices.create')
  );

CREATE POLICY "Users can update invoices with permission"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'invoices.update')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'invoices.update')
  );

CREATE POLICY "Users can delete invoices with permission"
  ON invoices FOR DELETE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'invoices.delete')
  );

-- ==========================================
-- INVOICE_ITEMS TABLE
-- ==========================================

DROP POLICY IF EXISTS "Users can view invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Users can view own organization invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Users can insert own organization invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Users can update own organization invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Users can update invoice items with permission" ON invoice_items;
DROP POLICY IF EXISTS "Users can delete own organization invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Users can delete invoice items with permission" ON invoice_items;
DROP POLICY IF EXISTS "Users can manage invoice items" ON invoice_items;

CREATE POLICY "Users can view invoice items in organization"
  ON invoice_items FOR SELECT
  TO authenticated
  USING (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
      AND deleted_at IS NULL
    )
  );

CREATE POLICY "Users can create invoice items with permission"
  ON invoice_items FOR INSERT
  TO authenticated
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND user_has_permission(auth.uid(), 'invoices.create')
  );

CREATE POLICY "Users can update invoice items with permission"
  ON invoice_items FOR UPDATE
  TO authenticated
  USING (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
      AND deleted_at IS NULL
    )
    AND user_has_permission(auth.uid(), 'invoices.update')
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND user_has_permission(auth.uid(), 'invoices.update')
  );

CREATE POLICY "Users can delete invoice items with permission"
  ON invoice_items FOR DELETE
  TO authenticated
  USING (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND user_has_permission(auth.uid(), 'invoices.delete')
  );

-- ==========================================
-- SPARE_PARTS TABLE
-- ==========================================

DROP POLICY IF EXISTS "Users can view spare parts" ON spare_parts;
DROP POLICY IF EXISTS "Users can manage spare parts" ON spare_parts;
DROP POLICY IF EXISTS "Allow all to read spare parts" ON spare_parts;
DROP POLICY IF EXISTS "Allow all to insert spare parts" ON spare_parts;
DROP POLICY IF EXISTS "Allow all to update spare parts" ON spare_parts;
DROP POLICY IF EXISTS "Allow all to delete spare parts" ON spare_parts;
DROP POLICY IF EXISTS "Users can update spare parts with permission" ON spare_parts;
DROP POLICY IF EXISTS "Users can delete spare parts with permission" ON spare_parts;

CREATE POLICY "Users can view spare parts in organization"
  ON spare_parts FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND deleted_at IS NULL
  );

CREATE POLICY "Users can create spare parts with permission"
  ON spare_parts FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'inventory.create')
  );

CREATE POLICY "Users can update spare parts with permission"
  ON spare_parts FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'inventory.update')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'inventory.update')
  );

CREATE POLICY "Users can delete spare parts with permission"
  ON spare_parts FOR DELETE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'inventory.delete')
  );

-- ==========================================
-- WORK_ORDER_SPARE_PARTS TABLE
-- ==========================================

DROP POLICY IF EXISTS "Users can view work order spare parts" ON work_order_spare_parts;
DROP POLICY IF EXISTS "Users can manage work order spare parts" ON work_order_spare_parts;
DROP POLICY IF EXISTS "Allow authenticated users to read work order spare parts" ON work_order_spare_parts;
DROP POLICY IF EXISTS "Allow authenticated users to insert work order spare parts" ON work_order_spare_parts;
DROP POLICY IF EXISTS "Allow authenticated users to update work order spare parts" ON work_order_spare_parts;
DROP POLICY IF EXISTS "Allow authenticated users to delete work order spare parts" ON work_order_spare_parts;

CREATE POLICY "Users can view work order spare parts in organization"
  ON work_order_spare_parts FOR SELECT
  TO authenticated
  USING (
    work_order_id IN (
      SELECT id FROM work_orders 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
      AND deleted_at IS NULL
    )
  );

CREATE POLICY "Users can create work order spare parts with permission"
  ON work_order_spare_parts FOR INSERT
  TO authenticated
  WITH CHECK (
    work_order_id IN (
      SELECT id FROM work_orders 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND user_has_permission(auth.uid(), 'work_orders.create')
  );

CREATE POLICY "Users can update work order spare parts with permission"
  ON work_order_spare_parts FOR UPDATE
  TO authenticated
  USING (
    work_order_id IN (
      SELECT id FROM work_orders 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
      AND deleted_at IS NULL
    )
    AND user_has_permission(auth.uid(), 'work_orders.update')
  )
  WITH CHECK (
    work_order_id IN (
      SELECT id FROM work_orders 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND user_has_permission(auth.uid(), 'work_orders.update')
  );

CREATE POLICY "Users can delete work order spare parts with permission"
  ON work_order_spare_parts FOR DELETE
  TO authenticated
  USING (
    work_order_id IN (
      SELECT id FROM work_orders 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND user_has_permission(auth.uid(), 'work_orders.delete')
  );

-- ==========================================
-- EXPENSES TABLE
-- ==========================================

DROP POLICY IF EXISTS "Users can view own organization expenses" ON expenses;
DROP POLICY IF EXISTS "Users can insert own organization expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update own organization expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update expenses with permission" ON expenses;
DROP POLICY IF EXISTS "Users can delete own organization expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete expenses with permission" ON expenses;

CREATE POLICY "Users can view expenses in organization"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND deleted_at IS NULL
  );

CREATE POLICY "Users can create expenses with permission"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'expenses.create')
  );

CREATE POLICY "Users can update expenses with permission"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'expenses.update')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'expenses.update')
  );

CREATE POLICY "Users can delete expenses with permission"
  ON expenses FOR DELETE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'expenses.delete')
  );

-- ==========================================
-- EXPENSE_INSTALLMENTS TABLE
-- ==========================================

DROP POLICY IF EXISTS "All authenticated users can view expense installments" ON expense_installments;
DROP POLICY IF EXISTS "Users can insert expense installments" ON expense_installments;
DROP POLICY IF EXISTS "Users can delete expense installments" ON expense_installments;
DROP POLICY IF EXISTS "Users can manage expense installments" ON expense_installments;

CREATE POLICY "Users can view expense installments in organization"
  ON expense_installments FOR SELECT
  TO authenticated
  USING (
    expense_id IN (
      SELECT id FROM expenses 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
      AND deleted_at IS NULL
    )
  );

CREATE POLICY "Users can create expense installments with permission"
  ON expense_installments FOR INSERT
  TO authenticated
  WITH CHECK (
    expense_id IN (
      SELECT id FROM expenses 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND user_has_permission(auth.uid(), 'expenses.create')
  );

CREATE POLICY "Users can update expense installments with permission"
  ON expense_installments FOR UPDATE
  TO authenticated
  USING (
    expense_id IN (
      SELECT id FROM expenses 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
      AND deleted_at IS NULL
    )
    AND user_has_permission(auth.uid(), 'expenses.update')
  )
  WITH CHECK (
    expense_id IN (
      SELECT id FROM expenses 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND user_has_permission(auth.uid(), 'expenses.update')
  );

CREATE POLICY "Users can delete expense installments with permission"
  ON expense_installments FOR DELETE
  TO authenticated
  USING (
    expense_id IN (
      SELECT id FROM expenses 
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND user_has_permission(auth.uid(), 'expenses.delete')
  );

-- ==========================================
-- SALARIES TABLE
-- ==========================================

DROP POLICY IF EXISTS "Allow authenticated users to read salaries" ON salaries;
DROP POLICY IF EXISTS "Allow authenticated users to insert salaries" ON salaries;
DROP POLICY IF EXISTS "Allow authenticated users to update salaries" ON salaries;
DROP POLICY IF EXISTS "Allow authenticated users to delete salaries" ON salaries;
DROP POLICY IF EXISTS "Users can view salaries" ON salaries;
DROP POLICY IF EXISTS "Users can manage salaries" ON salaries;

CREATE POLICY "Users can view salaries in organization"
  ON salaries FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can create salaries with permission"
  ON salaries FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'salaries.create')
  );

CREATE POLICY "Users can update salaries with permission"
  ON salaries FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'salaries.update')
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'salaries.update')
  );

CREATE POLICY "Users can delete salaries with permission"
  ON salaries FOR DELETE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'salaries.delete')
  );

-- ==========================================
-- TECHNICIANS TABLE
-- ==========================================

DROP POLICY IF EXISTS "Users can view technicians" ON technicians;
DROP POLICY IF EXISTS "Users can view own organization technicians" ON technicians;
DROP POLICY IF EXISTS "Users can insert own organization technicians" ON technicians;
DROP POLICY IF EXISTS "Users can manage technicians" ON technicians;

CREATE POLICY "Users can view technicians in organization"
  ON technicians FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND deleted_at IS NULL
  );

CREATE POLICY "Users can create technicians with permission"
  ON technicians FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'technicians.create')
  );

CREATE POLICY "Users can update technicians with permission"
  ON technicians FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'technicians.update')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'technicians.update')
  );

CREATE POLICY "Users can delete technicians with permission"
  ON technicians FOR DELETE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_permission(auth.uid(), 'technicians.delete')
  );

-- ==========================================
-- TECHNICIAN_ASSIGNMENTS TABLE
-- ==========================================

DROP POLICY IF EXISTS "Users can view technician assignments" ON technician_assignments;
DROP POLICY IF EXISTS "Users can view own organization technician assignments" ON technician_assignments;
DROP POLICY IF EXISTS "Users can insert own organization technician assignments" ON technician_assignments;
DROP POLICY IF EXISTS "Users can manage technician assignments" ON technician_assignments;

CREATE POLICY "Users can view technician assignments in organization"
  ON technician_assignments FOR SELECT
  TO authenticated
  USING (
    service_id IN (
      SELECT wos.id FROM work_order_services wos
      JOIN work_orders wo ON wos.work_order_id = wo.id
      WHERE wo.organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
      AND wo.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can create technician assignments with permission"
  ON technician_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    service_id IN (
      SELECT wos.id FROM work_order_services wos
      JOIN work_orders wo ON wos.work_order_id = wo.id
      WHERE wo.organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND user_has_permission(auth.uid(), 'work_orders.create')
  );

CREATE POLICY "Users can update technician assignments with permission"
  ON technician_assignments FOR UPDATE
  TO authenticated
  USING (
    service_id IN (
      SELECT wos.id FROM work_order_services wos
      JOIN work_orders wo ON wos.work_order_id = wo.id
      WHERE wo.organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
      AND wo.deleted_at IS NULL
    )
    AND user_has_permission(auth.uid(), 'work_orders.update')
  )
  WITH CHECK (
    service_id IN (
      SELECT wos.id FROM work_order_services wos
      JOIN work_orders wo ON wos.work_order_id = wo.id
      WHERE wo.organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND user_has_permission(auth.uid(), 'work_orders.update')
  );

CREATE POLICY "Users can delete technician assignments with permission"
  ON technician_assignments FOR DELETE
  TO authenticated
  USING (
    service_id IN (
      SELECT wos.id FROM work_order_services wos
      JOIN work_orders wo ON wos.work_order_id = wo.id
      WHERE wo.organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND user_has_permission(auth.uid(), 'work_orders.delete')
  );