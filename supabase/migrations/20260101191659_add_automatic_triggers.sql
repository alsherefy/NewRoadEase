/*
  # Add Automatic Triggers for Data Integrity and Automation

  1. Triggers for Spare Parts Inventory
    - Automatically decrease spare parts quantity when added to work orders
    - Automatically increase spare parts quantity when removed from work orders
    - Prevent negative inventory with validation
  
  2. Triggers for Work Order Costs
    - Automatically update work_orders.total_labor_cost when services are added/updated/deleted
    - Keep costs in sync without manual calculation
  
  3. Triggers for Invoice Items
    - Automatically calculate invoice.subtotal when items change
    - Keep invoice totals accurate
  
  4. Benefits
    - Eliminates manual cost calculations
    - Prevents inventory discrepancies
    - Ensures data consistency
    - Reduces application logic complexity
    - Real-time updates

  These triggers will run automatically on INSERT, UPDATE, and DELETE operations.
*/

-- =====================================================
-- SPARE PARTS INVENTORY MANAGEMENT TRIGGERS
-- =====================================================

-- Function: Update spare parts inventory when work order spare parts change
CREATE OR REPLACE FUNCTION update_spare_parts_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Handle INSERT: decrease inventory
  IF TG_OP = 'INSERT' THEN
    UPDATE spare_parts
    SET 
      quantity = quantity - NEW.quantity,
      updated_at = NOW()
    WHERE id = NEW.spare_part_id;
    
    -- Check if inventory went negative
    IF (SELECT quantity FROM spare_parts WHERE id = NEW.spare_part_id) < 0 THEN
      RAISE EXCEPTION 'Insufficient inventory for spare part. Available: %, Requested: %', 
        (SELECT quantity + NEW.quantity FROM spare_parts WHERE id = NEW.spare_part_id), 
        NEW.quantity;
    END IF;
    
    RETURN NEW;
  
  -- Handle UPDATE: adjust inventory based on quantity difference
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only update if quantity or spare_part_id changed
    IF NEW.quantity != OLD.quantity OR NEW.spare_part_id != OLD.spare_part_id THEN
      -- Restore old quantity to original part
      UPDATE spare_parts
      SET 
        quantity = quantity + OLD.quantity,
        updated_at = NOW()
      WHERE id = OLD.spare_part_id;
      
      -- Deduct new quantity from new part
      UPDATE spare_parts
      SET 
        quantity = quantity - NEW.quantity,
        updated_at = NOW()
      WHERE id = NEW.spare_part_id;
      
      -- Check if inventory went negative
      IF (SELECT quantity FROM spare_parts WHERE id = NEW.spare_part_id) < 0 THEN
        RAISE EXCEPTION 'Insufficient inventory for spare part. Available: %, Requested: %', 
          (SELECT quantity + NEW.quantity FROM spare_parts WHERE id = NEW.spare_part_id), 
          NEW.quantity;
      END IF;
    END IF;
    
    RETURN NEW;
  
  -- Handle DELETE: restore inventory
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE spare_parts
    SET 
      quantity = quantity + OLD.quantity,
      updated_at = NOW()
    WHERE id = OLD.spare_part_id;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create trigger for spare parts inventory updates
DROP TRIGGER IF EXISTS trigger_update_spare_parts_inventory ON work_order_spare_parts;
CREATE TRIGGER trigger_update_spare_parts_inventory
  AFTER INSERT OR UPDATE OR DELETE ON work_order_spare_parts
  FOR EACH ROW
  EXECUTE FUNCTION update_spare_parts_inventory();

-- =====================================================
-- WORK ORDER COST CALCULATION TRIGGERS
-- =====================================================

-- Function: Update work order total labor cost
CREATE OR REPLACE FUNCTION update_work_order_labor_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_work_order_id uuid;
  v_total_cost numeric;
BEGIN
  -- Determine which work order to update
  IF TG_OP = 'DELETE' THEN
    v_work_order_id := OLD.work_order_id;
  ELSE
    v_work_order_id := NEW.work_order_id;
  END IF;
  
  -- Calculate total labor cost for the work order
  SELECT COALESCE(SUM(labor_cost), 0)
  INTO v_total_cost
  FROM work_order_services
  WHERE work_order_id = v_work_order_id;
  
  -- Update work order
  UPDATE work_orders
  SET 
    total_labor_cost = v_total_cost,
    updated_at = NOW()
  WHERE id = v_work_order_id;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger for work order labor cost updates
DROP TRIGGER IF EXISTS trigger_update_work_order_labor_cost ON work_order_services;
CREATE TRIGGER trigger_update_work_order_labor_cost
  AFTER INSERT OR UPDATE OR DELETE ON work_order_services
  FOR EACH ROW
  EXECUTE FUNCTION update_work_order_labor_cost();

-- =====================================================
-- INVOICE SUBTOTAL CALCULATION TRIGGERS
-- =====================================================

-- Function: Update invoice subtotal when items change
CREATE OR REPLACE FUNCTION update_invoice_subtotal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_id uuid;
  v_subtotal numeric;
  v_discount_amount numeric;
  v_discount_percentage numeric;
  v_tax_rate numeric;
  v_tax_amount numeric;
  v_total numeric;
BEGIN
  -- Determine which invoice to update
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;
  
  -- Calculate subtotal from invoice items
  SELECT COALESCE(SUM(total), 0)
  INTO v_subtotal
  FROM invoice_items
  WHERE invoice_id = v_invoice_id;
  
  -- Get current discount and tax settings
  SELECT 
    COALESCE(discount_percentage, 0),
    COALESCE(tax_rate, 0)
  INTO v_discount_percentage, v_tax_rate
  FROM invoices
  WHERE id = v_invoice_id;
  
  -- Calculate discount amount
  v_discount_amount := v_subtotal * (v_discount_percentage / 100);
  
  -- Calculate tax amount (after discount)
  v_tax_amount := (v_subtotal - v_discount_amount) * (v_tax_rate / 100);
  
  -- Calculate final total
  v_total := v_subtotal - v_discount_amount + v_tax_amount;
  
  -- Update invoice
  UPDATE invoices
  SET 
    subtotal = v_subtotal,
    discount_amount = v_discount_amount,
    tax_amount = v_tax_amount,
    total = v_total,
    updated_at = NOW()
  WHERE id = v_invoice_id;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger for invoice subtotal updates
DROP TRIGGER IF EXISTS trigger_update_invoice_subtotal ON invoice_items;
CREATE TRIGGER trigger_update_invoice_subtotal
  AFTER INSERT OR UPDATE OR DELETE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_subtotal();

-- =====================================================
-- INVOICE RECALCULATION ON DISCOUNT/TAX CHANGES
-- =====================================================

-- Function: Recalculate invoice totals when discount or tax changes
CREATE OR REPLACE FUNCTION recalculate_invoice_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_discount_amount numeric;
  v_tax_amount numeric;
  v_total numeric;
BEGIN
  -- Only recalculate if discount_percentage or tax_rate changed
  IF NEW.discount_percentage != OLD.discount_percentage OR NEW.tax_rate != OLD.tax_rate THEN
    -- Calculate discount amount
    v_discount_amount := NEW.subtotal * (NEW.discount_percentage / 100);
    
    -- Calculate tax amount (after discount)
    v_tax_amount := (NEW.subtotal - v_discount_amount) * (NEW.tax_rate / 100);
    
    -- Calculate final total
    v_total := NEW.subtotal - v_discount_amount + v_tax_amount;
    
    -- Update the NEW record with calculated values
    NEW.discount_amount := v_discount_amount;
    NEW.tax_amount := v_tax_amount;
    NEW.total := v_total;
    NEW.updated_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for invoice recalculation
DROP TRIGGER IF EXISTS trigger_recalculate_invoice_totals ON invoices;
CREATE TRIGGER trigger_recalculate_invoice_totals
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_invoice_totals();

-- =====================================================
-- WORK ORDER UPDATED_AT TRIGGER
-- =====================================================

-- Function: Update work order updated_at timestamp
CREATE OR REPLACE FUNCTION update_work_order_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE work_orders
  SET updated_at = NOW()
  WHERE id = NEW.work_order_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger for work order timestamp on spare parts changes
DROP TRIGGER IF EXISTS trigger_update_work_order_timestamp_spare_parts ON work_order_spare_parts;
CREATE TRIGGER trigger_update_work_order_timestamp_spare_parts
  AFTER INSERT OR UPDATE OR DELETE ON work_order_spare_parts
  FOR EACH ROW
  EXECUTE FUNCTION update_work_order_timestamp();

-- Add helpful comments
COMMENT ON FUNCTION update_spare_parts_inventory() IS 'Automatically updates spare parts inventory when added/removed from work orders. Prevents negative inventory.';
COMMENT ON FUNCTION update_work_order_labor_cost() IS 'Automatically calculates and updates work order total labor cost when services change.';
COMMENT ON FUNCTION update_invoice_subtotal() IS 'Automatically calculates and updates invoice subtotal, tax, and total when items change.';
COMMENT ON FUNCTION recalculate_invoice_totals() IS 'Recalculates invoice totals when discount percentage or tax rate changes.';
COMMENT ON FUNCTION update_work_order_timestamp() IS 'Updates work order timestamp when spare parts are modified.';
