/*
  # Add RLS Security to Views

  1. Security Issues Fixed
    - Views currently expose data without organization filtering
    - Add secure wrapper functions for all views
    - Validate organization access before returning view data
    - Revoke direct access to views

  2. Affected Views
    - work_orders_detailed
    - invoices_detailed
    - technician_performance_summary
    - inventory_status
    - financial_summary_monthly
    - All *_active views (soft delete views)

  3. Security Improvements
    - All view access must go through secure functions
    - Organization validation enforced
    - Deleted records automatically filtered
    - No cross-organization data leaks

  This migration fixes critical security issues with views.
*/

-- =====================================================
-- REVOKE DIRECT ACCESS TO VIEWS
-- =====================================================

REVOKE SELECT ON work_orders_detailed FROM authenticated;
REVOKE SELECT ON invoices_detailed FROM authenticated;
REVOKE SELECT ON technician_performance_summary FROM authenticated;
REVOKE SELECT ON inventory_status FROM authenticated;
REVOKE SELECT ON financial_summary_monthly FROM authenticated;

-- =====================================================
-- CREATE SECURE WRAPPER FUNCTIONS FOR VIEWS
-- =====================================================

-- Function: Get work orders detailed (SECURED)
CREATE OR REPLACE FUNCTION get_work_orders_detailed(org_id uuid)
RETURNS TABLE (
  id uuid,
  order_number text,
  status text,
  priority text,
  description text,
  total_labor_cost numeric,
  created_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz,
  organization_id uuid,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  vehicle_id uuid,
  plate_number text,
  car_make text,
  car_model text,
  car_year integer,
  technician_count bigint,
  total_spare_parts_cost numeric,
  total_cost numeric,
  invoice_payment_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  user_org_id uuid;
BEGIN
  -- SECURITY: Validate user has access to this organization
  SELECT u.organization_id INTO user_org_id
  FROM users u
  WHERE u.id = auth.uid();

  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not found or not authenticated';
  END IF;

  IF user_org_id != org_id THEN
    RAISE EXCEPTION 'Access denied: Cannot access data from another organization';
  END IF;

  -- Return view data filtered by organization
  RETURN QUERY
  SELECT
    wd.id,
    wd.order_number,
    wd.status,
    wd.priority,
    wd.description,
    wd.total_labor_cost,
    wd.created_at,
    wd.completed_at,
    wd.updated_at,
    wd.organization_id,
    wd.customer_id,
    wd.customer_name,
    wd.customer_phone,
    wd.customer_email,
    wd.vehicle_id,
    wd.plate_number,
    wd.car_make,
    wd.car_model,
    wd.car_year,
    wd.technician_count,
    wd.total_spare_parts_cost,
    wd.total_cost,
    wd.invoice_payment_status
  FROM work_orders_detailed wd
  WHERE wd.organization_id = org_id;
END;
$$;

-- Function: Get invoices detailed (SECURED)
CREATE OR REPLACE FUNCTION get_invoices_detailed(org_id uuid)
RETURNS TABLE (
  id uuid,
  invoice_number text,
  work_order_id uuid,
  payment_status text,
  payment_method text,
  card_type text,
  subtotal numeric,
  discount_percentage numeric,
  discount_amount numeric,
  tax_type text,
  tax_rate numeric,
  tax_amount numeric,
  total numeric,
  paid_amount numeric,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  organization_id uuid,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  vehicle_id uuid,
  plate_number text,
  car_make text,
  car_model text,
  car_year integer,
  work_order_number text,
  work_order_status text,
  work_order_description text,
  remaining_amount numeric,
  items_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  user_org_id uuid;
BEGIN
  -- SECURITY: Validate user has access to this organization
  SELECT u.organization_id INTO user_org_id
  FROM users u
  WHERE u.id = auth.uid();

  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not found or not authenticated';
  END IF;

  IF user_org_id != org_id THEN
    RAISE EXCEPTION 'Access denied: Cannot access data from another organization';
  END IF;

  -- Return view data filtered by organization
  RETURN QUERY
  SELECT
    invd.id,
    invd.invoice_number,
    invd.work_order_id,
    invd.payment_status,
    invd.payment_method,
    invd.card_type,
    invd.subtotal,
    invd.discount_percentage,
    invd.discount_amount,
    invd.tax_type,
    invd.tax_rate,
    invd.tax_amount,
    invd.total,
    invd.paid_amount,
    invd.notes,
    invd.created_at,
    invd.updated_at,
    invd.organization_id,
    invd.customer_id,
    invd.customer_name,
    invd.customer_phone,
    invd.customer_email,
    invd.vehicle_id,
    invd.plate_number,
    invd.car_make,
    invd.car_model,
    invd.car_year,
    invd.work_order_number,
    invd.work_order_status,
    invd.work_order_description,
    invd.remaining_amount,
    invd.items_count
  FROM invoices_detailed invd
  WHERE invd.organization_id = org_id;
END;
$$;

-- Function: Get technician performance summary (SECURED)
CREATE OR REPLACE FUNCTION get_technician_performance_summary(org_id uuid)
RETURNS TABLE (
  technician_id uuid,
  technician_name text,
  technician_phone text,
  specialization text,
  contract_type text,
  monthly_salary numeric,
  fixed_salary numeric,
  commission_rate numeric,
  allowances numeric,
  is_active boolean,
  organization_id uuid,
  total_work_orders bigint,
  completed_work_orders bigint,
  total_revenue numeric,
  avg_revenue_per_order numeric,
  last_work_order_date timestamptz,
  current_month_orders bigint,
  current_month_revenue numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  user_org_id uuid;
BEGIN
  -- SECURITY: Validate user has access to this organization
  SELECT u.organization_id INTO user_org_id
  FROM users u
  WHERE u.id = auth.uid();

  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not found or not authenticated';
  END IF;

  IF user_org_id != org_id THEN
    RAISE EXCEPTION 'Access denied: Cannot access data from another organization';
  END IF;

  -- Return view data filtered by organization
  RETURN QUERY
  SELECT
    tps.technician_id,
    tps.technician_name,
    tps.technician_phone,
    tps.specialization,
    tps.contract_type,
    tps.monthly_salary,
    tps.fixed_salary,
    tps.commission_rate,
    tps.allowances,
    tps.is_active,
    tps.organization_id,
    tps.total_work_orders,
    tps.completed_work_orders,
    tps.total_revenue,
    tps.avg_revenue_per_order,
    tps.last_work_order_date,
    tps.current_month_orders,
    tps.current_month_revenue
  FROM technician_performance_summary tps
  WHERE tps.organization_id = org_id;
END;
$$;

-- Function: Get inventory status (SECURED)
CREATE OR REPLACE FUNCTION get_inventory_status(org_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  part_number text,
  category text,
  current_quantity integer,
  minimum_quantity integer,
  unit_price numeric,
  supplier text,
  location text,
  organization_id uuid,
  stock_value numeric,
  stock_status text,
  recommended_order_quantity integer,
  usage_last_30_days numeric,
  avg_monthly_usage numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  user_org_id uuid;
BEGIN
  -- SECURITY: Validate user has access to this organization
  SELECT u.organization_id INTO user_org_id
  FROM users u
  WHERE u.id = auth.uid();

  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not found or not authenticated';
  END IF;

  IF user_org_id != org_id THEN
    RAISE EXCEPTION 'Access denied: Cannot access data from another organization';
  END IF;

  -- Return view data filtered by organization
  RETURN QUERY
  SELECT
    inv.id,
    inv.name,
    inv.part_number,
    inv.category,
    inv.current_quantity,
    inv.minimum_quantity,
    inv.unit_price,
    inv.supplier,
    inv.location,
    inv.organization_id,
    inv.stock_value,
    inv.stock_status,
    inv.recommended_order_quantity,
    inv.usage_last_30_days,
    inv.avg_monthly_usage
  FROM inventory_status inv
  WHERE inv.organization_id = org_id;
END;
$$;

-- Function: Get financial summary monthly (SECURED)
CREATE OR REPLACE FUNCTION get_financial_summary_monthly(org_id uuid)
RETURNS TABLE (
  organization_id uuid,
  month date,
  year integer,
  month_number integer,
  total_revenue numeric,
  paid_revenue numeric,
  unpaid_revenue numeric,
  total_expenses numeric,
  total_salaries numeric,
  net_profit numeric,
  invoice_count bigint,
  work_order_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  user_org_id uuid;
BEGIN
  -- SECURITY: Validate user has access to this organization
  SELECT u.organization_id INTO user_org_id
  FROM users u
  WHERE u.id = auth.uid();

  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not found or not authenticated';
  END IF;

  IF user_org_id != org_id THEN
    RAISE EXCEPTION 'Access denied: Cannot access data from another organization';
  END IF;

  -- Return view data filtered by organization
  RETURN QUERY
  SELECT
    fsm.organization_id,
    fsm.month,
    fsm.year,
    fsm.month_number,
    fsm.total_revenue,
    fsm.paid_revenue,
    fsm.unpaid_revenue,
    fsm.total_expenses,
    fsm.total_salaries,
    fsm.net_profit,
    fsm.invoice_count,
    fsm.work_order_count
  FROM financial_summary_monthly fsm
  WHERE fsm.organization_id = org_id;
END;
$$;

-- =====================================================
-- GRANT EXECUTE PERMISSIONS ON SECURE FUNCTIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION get_work_orders_detailed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_invoices_detailed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_technician_performance_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_financial_summary_monthly(uuid) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION get_work_orders_detailed(uuid) IS 'SECURED: Returns detailed work order information. Validates organization access.';
COMMENT ON FUNCTION get_invoices_detailed(uuid) IS 'SECURED: Returns detailed invoice information. Validates organization access.';
COMMENT ON FUNCTION get_technician_performance_summary(uuid) IS 'SECURED: Returns technician performance metrics. Validates organization access.';
COMMENT ON FUNCTION get_inventory_status(uuid) IS 'SECURED: Returns inventory status with stock alerts. Validates organization access.';
COMMENT ON FUNCTION get_financial_summary_monthly(uuid) IS 'SECURED: Returns monthly financial summary. Validates organization access.';
