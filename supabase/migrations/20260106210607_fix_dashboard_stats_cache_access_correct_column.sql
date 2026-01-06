/*
  # Fix dashboard_stats_cache Access with Security Definer Function

  1. Problem
    - Users getting "permission denied for materialized view dashboard_stats_cache"
    - Cannot apply RLS on materialized views

  2. Solution
    - Revoke direct access from authenticated users
    - Provide access only through security definer function
    - Function filters by user's organization automatically

  3. Security
    - Users can only see their own organization's dashboard stats
    - No direct access to materialized view
    - Access only through secured function
*/

-- Revoke direct SELECT access from authenticated users
REVOKE SELECT ON dashboard_stats_cache FROM authenticated;

-- Create or replace the security definer function
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE (
  organization_id uuid,
  total_work_orders bigint,
  pending_work_orders bigint,
  in_progress_work_orders bigint,
  completed_work_orders bigint,
  cancelled_work_orders bigint,
  total_invoices bigint,
  unpaid_invoices bigint,
  partial_invoices bigint,
  paid_invoices bigint,
  total_revenue numeric,
  collected_revenue numeric,
  outstanding_revenue numeric,
  current_month_work_orders bigint,
  current_month_revenue numeric,
  total_customers bigint,
  total_vehicles bigint,
  total_spare_parts bigint,
  low_stock_items bigint,
  inventory_value numeric,
  active_technicians bigint,
  current_month_expenses numeric,
  last_updated timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    dsc.organization_id,
    dsc.total_work_orders,
    dsc.pending_work_orders,
    dsc.in_progress_work_orders,
    dsc.completed_work_orders,
    dsc.cancelled_work_orders,
    dsc.total_invoices,
    dsc.unpaid_invoices,
    dsc.partial_invoices,
    dsc.paid_invoices,
    dsc.total_revenue,
    dsc.collected_revenue,
    dsc.outstanding_revenue,
    dsc.current_month_work_orders,
    dsc.current_month_revenue,
    dsc.total_customers,
    dsc.total_vehicles,
    dsc.total_spare_parts,
    dsc.low_stock_items,
    dsc.inventory_value,
    dsc.active_technicians,
    dsc.current_month_expenses,
    dsc.last_updated
  FROM dashboard_stats_cache dsc
  WHERE dsc.organization_id IN (
    SELECT u.organization_id 
    FROM users u
    WHERE u.id = auth.uid()
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;

COMMENT ON FUNCTION get_dashboard_stats() IS 'SECURED: Returns dashboard stats cache for current user organization only. Uses SECURITY DEFINER for controlled access.';
