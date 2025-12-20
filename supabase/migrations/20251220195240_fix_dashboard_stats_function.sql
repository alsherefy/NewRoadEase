/*
  # Fix Dashboard Statistics Function
  
  1. Changes
    - Fix CROSS JOIN issue that caused incorrect calculations
    - Use separate subqueries for each statistic
    - Ensure accurate counts and totals
*/

DROP FUNCTION IF EXISTS get_dashboard_stats(UUID);

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_organization_id UUID)
RETURNS TABLE (
  total_revenue NUMERIC,
  completed_orders BIGINT,
  active_customers BIGINT,
  active_technicians BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (
      SELECT COALESCE(SUM(total_labor_cost), 0)
      FROM work_orders
      WHERE organization_id = p_organization_id
        AND status = 'completed'
    )::NUMERIC as total_revenue,
    (
      SELECT COUNT(*)
      FROM work_orders
      WHERE organization_id = p_organization_id
        AND status = 'completed'
    ) as completed_orders,
    (
      SELECT COUNT(*)
      FROM customers
      WHERE organization_id = p_organization_id
    ) as active_customers,
    (
      SELECT COUNT(*)
      FROM technicians
      WHERE organization_id = p_organization_id
        AND is_active = true
    ) as active_technicians;
END;
$$;
