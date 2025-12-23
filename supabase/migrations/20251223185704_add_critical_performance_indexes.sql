/*
  # إضافة Indexes حرجة لتحسين الأداء

  1. المشكلة
    - النظام بطيء في تحميل البيانات
    - استعلامات RLS تحتاج لفحص organization_id باستمرار
    - العلاقات بين الجداول تحتاج indexes

  2. الحل
    - إضافة composite indexes على (organization_id + created_at) للفرز السريع
    - إضافة indexes على foreign keys المستخدمة بكثرة
    - إضافة indexes على user_id للاستعلامات الأمنية

  3. الجداول المستهدفة
    - customers (organization_id, created_at)
    - work_orders (organization_id, created_at, customer_id, vehicle_id)
    - invoices (organization_id, created_at, work_order_id)
    - users (organization_id, email)
    - user_roles (user_id)
*/

-- Customers indexes
CREATE INDEX IF NOT EXISTS idx_customers_org_created 
  ON customers(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_phone 
  ON customers(phone) WHERE phone IS NOT NULL;

-- Work Orders indexes
CREATE INDEX IF NOT EXISTS idx_work_orders_org_created 
  ON work_orders(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_orders_customer 
  ON work_orders(customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_orders_vehicle 
  ON work_orders(vehicle_id) WHERE vehicle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_orders_status 
  ON work_orders(status, organization_id);

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_org_created 
  ON invoices(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_work_order 
  ON invoices(work_order_id) WHERE work_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_payment_status 
  ON invoices(payment_status, organization_id);

-- Vehicles indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_customer 
  ON vehicles(customer_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_org 
  ON vehicles(organization_id);

-- Users and Roles indexes
CREATE INDEX IF NOT EXISTS idx_users_org_email 
  ON users(organization_id, email);

CREATE INDEX IF NOT EXISTS idx_user_roles_user 
  ON user_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_role 
  ON user_roles(role_id);

-- Expenses indexes
CREATE INDEX IF NOT EXISTS idx_expenses_org_created 
  ON expenses(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_category 
  ON expenses(category, organization_id);

-- Analyze tables for statistics
ANALYZE customers;
ANALYZE work_orders;
ANALYZE invoices;
ANALYZE vehicles;
ANALYZE users;
ANALYZE user_roles;
ANALYZE expenses;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Performance indexes created successfully';
  RAISE NOTICE 'Tables analyzed for query optimization';
END $$;
