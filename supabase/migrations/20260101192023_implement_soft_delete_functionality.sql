/*
  # Implement Soft Delete Functionality

  1. Soft Delete Columns Added
    - deleted_at (timestamptz): When the record was soft deleted
    - deleted_by (uuid): Who deleted the record
    - These columns are added to major tables:
      * work_orders
      * invoices
      * customers
      * vehicles
      * spare_parts
      * technicians
      * expenses

  2. Views for Active Records
    - Creates views that automatically filter out deleted records
    - Simplifies application queries
    - Maintains backward compatibility

  3. Triggers for Cascade Soft Delete
    - When a customer is soft deleted, their vehicles are also soft deleted
    - When a work order is soft deleted, related invoices are also soft deleted
    - Maintains referential integrity with soft deletes

  4. Benefits
    - Data recovery: Can restore deleted records
    - Audit trail: Know who deleted what and when
    - Legal compliance: Maintain data history
    - Referential integrity: Prevent orphaned records
    - No data loss: Never actually delete data

  5. Usage
    - Application can continue using existing tables
    - Or use the _active views for automatic filtering
    - To soft delete: UPDATE table SET deleted_at = NOW(), deleted_by = auth.uid() WHERE id = ?
    - To restore: UPDATE table SET deleted_at = NULL, deleted_by = NULL WHERE id = ?
*/

-- =====================================================
-- ADD SOFT DELETE COLUMNS
-- =====================================================

-- Add soft delete columns to work_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN deleted_at timestamptz;
    ALTER TABLE work_orders ADD COLUMN deleted_by uuid REFERENCES users(id);
    CREATE INDEX idx_work_orders_deleted_at ON work_orders(deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

-- Add soft delete columns to invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE invoices ADD COLUMN deleted_at timestamptz;
    ALTER TABLE invoices ADD COLUMN deleted_by uuid REFERENCES users(id);
    CREATE INDEX idx_invoices_deleted_at ON invoices(deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

-- Add soft delete columns to customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE customers ADD COLUMN deleted_at timestamptz;
    ALTER TABLE customers ADD COLUMN deleted_by uuid REFERENCES users(id);
    CREATE INDEX idx_customers_deleted_at ON customers(deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

-- Add soft delete columns to vehicles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN deleted_at timestamptz;
    ALTER TABLE vehicles ADD COLUMN deleted_by uuid REFERENCES users(id);
    CREATE INDEX idx_vehicles_deleted_at ON vehicles(deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

-- Add soft delete columns to spare_parts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'spare_parts' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE spare_parts ADD COLUMN deleted_at timestamptz;
    ALTER TABLE spare_parts ADD COLUMN deleted_by uuid REFERENCES users(id);
    CREATE INDEX idx_spare_parts_deleted_at ON spare_parts(deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

-- Add soft delete columns to technicians
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'technicians' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE technicians ADD COLUMN deleted_at timestamptz;
    ALTER TABLE technicians ADD COLUMN deleted_by uuid REFERENCES users(id);
    CREATE INDEX idx_technicians_deleted_at ON technicians(deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

-- Add soft delete columns to expenses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expenses' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE expenses ADD COLUMN deleted_at timestamptz;
    ALTER TABLE expenses ADD COLUMN deleted_by uuid REFERENCES users(id);
    CREATE INDEX idx_expenses_deleted_at ON expenses(deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

-- =====================================================
-- CREATE VIEWS FOR ACTIVE RECORDS ONLY
-- =====================================================

-- View: work_orders_active (only non-deleted work orders)
CREATE OR REPLACE VIEW work_orders_active AS
SELECT * FROM work_orders WHERE deleted_at IS NULL;

-- View: invoices_active (only non-deleted invoices)
CREATE OR REPLACE VIEW invoices_active AS
SELECT * FROM invoices WHERE deleted_at IS NULL;

-- View: customers_active (only non-deleted customers)
CREATE OR REPLACE VIEW customers_active AS
SELECT * FROM customers WHERE deleted_at IS NULL;

-- View: vehicles_active (only non-deleted vehicles)
CREATE OR REPLACE VIEW vehicles_active AS
SELECT * FROM vehicles WHERE deleted_at IS NULL;

-- View: spare_parts_active (only non-deleted spare parts)
CREATE OR REPLACE VIEW spare_parts_active AS
SELECT * FROM spare_parts WHERE deleted_at IS NULL;

-- View: technicians_active (only non-deleted technicians)
CREATE OR REPLACE VIEW technicians_active AS
SELECT * FROM technicians WHERE deleted_at IS NULL;

-- View: expenses_active (only non-deleted expenses)
CREATE OR REPLACE VIEW expenses_active AS
SELECT * FROM expenses WHERE deleted_at IS NULL;

-- Grant SELECT on active views
GRANT SELECT ON work_orders_active TO authenticated;
GRANT SELECT ON invoices_active TO authenticated;
GRANT SELECT ON customers_active TO authenticated;
GRANT SELECT ON vehicles_active TO authenticated;
GRANT SELECT ON spare_parts_active TO authenticated;
GRANT SELECT ON technicians_active TO authenticated;
GRANT SELECT ON expenses_active TO authenticated;

-- =====================================================
-- CASCADE SOFT DELETE TRIGGERS
-- =====================================================

-- Function: Cascade soft delete when customer is deleted
CREATE OR REPLACE FUNCTION cascade_soft_delete_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    -- Soft delete all vehicles for this customer
    UPDATE vehicles
    SET 
      deleted_at = NEW.deleted_at,
      deleted_by = NEW.deleted_by
    WHERE customer_id = NEW.id
      AND deleted_at IS NULL;
    
    -- Soft delete all work orders for this customer
    UPDATE work_orders
    SET 
      deleted_at = NEW.deleted_at,
      deleted_by = NEW.deleted_by
    WHERE customer_id = NEW.id
      AND deleted_at IS NULL;
  ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    -- Restore vehicles and work orders when customer is restored
    UPDATE vehicles
    SET 
      deleted_at = NULL,
      deleted_by = NULL
    WHERE customer_id = NEW.id
      AND deleted_by = OLD.deleted_by;
    
    UPDATE work_orders
    SET 
      deleted_at = NULL,
      deleted_by = NULL
    WHERE customer_id = NEW.id
      AND deleted_by = OLD.deleted_by;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger: Cascade soft delete for customers
DROP TRIGGER IF EXISTS trigger_cascade_soft_delete_customer ON customers;
CREATE TRIGGER trigger_cascade_soft_delete_customer
  AFTER UPDATE OF deleted_at ON customers
  FOR EACH ROW
  EXECUTE FUNCTION cascade_soft_delete_customer();

-- Function: Cascade soft delete when work order is deleted
CREATE OR REPLACE FUNCTION cascade_soft_delete_work_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    -- Soft delete all invoices for this work order
    UPDATE invoices
    SET 
      deleted_at = NEW.deleted_at,
      deleted_by = NEW.deleted_by
    WHERE work_order_id = NEW.id
      AND deleted_at IS NULL;
  ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    -- Restore invoices when work order is restored
    UPDATE invoices
    SET 
      deleted_at = NULL,
      deleted_by = NULL
    WHERE work_order_id = NEW.id
      AND deleted_by = OLD.deleted_by;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger: Cascade soft delete for work orders
DROP TRIGGER IF EXISTS trigger_cascade_soft_delete_work_order ON work_orders;
CREATE TRIGGER trigger_cascade_soft_delete_work_order
  AFTER UPDATE OF deleted_at ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION cascade_soft_delete_work_order();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function: Soft delete a work order
CREATE OR REPLACE FUNCTION soft_delete_work_order(work_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE work_orders
  SET 
    deleted_at = NOW(),
    deleted_by = auth.uid()
  WHERE id = work_order_id
    AND deleted_at IS NULL;
END;
$$;

-- Function: Restore a soft deleted work order
CREATE OR REPLACE FUNCTION restore_work_order(work_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE work_orders
  SET 
    deleted_at = NULL,
    deleted_by = NULL
  WHERE id = work_order_id
    AND deleted_at IS NOT NULL;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION soft_delete_work_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_work_order(uuid) TO authenticated;

-- Add helpful comments
COMMENT ON COLUMN work_orders.deleted_at IS 'Timestamp when this work order was soft deleted. NULL means active.';
COMMENT ON COLUMN work_orders.deleted_by IS 'User who soft deleted this work order.';
COMMENT ON VIEW work_orders_active IS 'View showing only active (non-deleted) work orders. Use this for normal queries.';
COMMENT ON FUNCTION cascade_soft_delete_customer() IS 'Automatically soft deletes related vehicles and work orders when a customer is deleted.';
COMMENT ON FUNCTION cascade_soft_delete_work_order() IS 'Automatically soft deletes related invoices when a work order is deleted.';
COMMENT ON FUNCTION soft_delete_work_order(uuid) IS 'Helper function to soft delete a work order.';
COMMENT ON FUNCTION restore_work_order(uuid) IS 'Helper function to restore a soft deleted work order.';
