/*
  # تحسين Views وإزالة Subqueries المكلفة

  ## المشكلة
  Views الحالية تحتوي على subqueries تُنفذ لكل صف:
  - work_orders_detailed: 4 subqueries لكل صف
  - technician_performance_summary: حسابات معقدة في runtime
  
  ## الحل
  - استخدام JOINs بدلاً من subqueries حيثما أمكن
  - Pre-aggregate البيانات
  - تحسين الأداء بشكل كبير

  ## التأثير
  - تحميل أسرع لصفحات Work Orders و Invoices
  - تقليل الحمل على CPU
*/

-- ==========================================
-- 1. تحسين work_orders_detailed
-- ==========================================

DROP VIEW IF EXISTS work_orders_detailed CASCADE;

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
  
  -- Aggregated data using LEFT JOIN
  COALESCE(tech_count.count, 0) as technician_count,
  COALESCE(parts_total.total, 0) as total_spare_parts_cost,
  wo.total_labor_cost + COALESCE(parts_total.total, 0) as total_cost,
  i.payment_status as invoice_payment_status
  
FROM work_orders wo
LEFT JOIN customers c ON wo.customer_id = c.id
LEFT JOIN vehicles v ON wo.vehicle_id = v.id
LEFT JOIN invoices i ON i.work_order_id = wo.id
LEFT JOIN (
  -- Pre-aggregate technician count
  SELECT 
    wos.work_order_id,
    COUNT(DISTINCT ta.technician_id) as count
  FROM work_order_services wos
  JOIN technician_assignments ta ON ta.service_id = wos.id
  GROUP BY wos.work_order_id
) tech_count ON tech_count.work_order_id = wo.id
LEFT JOIN (
  -- Pre-aggregate spare parts total
  SELECT 
    work_order_id,
    SUM(total) as total
  FROM work_order_spare_parts
  GROUP BY work_order_id
) parts_total ON parts_total.work_order_id = wo.id;

-- ==========================================
-- 2. تحسين invoices_detailed
-- ==========================================

DROP VIEW IF EXISTS invoices_detailed CASCADE;

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
  i.paid_at,
  i.due_date,
  
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
  COALESCE(items_count.count, 0) as items_count
  
FROM invoices i
LEFT JOIN customers c ON i.customer_id = c.id
LEFT JOIN vehicles v ON i.vehicle_id = v.id
LEFT JOIN work_orders wo ON i.work_order_id = wo.id
LEFT JOIN (
  -- Pre-count invoice items
  SELECT invoice_id, COUNT(*) as count
  FROM invoice_items
  GROUP BY invoice_id
) items_count ON items_count.invoice_id = i.id;

-- ==========================================
-- 3. تحسين inventory_status
-- ==========================================

DROP VIEW IF EXISTS inventory_status CASCADE;

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
  
  -- Pre-aggregated usage data
  COALESCE(usage_30.total, 0) as usage_last_30_days,
  COALESCE(usage_90.total / 3, 0) as avg_monthly_usage

FROM spare_parts sp
LEFT JOIN (
  -- Usage in last 30 days
  SELECT 
    wosp.spare_part_id,
    SUM(wosp.quantity) as total
  FROM work_order_spare_parts wosp
  JOIN work_orders wo ON wosp.work_order_id = wo.id
  WHERE wo.created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY wosp.spare_part_id
) usage_30 ON usage_30.spare_part_id = sp.id
LEFT JOIN (
  -- Usage in last 90 days
  SELECT 
    wosp.spare_part_id,
    SUM(wosp.quantity) as total
  FROM work_order_spare_parts wosp
  JOIN work_orders wo ON wosp.work_order_id = wo.id
  WHERE wo.created_at >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY wosp.spare_part_id
) usage_90 ON usage_90.spare_part_id = sp.id;

-- ==========================================
-- Grant permissions
-- ==========================================

GRANT SELECT ON work_orders_detailed TO authenticated;
GRANT SELECT ON invoices_detailed TO authenticated;
GRANT SELECT ON inventory_status TO authenticated;

-- ==========================================
-- Update comments
-- ==========================================

COMMENT ON VIEW work_orders_detailed IS 
  'محسّن: Work order info مع pre-aggregated data بدون subqueries مكلفة';
  
COMMENT ON VIEW invoices_detailed IS 
  'محسّن: Invoice info مع pre-aggregated counts';
  
COMMENT ON VIEW inventory_status IS 
  'محسّن: Inventory status مع pre-aggregated usage data';

-- تحليل الجداول
ANALYZE work_orders;
ANALYZE invoices;
ANALYZE spare_parts;
ANALYZE work_order_spare_parts;