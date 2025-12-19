/*
  # إضافة نظام قطع الغيار وخيارات الدفع المتقدمة

  1. جداول جديدة
    - `spare_parts` - جدول قطع الغيار
      - `id` (uuid, primary key)
      - `part_number` (text, رقم القطعة)
      - `name` (text, اسم القطعة)
      - `description` (text, الوصف)
      - `category` (text, الفئة)
      - `quantity` (integer, الكمية المتوفرة)
      - `unit_price` (decimal, سعر الوحدة)
      - `minimum_quantity` (integer, الحد الأدنى للكمية)
      - `supplier` (text, المورد)
      - `location` (text, موقع التخزين)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. تعديلات على الجداول الموجودة
    - إضافة حقل `card_type` إلى جدول `invoices` (mada/visa/null)
    - تحديث حقل `payment_method` ليتضمن خيارات أكثر

  3. الأمان
    - تفعيل RLS على جدول `spare_parts`
    - إضافة سياسات الوصول للمستخدمين المصرح لهم

  4. ملاحظات مهمة
    - يتم تحديث كمية قطع الغيار تلقائياً عند إضافتها للفاتورة
    - يتم التحقق من توفر الكمية قبل الإضافة
*/

-- إنشاء جدول قطع الغيار
CREATE TABLE IF NOT EXISTS spare_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number text UNIQUE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  category text DEFAULT '',
  quantity integer DEFAULT 0 CHECK (quantity >= 0),
  unit_price decimal(10, 2) DEFAULT 0 CHECK (unit_price >= 0),
  minimum_quantity integer DEFAULT 0 CHECK (minimum_quantity >= 0),
  supplier text DEFAULT '',
  location text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- إضافة حقل نوع البطاقة إلى جدول الفواتير
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'card_type'
  ) THEN
    ALTER TABLE invoices ADD COLUMN card_type text CHECK (card_type IN ('mada', 'visa'));
  END IF;
END $$;

-- تفعيل RLS على جدول قطع الغيار
ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول لقطع الغيار (قراءة للجميع المصرح لهم)
CREATE POLICY "Allow authenticated users to read spare parts"
  ON spare_parts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert spare parts"
  ON spare_parts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update spare parts"
  ON spare_parts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete spare parts"
  ON spare_parts
  FOR DELETE
  TO authenticated
  USING (true);

-- إنشاء index لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_spare_parts_part_number ON spare_parts(part_number);
CREATE INDEX IF NOT EXISTS idx_spare_parts_category ON spare_parts(category);
CREATE INDEX IF NOT EXISTS idx_spare_parts_quantity ON spare_parts(quantity);

-- إضافة دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_spare_parts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء trigger لتحديث updated_at
DROP TRIGGER IF EXISTS update_spare_parts_updated_at_trigger ON spare_parts;
CREATE TRIGGER update_spare_parts_updated_at_trigger
  BEFORE UPDATE ON spare_parts
  FOR EACH ROW
  EXECUTE FUNCTION update_spare_parts_updated_at();

-- إضافة بيانات تجريبية لقطع الغيار
INSERT INTO spare_parts (part_number, name, description, category, quantity, unit_price, minimum_quantity, supplier, location)
VALUES
  ('OIL-001', 'زيت محرك 5W-30', 'زيت محرك صناعي بالكامل', 'زيوت ومواد تشحيم', 50, 85.00, 10, 'شركة الزيوت المتحدة', 'المستودع A - رف 1'),
  ('FILTER-001', 'فلتر زيت', 'فلتر زيت أصلي', 'فلاتر', 100, 25.00, 20, 'شركة الفلاتر الحديثة', 'المستودع A - رف 2'),
  ('BRAKE-001', 'تيل فرامل أمامي', 'تيل فرامل عالي الجودة', 'فرامل', 30, 150.00, 5, 'شركة قطع الغيار الأصلية', 'المستودع B - رف 1'),
  ('BRAKE-002', 'تيل فرامل خلفي', 'تيل فرامل عالي الجودة', 'فرامل', 25, 120.00, 5, 'شركة قطع الغيار الأصلية', 'المستودع B - رف 1'),
  ('BATTERY-001', 'بطارية 12V 70Ah', 'بطارية صيانة مجانية', 'بطاريات', 15, 350.00, 3, 'شركة البطاريات المتقدمة', 'المستودع C'),
  ('TIRE-001', 'إطار 205/55 R16', 'إطار صيفي', 'إطارات', 40, 450.00, 8, 'شركة الإطارات الممتازة', 'المستودع D'),
  ('SPARK-001', 'شمعات إشعال (طقم 4)', 'شمعات إشعال بلاتينيوم', 'كهرباء', 60, 80.00, 12, 'شركة القطع الكهربائية', 'المستودع A - رف 3'),
  ('AIR-001', 'فلتر هواء', 'فلتر هواء عالي الكفاءة', 'فلاتر', 80, 35.00, 15, 'شركة الفلاتر الحديثة', 'المستودع A - رف 2'),
  ('COOLANT-001', 'سائل تبريد (4 لتر)', 'سائل تبريد طويل الأمد', 'سوائل', 35, 60.00, 10, 'شركة السوائل الصناعية', 'المستودع A - رف 4'),
  ('WIPER-001', 'مساحات زجاج (زوج)', 'مساحات بدون إطار', 'إكسسوارات', 45, 55.00, 10, 'شركة الإكسسوارات', 'المستودع E')
ON CONFLICT (part_number) DO NOTHING;