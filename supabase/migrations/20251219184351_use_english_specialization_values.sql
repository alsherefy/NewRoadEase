/*
  # استخدام القيم الإنجليزية للتخصصات
  
  1. التغييرات
    - تحويل البيانات الموجودة من العربية إلى الإنجليزية
    - تحديث القيد ليسمح بالقيم الإنجليزية فقط
    
  2. التحويلات
    - كهربائي → electrician
    - ميكانيكي → mechanic
    - سمكري → bodywork
    
  3. الملاحظات
    - القيم تُحفظ بالإنجليزية في قاعدة البيانات
    - الترجمة تتم على مستوى الواجهة
*/

-- حذف القيد القديم
DO $$ 
BEGIN
  ALTER TABLE technicians DROP CONSTRAINT IF EXISTS technicians_specialization_check;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- تحديث البيانات الموجودة من العربية إلى الإنجليزية
UPDATE technicians 
SET specialization = CASE 
  WHEN specialization = 'كهربائي' THEN 'electrician'
  WHEN specialization = 'ميكانيكي' THEN 'mechanic'
  WHEN specialization = 'سمكري' THEN 'bodywork'
  ELSE specialization
END;

-- إضافة القيد الجديد بالقيم الإنجليزية
ALTER TABLE technicians 
ADD CONSTRAINT technicians_specialization_check 
CHECK (specialization IN ('electrician', 'mechanic', 'bodywork'));
