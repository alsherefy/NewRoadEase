/*
  # إضافة حقل البدلات للفنيين
  
  1. التغييرات
    - إضافة حقل `allowances` لجدول `technicians`
    - القيمة الافتراضية: 0
    
  2. الملاحظات
    - البدلات تُضاف للراتب الثابت فقط
    - يتم استخدامها في حساب الراتب النهائي
*/

-- إضافة حقل البدلات إلى جدول الفنيين
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'technicians' AND column_name = 'allowances'
  ) THEN
    ALTER TABLE technicians ADD COLUMN allowances numeric DEFAULT 0;
  END IF;
END $$;
