/*
  # Add Performance Indexes

  1. New Indexes
    - `work_orders` table
      - Index on `status` for filtering
      - Index on `created_at` for sorting
      - Index on `customer_id` for joins
      - Index on `vehicle_id` for joins
    - `invoices` table
      - Index on `payment_status` for filtering
      - Index on `created_at` for sorting
      - Index on `customer_id` for joins
    - `customers` table
      - Index on `phone` for searching
      - Index on `name` for searching
    - `vehicles` table
      - Index on `customer_id` for joins
      - Index on `plate_number` for searching
    - `invoice_items` table
      - Index on `invoice_id` for joins
    - `work_order_spare_parts` table
      - Index on `work_order_id` for joins
    - `technicians` table
      - Index on `is_active` for filtering
    - `users` table
      - Index on `role` for filtering
    - `user_permissions` table
      - Index on `user_id` for joins

  2. Performance Benefits
    - Faster filtering by status and dates
    - Improved join performance
    - Faster search operations
    - Better query optimization by PostgreSQL
*/

-- Work Orders Indexes
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_created_at ON work_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_orders_customer_id ON work_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_vehicle_id ON work_orders(vehicle_id);

-- Invoices Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);

-- Customers Indexes
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);

-- Vehicles Indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_customer_id ON vehicles(customer_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_number ON vehicles(plate_number);

-- Invoice Items Indexes
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- Work Order Spare Parts Indexes
CREATE INDEX IF NOT EXISTS idx_work_order_spare_parts_work_order_id ON work_order_spare_parts(work_order_id);

-- Technicians Indexes
CREATE INDEX IF NOT EXISTS idx_technicians_is_active ON technicians(is_active);

-- Users Indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- User Permissions Indexes
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);

-- Expenses Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- Salaries Indexes
CREATE INDEX IF NOT EXISTS idx_salaries_technician_id ON salaries(technician_id);
CREATE INDEX IF NOT EXISTS idx_salaries_year_month ON salaries(year, month);

-- Technician Reports Indexes
CREATE INDEX IF NOT EXISTS idx_technician_reports_technician_id ON technician_reports(technician_id);
CREATE INDEX IF NOT EXISTS idx_technician_reports_start_date ON technician_reports(start_date DESC);