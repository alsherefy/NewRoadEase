/*
  # إضافة نظام المصروفات

  ## الوصف
  يضيف هذا الملف نظام شامل لإدارة المصروفات في الورشة

  ## الجداول الجديدة
  
  ### expenses
  جدول المصروفات الرئيسي
  - `id` (uuid, primary key) - المعرف الفريد
  - `expense_number` (text) - رقم المصروف التلقائي
  - `category` (text) - فئة المصروف (رواتب، صيانة، مواد، إيجار، كهرباء، ماء، وقود، أخرى)
  - `description` (text) - وصف المصروف
  - `amount` (numeric) - المبلغ
  - `payment_method` (text) - طريقة الدفع (نقد، بطاقة، تحويل بنكي)
  - `card_type` (text, optional) - نوع البطاقة (مدى، فيزا)
  - `receipt_number` (text, optional) - رقم الإيصال أو الفاتورة
  - `notes` (text, optional) - ملاحظات إضافية
  - `expense_date` (date) - تاريخ المصروف
  - `created_by` (uuid) - المستخدم الذي أضاف المصروف
  - `created_at` (timestamptz) - وقت الإنشاء
  - `updated_at` (timestamptz) - وقت آخر تحديث

  ## التحديثات
  - إضافة صلاحية 'expenses' إلى قائمة الصلاحيات المسموح بها

  ## الأمان
  - تفعيل RLS على جميع الجداول
  - سياسات للقراءة والإضافة والتعديل والحذف للمستخدمين المصرح لهم

  ## الفهارس
  - فهرس على expense_date لتسريع البحث حسب التاريخ
  - فهرس على category لتسريع البحث حسب الفئة
  - فهرس على created_at للترتيب

  ## الملاحظات
  - رقم المصروف يتم توليده تلقائياً بصيغة EXP-XXXXXX
  - جميع المبالغ بالريال السعودي
  - يمكن إرفاق رقم الإيصال للمرجعية
*/

-- إنشاء جدول المصروفات
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_number text UNIQUE NOT NULL,
  category text NOT NULL CHECK (category IN ('salaries', 'maintenance', 'materials', 'rent', 'electricity', 'water', 'fuel', 'other')),
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'bank_transfer')),
  card_type text CHECK (card_type IN ('mada', 'visa')),
  receipt_number text,
  notes text DEFAULT '',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- سياسات RLS للمصروفات

-- سياسة القراءة: جميع المستخدمين المصادق عليهم
CREATE POLICY "Users can view expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (true);

-- سياسة الإضافة: جميع المستخدمين المصادق عليهم
CREATE POLICY "Users can create expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- سياسة التعديل: المستخدمين المصادق عليهم
CREATE POLICY "Users can update expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- سياسة الحذف: المستخدمين المصادق عليهم
CREATE POLICY "Users can delete expenses"
  ON expenses FOR DELETE
  TO authenticated
  USING (true);

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_created ON expenses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_number ON expenses(expense_number);

-- دالة لتوليد رقم مصروف تلقائي
CREATE OR REPLACE FUNCTION generate_expense_number()
RETURNS text AS $$
DECLARE
  next_number integer;
  expense_num text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(expense_number FROM 5) AS integer)), 0) + 1
  INTO next_number
  FROM expenses
  WHERE expense_number LIKE 'EXP-%';
  
  expense_num := 'EXP-' || LPAD(next_number::text, 6, '0');
  RETURN expense_num;
END;
$$ LANGUAGE plpgsql;

-- دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- تطبيق الدالة على جدول المصروفات
DROP TRIGGER IF EXISTS update_expenses_updated_at_trigger ON expenses;
CREATE TRIGGER update_expenses_updated_at_trigger
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_expenses_updated_at();

-- تحديث القيد على permission_key لإضافة expenses
DO $$
BEGIN
  -- حذف القيد القديم
  ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_permission_key_check;
  
  -- إضافة القيد الجديد مع expenses
  ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_permission_key_check 
    CHECK (permission_key IN ('dashboard', 'customers', 'work_orders', 'invoices', 'inventory', 'technicians', 'reports', 'settings', 'users', 'expenses'));
END $$;

-- إضافة صلاحية المصروفات لجميع المستخدمين الحاليين
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users LIMIT 1) THEN
    INSERT INTO user_permissions (user_id, permission_key, can_view, can_edit)
    SELECT id, 'expenses', true, true
    FROM users
    WHERE NOT EXISTS (
      SELECT 1 FROM user_permissions 
      WHERE user_permissions.user_id = users.id 
      AND user_permissions.permission_key = 'expenses'
    );
  END IF;
END $$;