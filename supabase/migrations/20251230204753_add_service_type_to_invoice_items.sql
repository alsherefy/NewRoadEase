/*
  # إضافة حقل نوع الخدمة إلى بنود الفاتورة

  ## التغييرات

  1. إضافة حقل service_type إلى جدول invoice_items
    - يسمح هذا الحقل بحفظ نوع الخدمة (ميكانيكا، كهرباء، إلخ) بشكل منفصل عن الوصف
    - يكون الحقل اختياري (nullable) لأن بعض البنود قد تكون قطع غيار وليس خدمات

  2. تحديث البيانات الموجودة
    - استخراج نوع الخدمة من الوصف الحالي للبنود من نوع service
    - الوصف الحالي بتنسيق: "نوع الخدمة - الوصف"
*/

-- إضافة حقل service_type إلى جدول invoice_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_items' AND column_name = 'service_type'
  ) THEN
    ALTER TABLE invoice_items ADD COLUMN service_type text;
  END IF;
END $$;

-- تحديث البيانات الموجودة: استخراج نوع الخدمة من الوصف
-- فقط للبنود من نوع service التي تحتوي على " - " في الوصف
UPDATE invoice_items
SET service_type = SPLIT_PART(description, ' - ', 1),
    description = SPLIT_PART(description, ' - ', 2)
WHERE item_type = 'service'
  AND description LIKE '% - %'
  AND service_type IS NULL;

-- إنشاء فهرس للبحث السريع حسب نوع الخدمة
CREATE INDEX IF NOT EXISTS idx_invoice_items_service_type
  ON invoice_items(service_type)
  WHERE service_type IS NOT NULL;