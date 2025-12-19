/*
  # إضافة نوع الضريبة (شاملة أو مضافة)

  1. التغييرات
    - إضافة حقل `tax_type` (text) - نوع الضريبة
      - 'inclusive' = شاملة (القيمة تشمل الضريبة)
      - 'exclusive' = مضافة (الضريبة تضاف على القيمة)
  
  2. القيم الافتراضية
    - tax_type = 'exclusive' (مضافة افتراضياً)
  
  3. أمثلة توضيحية
    - شاملة: سعر المنتج 100 ريال يشمل الضريبة (السعر النهائي 100)
    - مضافة: سعر المنتج 100 ريال + 15 ريال ضريبة = 115 ريال (السعر النهائي 115)
*/

-- إضافة حقل نوع الضريبة
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workshop_settings' AND column_name = 'tax_type'
  ) THEN
    ALTER TABLE workshop_settings 
    ADD COLUMN tax_type text DEFAULT 'exclusive' 
    CHECK (tax_type IN ('inclusive', 'exclusive'));
  END IF;
END $$;

-- تحديث السجل الموجود إذا كان موجوداً
UPDATE workshop_settings 
SET tax_type = 'exclusive'
WHERE tax_type IS NULL;