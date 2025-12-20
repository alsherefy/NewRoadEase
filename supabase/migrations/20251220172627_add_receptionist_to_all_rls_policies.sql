/*
  # Add Receptionist Role to All RLS Policies

  ## Problem
  Multiple tables have UPDATE and DELETE policies that only check for 'admin' and 'customer_service' roles,
  excluding 'receptionist' users from modifying data even when they have proper permissions.

  ## Changes
  Update RLS policies for the following tables to include 'receptionist' role:
  1. work_orders - UPDATE & DELETE policies
  2. work_order_services - UPDATE & DELETE policies
  3. technician_assignments - UPDATE & DELETE policies
  4. invoices - UPDATE & DELETE policies
  5. invoice_items - UPDATE & DELETE policies

  ## Security
  - Maintains organization-level data isolation
  - Only authenticated users with staff roles can modify data
  - All policies still check organization_id for multi-tenancy
*/

-- ============================================
-- WORK ORDERS TABLE
-- ============================================

DROP POLICY IF EXISTS "Admins and CS can update own organization work orders" ON work_orders;
CREATE POLICY "Staff users can update own organization work orders"
  ON work_orders
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT users.organization_id
      FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'customer_service', 'receptionist')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT users.organization_id
      FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'customer_service', 'receptionist')
    )
  );

DROP POLICY IF EXISTS "Admins and CS can delete own organization work orders" ON work_orders;
CREATE POLICY "Staff users can delete own organization work orders"
  ON work_orders
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT users.organization_id
      FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'customer_service', 'receptionist')
    )
  );

-- ============================================
-- WORK ORDER SERVICES TABLE
-- ============================================

DROP POLICY IF EXISTS "Admins and CS can update own organization work order services" ON work_order_services;
CREATE POLICY "Staff users can update own organization work order services"
  ON work_order_services
  FOR UPDATE
  TO authenticated
  USING (
    work_order_id IN (
      SELECT work_orders.id
      FROM work_orders
      WHERE work_orders.organization_id IN (
        SELECT users.organization_id
        FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'customer_service', 'receptionist')
      )
    )
  );

DROP POLICY IF EXISTS "Admins and CS can delete own organization work order services" ON work_order_services;
CREATE POLICY "Staff users can delete own organization work order services"
  ON work_order_services
  FOR DELETE
  TO authenticated
  USING (
    work_order_id IN (
      SELECT work_orders.id
      FROM work_orders
      WHERE work_orders.organization_id IN (
        SELECT users.organization_id
        FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'customer_service', 'receptionist')
      )
    )
  );

-- ============================================
-- TECHNICIAN ASSIGNMENTS TABLE
-- ============================================

DROP POLICY IF EXISTS "Admins and CS can update own organization technician assignment" ON technician_assignments;
CREATE POLICY "Staff users can update own organization technician assignments"
  ON technician_assignments
  FOR UPDATE
  TO authenticated
  USING (
    service_id IN (
      SELECT work_order_services.id
      FROM work_order_services
      WHERE work_order_services.work_order_id IN (
        SELECT work_orders.id
        FROM work_orders
        WHERE work_orders.organization_id IN (
          SELECT users.organization_id
          FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('admin', 'customer_service', 'receptionist')
        )
      )
    )
  );

DROP POLICY IF EXISTS "Admins and CS can delete own organization technician assignment" ON technician_assignments;
CREATE POLICY "Staff users can delete own organization technician assignments"
  ON technician_assignments
  FOR DELETE
  TO authenticated
  USING (
    service_id IN (
      SELECT work_order_services.id
      FROM work_order_services
      WHERE work_order_services.work_order_id IN (
        SELECT work_orders.id
        FROM work_orders
        WHERE work_orders.organization_id IN (
          SELECT users.organization_id
          FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('admin', 'customer_service', 'receptionist')
        )
      )
    )
  );

-- ============================================
-- INVOICES TABLE
-- ============================================

DROP POLICY IF EXISTS "Admins and CS can update own organization invoices" ON invoices;
CREATE POLICY "Staff users can update own organization invoices"
  ON invoices
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT users.organization_id
      FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'customer_service', 'receptionist')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT users.organization_id
      FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'customer_service', 'receptionist')
    )
  );

DROP POLICY IF EXISTS "Admins and CS can delete own organization invoices" ON invoices;
CREATE POLICY "Staff users can delete own organization invoices"
  ON invoices
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT users.organization_id
      FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'customer_service', 'receptionist')
    )
  );

-- ============================================
-- INVOICE ITEMS TABLE
-- ============================================

DROP POLICY IF EXISTS "Admins and CS can update own organization invoice items" ON invoice_items;
CREATE POLICY "Staff users can update own organization invoice items"
  ON invoice_items
  FOR UPDATE
  TO authenticated
  USING (
    invoice_id IN (
      SELECT invoices.id
      FROM invoices
      WHERE invoices.organization_id IN (
        SELECT users.organization_id
        FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'customer_service', 'receptionist')
      )
    )
  );

DROP POLICY IF EXISTS "Admins and CS can delete own organization invoice items" ON invoice_items;
CREATE POLICY "Staff users can delete own organization invoice items"
  ON invoice_items
  FOR DELETE
  TO authenticated
  USING (
    invoice_id IN (
      SELECT invoices.id
      FROM invoices
      WHERE invoices.organization_id IN (
        SELECT users.organization_id
        FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'customer_service', 'receptionist')
      )
    )
  );
