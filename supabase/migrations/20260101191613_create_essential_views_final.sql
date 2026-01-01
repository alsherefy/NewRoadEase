/*
  # Create Essential Views for Common Queries

  1. Views Created
    - work_orders_detailed: Complete work order information with customer, vehicle, and technician data
      - Eliminates multiple JOINs in application code
      - Speeds up work order list and detail pages
    
    - invoices_detailed: Complete invoice information with customer, vehicle, and work order data
      - Speeds up invoice listings and reports
      - Includes calculated totals and payment information
    
    - technician_performance_summary: Aggregated technician performance metrics
      - Pre-calculates work order counts, revenue, and completion rates
      - Speeds up technician reports and dashboards
    
    - inventory_status: Current inventory status with low stock alerts
      - Shows available quantity, value, and stock alerts
      - Optimizes inventory management pages
    
    - financial_summary_monthly: Monthly financial aggregates
      - Pre-aggregates revenue, expenses, and profits by month
      - Speeds up financial reports and dashboards

  2. Benefits
    - Reduces complex JOINs in application code
    - Improves query performance through pre-computation
    - Simplifies application queries
    - Provides consistent data structure across the app

  These views will be used extensively throughout the application for reporting and data display.
*/

-- View: work_orders_detailed
-- Complete work order information with all related data
CREATE OR REPLACE VIEW work_orders_detailed AS
SELECT 
  wo.id,
  wo.order_number,
  wo.status,
  wo.priority,
  wo.description,
  wo.total_labor_cost,
  wo.created_at,
  wo.completed_at,
  wo.updated_at,
  wo.organization_id,
  
  -- Customer information
  c.id as customer_id,
  c.name as customer_name,
  c.phone as customer_phone,
  c.email as customer_email,
  
  -- Vehicle information
  v.id as vehicle_id,
  v.plate_number,
  v.car_make,
  v.car_model,
  v.car_year,
  
  -- Technician count
  (SELECT COUNT(DISTINCT ta.technician_id) 
   FROM technician_assignments ta 
   JOIN work_order_services wos ON ta.service_id = wos.id
   WHERE wos.work_order_id = wo.id) as technician_count,
  
  -- Total spare parts cost
  COALESCE((SELECT SUM(wosp.total) 
   FROM work_order_spare_parts wosp 
   WHERE wosp.work_order_id = wo.id), 0) as total_spare_parts_cost,
  
  -- Total cost (labor + spare parts)
  wo.total_labor_cost + COALESCE((SELECT SUM(wosp.total) 
   FROM work_order_spare_parts wosp 
   WHERE wosp.work_order_id = wo.id), 0) as total_cost,
  
  -- Invoice status
  (SELECT payment_status 
   FROM invoices 
   WHERE work_order_id = wo.id 
   LIMIT 1) as invoice_payment_status
  
FROM work_orders wo
LEFT JOIN customers c ON wo.customer_id = c.id
LEFT JOIN vehicles v ON wo.vehicle_id = v.id;

-- View: invoices_detailed
-- Complete invoice information with all related data
CREATE OR REPLACE VIEW invoices_detailed AS
SELECT 
  i.id,
  i.invoice_number,
  i.work_order_id,
  i.payment_status,
  i.payment_method,
  i.card_type,
  i.subtotal,
  i.discount_percentage,
  i.discount_amount,
  i.tax_type,
  i.tax_rate,
  i.tax_amount,
  i.total,
  i.paid_amount,
  i.notes,
  i.created_at,
  i.updated_at,
  i.organization_id,
  
  -- Customer information
  c.id as customer_id,
  c.name as customer_name,
  c.phone as customer_phone,
  c.email as customer_email,
  
  -- Vehicle information
  v.id as vehicle_id,
  v.plate_number,
  v.car_make,
  v.car_model,
  v.car_year,
  
  -- Work order information
  wo.order_number as work_order_number,
  wo.status as work_order_status,
  wo.description as work_order_description,
  
  -- Calculated fields
  i.total - i.paid_amount as remaining_amount,
  (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id = i.id) as items_count
  
FROM invoices i
LEFT JOIN customers c ON i.customer_id = c.id
LEFT JOIN vehicles v ON i.vehicle_id = v.id
LEFT JOIN work_orders wo ON i.work_order_id = wo.id;

-- View: technician_performance_summary
-- Aggregated performance metrics per technician
CREATE OR REPLACE VIEW technician_performance_summary AS
SELECT 
  t.id as technician_id,
  t.name as technician_name,
  t.phone as technician_phone,
  t.specialization,
  t.contract_type,
  t.monthly_salary,
  t.fixed_salary,
  t.commission_rate,
  t.allowances,
  t.is_active,
  t.organization_id,
  
  -- Work orders count (all time)
  COUNT(DISTINCT wos.work_order_id) as total_work_orders,
  
  -- Completed work orders
  COUNT(DISTINCT CASE WHEN wo.status = 'completed' THEN wos.work_order_id END) as completed_work_orders,
  
  -- Total revenue from work orders
  COALESCE(SUM(ta.share_amount), 0) as total_revenue,
  
  -- Average revenue per work order
  CASE 
    WHEN COUNT(DISTINCT wos.work_order_id) > 0 
    THEN COALESCE(SUM(ta.share_amount), 0) / COUNT(DISTINCT wos.work_order_id)
    ELSE 0 
  END as avg_revenue_per_order,
  
  -- Last work order date
  MAX(wo.created_at) as last_work_order_date,
  
  -- Current month work orders
  COUNT(DISTINCT CASE 
    WHEN DATE_TRUNC('month', wo.created_at) = DATE_TRUNC('month', CURRENT_DATE)
    THEN wos.work_order_id 
  END) as current_month_orders,
  
  -- Current month revenue
  COALESCE(SUM(CASE 
    WHEN DATE_TRUNC('month', wo.created_at) = DATE_TRUNC('month', CURRENT_DATE)
    THEN ta.share_amount 
    ELSE 0 
  END), 0) as current_month_revenue

FROM technicians t
LEFT JOIN technician_assignments ta ON t.id = ta.technician_id
LEFT JOIN work_order_services wos ON ta.service_id = wos.id
LEFT JOIN work_orders wo ON wos.work_order_id = wo.id
GROUP BY t.id, t.name, t.phone, t.specialization, t.contract_type, t.monthly_salary, 
         t.fixed_salary, t.commission_rate, t.allowances, t.is_active, t.organization_id;

-- View: inventory_status
-- Current inventory status with stock alerts
CREATE OR REPLACE VIEW inventory_status AS
SELECT 
  sp.id,
  sp.name,
  sp.part_number,
  sp.category,
  sp.quantity as current_quantity,
  sp.minimum_quantity,
  sp.unit_price,
  sp.supplier,
  sp.location,
  sp.organization_id,
  
  -- Stock value
  sp.quantity * sp.unit_price as stock_value,
  
  -- Stock status
  CASE 
    WHEN sp.quantity <= 0 THEN 'out_of_stock'
    WHEN sp.quantity <= sp.minimum_quantity THEN 'low_stock'
    WHEN sp.quantity <= sp.minimum_quantity * 2 THEN 'medium_stock'
    ELSE 'in_stock'
  END as stock_status,
  
  -- Quantity to reorder
  CASE 
    WHEN sp.quantity < sp.minimum_quantity 
    THEN sp.minimum_quantity * 3 - sp.quantity
    ELSE 0 
  END as recommended_order_quantity,
  
  -- Usage in last 30 days
  COALESCE((
    SELECT SUM(wosp.quantity)
    FROM work_order_spare_parts wosp
    JOIN work_orders wo ON wosp.work_order_id = wo.id
    WHERE wosp.spare_part_id = sp.id
      AND wo.created_at >= CURRENT_DATE - INTERVAL '30 days'
  ), 0) as usage_last_30_days,
  
  -- Average monthly usage (last 3 months)
  COALESCE((
    SELECT SUM(wosp.quantity) / 3
    FROM work_order_spare_parts wosp
    JOIN work_orders wo ON wosp.work_order_id = wo.id
    WHERE wosp.spare_part_id = sp.id
      AND wo.created_at >= CURRENT_DATE - INTERVAL '90 days'
  ), 0) as avg_monthly_usage

FROM spare_parts sp;

-- View: financial_summary_monthly
-- Monthly financial aggregates for reporting
CREATE OR REPLACE VIEW financial_summary_monthly AS
WITH month_series AS (
  SELECT generate_series(
    DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months'),
    DATE_TRUNC('month', CURRENT_DATE),
    '1 month'::interval
  )::date as month
)
SELECT 
  org.id as organization_id,
  ms.month,
  EXTRACT(YEAR FROM ms.month)::integer as year,
  EXTRACT(MONTH FROM ms.month)::integer as month_number,
  
  -- Revenue from invoices
  COALESCE(SUM(i.total), 0) as total_revenue,
  COALESCE(SUM(CASE WHEN i.payment_status = 'paid' THEN i.total ELSE 0 END), 0) as paid_revenue,
  COALESCE(SUM(CASE WHEN i.payment_status != 'paid' THEN i.total ELSE 0 END), 0) as unpaid_revenue,
  
  -- Expenses
  COALESCE(SUM(e.amount), 0) as total_expenses,
  
  -- Salaries
  COALESCE(SUM(s.total_salary), 0) as total_salaries,
  
  -- Net profit/loss
  COALESCE(SUM(i.total), 0) - COALESCE(SUM(e.amount), 0) - COALESCE(SUM(s.total_salary), 0) as net_profit,
  
  -- Invoice count
  COUNT(DISTINCT i.id) as invoice_count,
  
  -- Work order count
  COUNT(DISTINCT wo.id) as work_order_count

FROM organizations org
CROSS JOIN month_series ms
LEFT JOIN invoices i ON i.organization_id = org.id 
  AND DATE_TRUNC('month', i.created_at) = ms.month
LEFT JOIN expenses e ON e.organization_id = org.id 
  AND DATE_TRUNC('month', e.expense_date) = ms.month
LEFT JOIN salaries s ON s.organization_id = org.id 
  AND s.year = EXTRACT(YEAR FROM ms.month)
  AND s.month = EXTRACT(MONTH FROM ms.month)
LEFT JOIN work_orders wo ON wo.organization_id = org.id 
  AND DATE_TRUNC('month', wo.created_at) = ms.month
GROUP BY org.id, ms.month
ORDER BY ms.month DESC;

-- Grant SELECT permissions to authenticated users
GRANT SELECT ON work_orders_detailed TO authenticated;
GRANT SELECT ON invoices_detailed TO authenticated;
GRANT SELECT ON technician_performance_summary TO authenticated;
GRANT SELECT ON inventory_status TO authenticated;
GRANT SELECT ON financial_summary_monthly TO authenticated;

-- Add helpful comments
COMMENT ON VIEW work_orders_detailed IS 'Complete work order information with customer, vehicle, technician, and cost data. Use this for work order listings and details.';
COMMENT ON VIEW invoices_detailed IS 'Complete invoice information with customer, vehicle, and work order data. Use this for invoice listings and reports.';
COMMENT ON VIEW technician_performance_summary IS 'Aggregated technician performance metrics including work order counts and revenue. Use this for technician reports.';
COMMENT ON VIEW inventory_status IS 'Current inventory status with stock levels, values, and reorder recommendations. Use this for inventory management.';
COMMENT ON VIEW financial_summary_monthly IS 'Monthly financial aggregates including revenue, expenses, salaries, and profit. Use this for financial dashboards and reports.';
