/*
  # إضافة نوع الضريبة إلى جدول الفواتير

  1. التغييرات
    - إضافة حقل `tax_type` (text) إلى جدول `invoices`
      - 'inclusive' = شاملة (السعر يشمل الضريبة)
      - 'exclusive' = مضافة (الضريبة تضاف على السعر)
  
  2. القيم الافتراضية
    - tax_type = 'exclusive' (مضافة افتراضياً)
  
  3. الملاحظات
    - هذا الحقل يحدد كيفية حساب الضريبة في كل فاتورة
    - سيتم نسخ القيمة من إعدادات الورشة عند إنشاء الفاتورة
*/

-- إضافة حقل نوع الضريبة إلى جدول الفواتير
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'tax_type'
  ) THEN
    ALTER TABLE invoices 
    ADD COLUMN tax_type text DEFAULT 'exclusive' 
    CHECK (tax_type IN ('inclusive', 'exclusive'));
  END IF;
END $$;

-- تحديث الفواتير الموجودة
UPDATE invoices 
SET tax_type = 'exclusive'
WHERE tax_type IS NULL;