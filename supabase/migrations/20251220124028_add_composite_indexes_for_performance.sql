/*
  # Add Composite Indexes for Performance Optimization

  1. Performance Improvements
    - Add composite indexes for frequently joined tables
    - Optimize queries with multiple WHERE conditions
    - Improve JOIN performance between related tables
    
  2. New Composite Indexes
    - `work_order_services` - (work_order_id, id) for faster service lookups
    - `technician_assignments` - (service_id, technician_id) for faster assignment lookups
    - `work_order_spare_parts` - (work_order_id, spare_part_id) for faster spare parts lookups
    - `invoice_items` - (invoice_id, id) for faster invoice item lookups
    - `work_orders` - (organization_id, status, created_at) for faster filtered queries
    - `invoices` - (organization_id, payment_status, created_at) for faster filtered queries
    - `expense_installments` - (expense_id, due_date) for faster installment queries
    
  3. Performance Benefits
    - Faster JOIN operations
    - Reduced query execution time for complex queries
    - Better query planning by PostgreSQL optimizer
    - Improved pagination performance
*/

-- Work Order Services - composite index for work_order_id and id
CREATE INDEX IF NOT EXISTS idx_work_order_services_wo_id 
ON work_order_services(work_order_id, id);

-- Technician Assignments - composite index for service_id and technician_id
CREATE INDEX IF NOT EXISTS idx_technician_assignments_service_tech 
ON technician_assignments(service_id, technician_id);

-- Work Order Spare Parts - composite index for work_order_id and spare_part_id
CREATE INDEX IF NOT EXISTS idx_work_order_spare_parts_wo_sp 
ON work_order_spare_parts(work_order_id, spare_part_id);

-- Invoice Items - composite index for invoice_id
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice 
ON invoice_items(invoice_id, id);

-- Work Orders - composite index for organization_id, status and created_at (for filtered queries)
CREATE INDEX IF NOT EXISTS idx_work_orders_org_status_date 
ON work_orders(organization_id, status, created_at DESC);

-- Invoices - composite index for organization_id, payment_status and created_at
CREATE INDEX IF NOT EXISTS idx_invoices_org_status_date 
ON invoices(organization_id, payment_status, created_at DESC);

-- Expense Installments - composite index for expense_id and due_date
CREATE INDEX IF NOT EXISTS idx_expense_installments_expense_date 
ON expense_installments(expense_id, due_date);

-- Salaries - composite index for organization_id, year, month
CREATE INDEX IF NOT EXISTS idx_salaries_org_year_month 
ON salaries(organization_id, year, month);

-- Technician Reports - composite index for organization_id and start_date
CREATE INDEX IF NOT EXISTS idx_technician_reports_org_date 
ON technician_reports(organization_id, start_date DESC);