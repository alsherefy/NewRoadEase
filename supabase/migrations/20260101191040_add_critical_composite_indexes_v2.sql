/*
  # Add Critical Composite Indexes for Performance Optimization

  1. Performance Improvements
    - Add composite index on work_orders (organization_id, status, created_at DESC)
      - Speeds up dashboard queries and work order listings with status filters
    - Add composite index on invoices (organization_id, payment_status, created_at DESC)
      - Optimizes financial reports and invoice listings with payment status filters
    - Add composite index on expenses (organization_id, category, expense_date DESC)
      - Improves expense reports and category-based queries
    - Add composite index on salaries (organization_id, technician_id, year, month)
      - Speeds up salary calculations and technician payroll queries
    - Add composite index on technician_assignments (technician_id, created_at DESC)
      - Optimizes technician workload reports and assignment history
    - Add composite index on invoice_items (invoice_id, service_type)
      - Speeds up invoice detail queries by service type
    - Add composite index on work_order_spare_parts (work_order_id, spare_part_id)
      - Optimizes spare parts lookup for work orders
    - Add composite index on expense_installments (expense_id, is_paid, due_date)
      - Speeds up overdue and pending installment queries
    
  2. Partial Indexes (Index only active/important records)
    - Partial index on work_orders WHERE status IN ('pending', 'in_progress')
      - Focus on active work orders that are frequently queried
    - Partial index on invoices WHERE payment_status != 'paid'
      - Focus on unpaid invoices for follow-up queries
    - Partial index on expense_installments WHERE is_paid = false
      - Focus on pending installments for payment tracking

  These indexes will significantly improve query performance across the application,
  especially for dashboard statistics, reports, and filtered list views.
*/

-- Composite indexes for work_orders
CREATE INDEX IF NOT EXISTS idx_work_orders_org_status_created 
  ON work_orders (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_orders_customer_created 
  ON work_orders (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_orders_vehicle_created 
  ON work_orders (vehicle_id, created_at DESC);

-- Partial index for active work orders (most frequently queried)
CREATE INDEX IF NOT EXISTS idx_work_orders_active 
  ON work_orders (organization_id, created_at DESC) 
  WHERE status IN ('pending', 'in_progress');

-- Composite indexes for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_org_payment_created 
  ON invoices (organization_id, payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_customer_created 
  ON invoices (customer_id, created_at DESC);

-- Partial index for unpaid invoices
CREATE INDEX IF NOT EXISTS idx_invoices_unpaid 
  ON invoices (organization_id, created_at DESC) 
  WHERE payment_status != 'paid';

-- Composite indexes for expenses
CREATE INDEX IF NOT EXISTS idx_expenses_org_category_date 
  ON expenses (organization_id, category, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_org_date 
  ON expenses (organization_id, expense_date DESC);

-- Composite indexes for salaries
CREATE INDEX IF NOT EXISTS idx_salaries_org_tech_year_month 
  ON salaries (organization_id, technician_id, year, month);

CREATE INDEX IF NOT EXISTS idx_salaries_tech_year_month 
  ON salaries (technician_id, year DESC, month DESC);

-- Composite indexes for technician_assignments
CREATE INDEX IF NOT EXISTS idx_tech_assignments_tech_created 
  ON technician_assignments (technician_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tech_assignments_service 
  ON technician_assignments (service_id);

-- Composite indexes for invoice_items
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_service 
  ON invoice_items (invoice_id, service_type);

-- Composite indexes for work_order_spare_parts
CREATE INDEX IF NOT EXISTS idx_work_order_spare_parts_composite 
  ON work_order_spare_parts (work_order_id, spare_part_id);

CREATE INDEX IF NOT EXISTS idx_work_order_spare_parts_part 
  ON work_order_spare_parts (spare_part_id);

-- Composite indexes for expense_installments
CREATE INDEX IF NOT EXISTS idx_expense_installments_expense_paid_due 
  ON expense_installments (expense_id, is_paid, due_date);

-- Partial index for unpaid installments
CREATE INDEX IF NOT EXISTS idx_expense_installments_pending 
  ON expense_installments (expense_id, due_date) 
  WHERE is_paid = false;

-- Additional useful indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_customers_org_name 
  ON customers (organization_id, name);

CREATE INDEX IF NOT EXISTS idx_vehicles_org_plate 
  ON vehicles (organization_id, plate_number);

CREATE INDEX IF NOT EXISTS idx_spare_parts_org_name 
  ON spare_parts (organization_id, name);

CREATE INDEX IF NOT EXISTS idx_technicians_org_specialization 
  ON technicians (organization_id, specialization);
