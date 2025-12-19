/*
  # إضافة نظام حساب الرواتب التلقائي

  ## التغييرات

  ### 1. تحديث جدول الفنيين (technicians)
    - إضافة `monthly_salary` (numeric) - الراتب الشهري الأساسي
    - إضافة `commission_rate` (numeric) - نسبة العمولة من أوامر العمل المكتملة

  ### 2. جدول جديد - salaries (رواتب الفنيين)
    - `id` (uuid, primary key)
    - `salary_number` (text, unique) - رقم الراتب (SAL-XXXXXX)
    - `technician_id` (uuid, foreign key) - الفني
    - `month` (integer) - الشهر (1-12)
    - `year` (integer) - السنة
    - `basic_salary` (numeric) - الراتب الأساسي
    - `commission_amount` (numeric) - إجمالي العمولات
    - `bonus` (numeric) - مكافآت إضافية
    - `deductions` (numeric) - خصومات
    - `total_salary` (numeric) - الإجمالي النهائي
    - `work_orders_count` (integer) - عدد أوامر العمل المنجزة
    - `total_work_orders_value` (numeric) - قيمة أوامر العمل الإجمالية
    - `payment_status` (text) - حالة الدفع (paid/unpaid/partial)
    - `paid_amount` (numeric) - المبلغ المدفوع
    - `payment_method` (text) - طريقة الدفع
    - `card_type` (text) - نوع البطاقة
    - `payment_date` (date) - تاريخ الدفع
    - `notes` (text) - ملاحظات
    - `created_by` (uuid) - من قام بالإنشاء
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## الأمان
    - تفعيل RLS على جدول salaries
    - سياسات القراءة والكتابة للمستخدمين المصرح لهم

  ## الدوال
    - `generate_salary_number()` - دالة توليد رقم راتب تلقائي
    - `calculate_technician_salary()` - دالة حساب راتب فني لشهر معين
*/

-- إضافة حقول جديدة لجدول الفنيين
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technicians' AND column_name = 'monthly_salary'
  ) THEN
    ALTER TABLE technicians ADD COLUMN monthly_salary numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technicians' AND column_name = 'commission_rate'
  ) THEN
    ALTER TABLE technicians ADD COLUMN commission_rate numeric DEFAULT 0 CHECK (commission_rate >= 0 AND commission_rate <= 100);
  END IF;
END $$;

-- إنشاء جدول الرواتب
CREATE TABLE IF NOT EXISTS salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_number text UNIQUE NOT NULL,
  technician_id uuid REFERENCES technicians(id) ON DELETE CASCADE NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL CHECK (year >= 2020 AND year <= 2100),
  basic_salary numeric NOT NULL DEFAULT 0 CHECK (basic_salary >= 0),
  commission_amount numeric NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
  bonus numeric DEFAULT 0 CHECK (bonus >= 0),
  deductions numeric DEFAULT 0 CHECK (deductions >= 0),
  total_salary numeric NOT NULL DEFAULT 0 CHECK (total_salary >= 0),
  work_orders_count integer DEFAULT 0 CHECK (work_orders_count >= 0),
  total_work_orders_value numeric DEFAULT 0 CHECK (total_work_orders_value >= 0),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid', 'partial')),
  paid_amount numeric DEFAULT 0 CHECK (paid_amount >= 0),
  payment_method text CHECK (payment_method IN ('cash', 'card', 'bank_transfer')),
  card_type text CHECK (card_type IN ('mada', 'visa')),
  payment_date date,
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان
CREATE POLICY "Allow authenticated users to read salaries"
  ON salaries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert salaries"
  ON salaries FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update salaries"
  ON salaries FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete salaries"
  ON salaries FOR DELETE
  TO authenticated
  USING (true);

-- دالة توليد رقم راتب تلقائي
CREATE OR REPLACE FUNCTION generate_salary_number()
RETURNS text AS $$
DECLARE
  next_number integer;
  salary_num text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(salary_number FROM 5) AS integer)), 0) + 1
  INTO next_number
  FROM salaries
  WHERE salary_number LIKE 'SAL-%';
  
  salary_num := 'SAL-' || LPAD(next_number::text, 6, '0');
  RETURN salary_num;
END;
$$ LANGUAGE plpgsql;

-- دالة حساب راتب فني لشهر معين
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
    COALESCE(t.monthly_salary, 0) as basic_salary,
    COALESCE(SUM(i.total * t.commission_rate / 100), 0) as commission_amount,
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
  GROUP BY t.id, t.monthly_salary, t.commission_rate;
END;
$$ LANGUAGE plpgsql;

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_salaries_technician ON salaries(technician_id);
CREATE INDEX IF NOT EXISTS idx_salaries_month_year ON salaries(month, year);
CREATE INDEX IF NOT EXISTS idx_salaries_payment_status ON salaries(payment_status);
CREATE INDEX IF NOT EXISTS idx_salaries_created_at ON salaries(created_at);

-- قيد فريد لمنع تكرار راتب نفس الفني في نفس الشهر والسنة
CREATE UNIQUE INDEX IF NOT EXISTS idx_salaries_unique_technician_month_year 
  ON salaries(technician_id, month, year);