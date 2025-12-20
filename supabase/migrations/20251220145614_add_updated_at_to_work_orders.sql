/*
  # إضافة عمود updated_at لجدول work_orders

  1. التغييرات
    - إضافة عمود updated_at إلى جدول work_orders
    - إعداد قيمة افتراضية للسجلات الموجودة
    - إضافة trigger لتحديث updated_at تلقائياً
*/

-- إضافة عمود updated_at
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- تحديث السجلات الموجودة
UPDATE work_orders 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- إنشاء trigger function لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_work_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إضافة trigger
DROP TRIGGER IF EXISTS set_work_orders_updated_at ON work_orders;
CREATE TRIGGER set_work_orders_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_work_orders_updated_at();
