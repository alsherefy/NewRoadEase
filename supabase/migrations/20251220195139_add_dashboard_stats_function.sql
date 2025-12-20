/*
  # Add Dashboard Statistics Function
  
  1. Function
    - `get_dashboard_stats(p_organization_id)` - Efficiently calculates dashboard statistics
      - Returns total revenue, completed orders count, active customers count, active technicians count
      - Uses aggregate functions for better performance
  
  2. Benefits
    - Single query instead of multiple queries
    - Uses indexes for fast aggregation
    - Reduces data transfer
*/

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
    COALESCE(SUM(wo.total_labor_cost), 0)::NUMERIC as total_revenue,
    COUNT(DISTINCT wo.id) FILTER (WHERE wo.status = 'completed') as completed_orders,
    COUNT(DISTINCT c.id) as active_customers,
    COUNT(DISTINCT t.id) FILTER (WHERE t.is_active = true) as active_technicians
  FROM work_orders wo
  CROSS JOIN customers c
  CROSS JOIN technicians t
  WHERE wo.organization_id = p_organization_id
    AND wo.status = 'completed'
    AND c.organization_id = p_organization_id
    AND t.organization_id = p_organization_id;
END;
$$;
