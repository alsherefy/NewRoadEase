/*
  # إضافة إعدادات الضريبة إلى جدول الورشة

  1. التغييرات
    - إضافة حقل `tax_enabled` (boolean) - تفعيل/إلغاء الضريبة
    - إضافة حقل `tax_rate` (numeric) - نسبة الضريبة
  
  2. القيم الافتراضية
    - tax_enabled = true (مفعلة افتراضياً)
    - tax_rate = 15 (نسبة الضريبة 15%)
  
  3. ملاحظات
    - عند إلغاء تفعيل الضريبة، لن يتم احتسابها في الفواتير الجديدة
    - يمكن تعديل نسبة الضريبة من صفحة الإعدادات
*/

-- إضافة حقل تفعيل الضريبة
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workshop_settings' AND column_name = 'tax_enabled'
  ) THEN
    ALTER TABLE workshop_settings ADD COLUMN tax_enabled boolean DEFAULT true;
  END IF;
END $$;

-- إضافة حقل نسبة الضريبة
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workshop_settings' AND column_name = 'tax_rate'
  ) THEN
    ALTER TABLE workshop_settings ADD COLUMN tax_rate numeric DEFAULT 15 CHECK (tax_rate >= 0 AND tax_rate <= 100);
  END IF;
END $$;

-- تحديث السجل الموجود إذا كان موجوداً
UPDATE workshop_settings 
SET tax_enabled = true, tax_rate = 15
WHERE tax_enabled IS NULL OR tax_rate IS NULL;