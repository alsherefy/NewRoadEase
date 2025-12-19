/*
  # إضافة حقل الخصم إلى جدول الفواتير

  1. التغييرات
    - إضافة حقل `discount_percentage` (numeric) - نسبة الخصم المئوية
    - إضافة حقل `discount_amount` (numeric) - قيمة الخصم بالريال
  
  2. القيم الافتراضية
    - discount_percentage = 0
    - discount_amount = 0
  
  3. الملاحظات
    - يمكن تطبيق الخصم إما كنسبة مئوية أو كمبلغ ثابت
    - الخصم يطبق على المجموع الفرعي قبل الضريبة
*/

-- إضافة حقول الخصم
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'discount_percentage'
  ) THEN
    ALTER TABLE invoices 
    ADD COLUMN discount_percentage numeric DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'discount_amount'
  ) THEN
    ALTER TABLE invoices 
    ADD COLUMN discount_amount numeric DEFAULT 0 CHECK (discount_amount >= 0);
  END IF;
END $$;

-- تحديث الفواتير الموجودة
UPDATE invoices 
SET discount_percentage = 0, discount_amount = 0
WHERE discount_percentage IS NULL OR discount_amount IS NULL;