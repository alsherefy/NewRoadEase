/*
  # تحديث منطق حساب الرواتب
  
  1. التغييرات
    - تحديث دالة `calculate_technician_salary` لتأخذ في الاعتبار:
      - نوع العقد (fixed أو percentage)
      - البدلات (allowances) للعقود الثابتة
      - الراتب الثابت (fixed_salary) للعقود الثابتة
      - النسبة المئوية (percentage) للعقود بالنسبة
      
  2. المنطق الجديد
    - إذا كان العقد ثابت (fixed):
      - basic_salary = fixed_salary + allowances
      - commission_amount = 0
    - إذا كان العقد بالنسبة (percentage):
      - basic_salary = 0
      - commission_amount = النسبة × إجمالي قيمة الأعمال المكتملة
*/

-- تحديث دالة حساب راتب الفني
CREATE OR REPLACE FUNCTION calculate_technician_salary(
  p_technician_id uuid,
  p_month integer,
  p_year integer
)
RETURNS TABLE (
  basic_salary numeric,
  commission_amount numeric,
  work_orders_count bigint,
  total_work_orders_value numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE 
      WHEN t.contract_type = 'fixed' THEN COALESCE(t.fixed_salary, 0) + COALESCE(t.allowances, 0)
      ELSE 0
    END as basic_salary,
    CASE 
      WHEN t.contract_type = 'percentage' THEN COALESCE(SUM(i.total) * t.percentage / 100, 0)
      ELSE 0
    END as commission_amount,
    COUNT(DISTINCT wo.id) as work_orders_count,
    COALESCE(SUM(i.total), 0) as total_work_orders_value
  FROM technicians t
  LEFT JOIN technician_assignments ta ON ta.technician_id = t.id
  LEFT JOIN work_order_services wos ON wos.id = ta.service_id
  LEFT JOIN work_orders wo ON wo.id = wos.work_order_id
  LEFT JOIN invoices i ON i.work_order_id = wo.id
  WHERE t.id = p_technician_id
    AND wo.status = 'completed'
    AND EXTRACT(MONTH FROM wo.completed_at) = p_month
    AND EXTRACT(YEAR FROM wo.completed_at) = p_year
    AND i.payment_status = 'paid'
  GROUP BY t.id, t.contract_type, t.fixed_salary, t.allowances, t.percentage;
END;
$$ LANGUAGE plpgsql;
