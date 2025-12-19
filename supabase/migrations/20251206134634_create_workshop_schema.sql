/*
  # إنشاء نظام إدارة ورشة صيانة السيارات

  ## الجداول الجديدة
  
  ### 1. customers (العملاء)
    - `id` (uuid, primary key)
    - `name` (text) - اسم العميل
    - `phone` (text) - رقم الهاتف
    - `email` (text, optional) - البريد الإلكتروني
    - `car_make` (text) - نوع السيارة
    - `car_model` (text) - موديل السيارة
    - `car_year` (integer) - سنة الصنع
    - `plate_number` (text) - رقم اللوحة
    - `created_at` (timestamptz)
    
  ### 2. technicians (الفنيين)
    - `id` (uuid, primary key)
    - `name` (text) - اسم الفني
    - `phone` (text) - رقم الهاتف
    - `specialization` (text) - التخصص
    - `contract_type` (text) - نوع العقد (percentage/fixed)
    - `percentage` (numeric) - النسبة للفني (إذا كان نوع العقد نسبة)
    - `fixed_salary` (numeric) - الراتب الثابت
    - `is_active` (boolean) - نشط أم لا
    - `created_at` (timestamptz)
    
  ### 3. work_orders (طلبات الصيانة)
    - `id` (uuid, primary key)
    - `customer_id` (uuid, foreign key)
    - `order_number` (text, unique) - رقم الطلب
    - `status` (text) - الحالة (pending/in_progress/completed/cancelled)
    - `description` (text) - وصف عام
    - `total_labor_cost` (numeric) - إجمالي أجور اليد
    - `created_at` (timestamptz)
    - `completed_at` (timestamptz, optional)
    
  ### 4. work_order_services (خدمات الصيانة)
    - `id` (uuid, primary key)
    - `work_order_id` (uuid, foreign key)
    - `service_type` (text) - نوع الخدمة (ميكانيكا، كهرباء، فحص كمبيوتر، إلخ)
    - `description` (text) - الوصف التفصيلي
    - `labor_cost` (numeric) - أجر اليد لهذه الخدمة
    - `created_at` (timestamptz)
    
  ### 5. technician_assignments (توزيع الحصص)
    - `id` (uuid, primary key)
    - `service_id` (uuid, foreign key)
    - `technician_id` (uuid, foreign key)
    - `share_amount` (numeric) - حصة الفني من هذه الخدمة
    - `created_at` (timestamptz)
    
  ### 6. invoices (الفواتير)
    - `id` (uuid, primary key)
    - `work_order_id` (uuid, foreign key)
    - `invoice_number` (text, unique)
    - `subtotal` (numeric) - المجموع الفرعي
    - `tax_rate` (numeric) - نسبة الضريبة
    - `tax_amount` (numeric) - قيمة الضريبة
    - `total` (numeric) - الإجمالي
    - `payment_status` (text) - حالة الدفع (paid/pending/partial)
    - `created_at` (timestamptz)
    
  ### 7. invoice_items (بنود الفاتورة)
    - `id` (uuid, primary key)
    - `invoice_id` (uuid, foreign key)
    - `item_type` (text) - نوع البند (labor/part)
    - `description` (text) - الوصف
    - `quantity` (numeric) - الكمية
    - `unit_price` (numeric) - السعر للوحدة
    - `total_price` (numeric) - السعر الإجمالي
    - `created_at` (timestamptz)

  ## الأمان
    - تفعيل RLS على جميع الجداول
    - سياسات للقراءة والكتابة للمستخدمين المصرح لهم
*/

-- جدول العملاء
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  car_make text NOT NULL,
  car_model text NOT NULL,
  car_year integer NOT NULL,
  plate_number text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- جدول الفنيين
CREATE TABLE IF NOT EXISTS technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  specialization text NOT NULL DEFAULT 'عام',
  contract_type text NOT NULL DEFAULT 'percentage',
  percentage numeric DEFAULT 0,
  fixed_salary numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- جدول طلبات الصيانة
CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  order_number text UNIQUE NOT NULL,
  status text DEFAULT 'pending',
  description text,
  total_labor_cost numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- جدول خدمات الصيانة
CREATE TABLE IF NOT EXISTS work_order_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES work_orders(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  description text NOT NULL,
  labor_cost numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- جدول توزيع الحصص على الفنيين
CREATE TABLE IF NOT EXISTS technician_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid REFERENCES work_order_services(id) ON DELETE CASCADE,
  technician_id uuid REFERENCES technicians(id) ON DELETE CASCADE,
  share_amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- جدول الفواتير
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES work_orders(id) ON DELETE CASCADE,
  invoice_number text UNIQUE NOT NULL,
  subtotal numeric DEFAULT 0,
  tax_rate numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  total numeric DEFAULT 0,
  payment_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- جدول بنود الفاتورة
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  description text NOT NULL,
  quantity numeric DEFAULT 1,
  unit_price numeric DEFAULT 0,
  total_price numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE technician_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان - السماح بالقراءة والكتابة للجميع (للتطوير)
-- في الإنتاج، يجب تخصيص السياسات حسب الأدوار

CREATE POLICY "Allow all access to customers"
  ON customers FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to technicians"
  ON technicians FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to work_orders"
  ON work_orders FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to work_order_services"
  ON work_order_services FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to technician_assignments"
  ON technician_assignments FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to invoices"
  ON invoices FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to invoice_items"
  ON invoice_items FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_work_orders_customer ON work_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_order_services_order ON work_order_services(work_order_id);
CREATE INDEX IF NOT EXISTS idx_technician_assignments_service ON technician_assignments(service_id);
CREATE INDEX IF NOT EXISTS idx_technician_assignments_technician ON technician_assignments(technician_id);
CREATE INDEX IF NOT EXISTS idx_invoices_work_order ON invoices(work_order_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);