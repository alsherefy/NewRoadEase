/*
  # إضافة نظام قطع الغيار لطلبات الصيانة

  1. جداول جديدة
    - `work_order_spare_parts` - جدول ربط قطع الغيار بطلبات الصيانة
      - `id` (uuid, primary key)
      - `work_order_id` (uuid, foreign key)
      - `spare_part_id` (uuid, foreign key)
      - `quantity` (decimal, الكمية المستخدمة)
      - `unit_price` (decimal, سعر الوحدة وقت الاستخدام)
      - `total` (decimal, المجموع)
      - `created_at` (timestamptz)

  2. الأمان
    - تفعيل RLS على جدول `work_order_spare_parts`
    - إضافة سياسات الوصول للمستخدمين المصرح لهم

  3. ملاحظات مهمة
    - يتم تخزين سعر القطعة وقت الاستخدام لحفظ السجل
    - يتم تحديث كمية المخزون عند إضافة القطعة للطلب
*/

-- إنشاء جدول ربط قطع الغيار بطلبات الصيانة
CREATE TABLE IF NOT EXISTS work_order_spare_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES work_orders(id) ON DELETE CASCADE NOT NULL,
  spare_part_id uuid REFERENCES spare_parts(id) ON DELETE RESTRICT NOT NULL,
  quantity decimal(10, 2) NOT NULL CHECK (quantity > 0),
  unit_price decimal(10, 2) NOT NULL CHECK (unit_price >= 0),
  total decimal(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at timestamptz DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE work_order_spare_parts ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول
CREATE POLICY "Allow authenticated users to read work order spare parts"
  ON work_order_spare_parts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert work order spare parts"
  ON work_order_spare_parts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update work order spare parts"
  ON work_order_spare_parts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete work order spare parts"
  ON work_order_spare_parts
  FOR DELETE
  TO authenticated
  USING (true);

-- إنشاء index لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_work_order_spare_parts_work_order ON work_order_spare_parts(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_spare_parts_spare_part ON work_order_spare_parts(spare_part_id);