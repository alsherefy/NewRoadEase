/*
  # إصلاح قيود وقيم التخصصات للفنيين
  
  1. التغييرات
    - حذف القيد القديم أولاً
    - تحديث البيانات الموجودة من القيم الإنجليزية إلى العربية
    - إضافة قيد جديد يسمح بالتخصصات العربية
    
  2. التحويلات
    - electrician → كهربائي
    - mechanic → ميكانيكي
    - bodywork → سمكري
    
  3. الملاحظات
    - حذف القيد أولاً لتجنب أي تعارض
    - تحويل جميع البيانات الموجودة إلى القيم العربية
    - القيد الجديد يدعم فقط التخصصات العربية
*/

-- حذف القيد القديم أولاً
DO $$ 
BEGIN
  ALTER TABLE technicians DROP CONSTRAINT IF EXISTS technicians_specialization_check;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- تحديث البيانات الموجودة
UPDATE technicians 
SET specialization = CASE 
  WHEN specialization = 'electrician' THEN 'كهربائي'
  WHEN specialization = 'mechanic' THEN 'ميكانيكي'
  WHEN specialization = 'bodywork' THEN 'سمكري'
  ELSE specialization
END;

-- إضافة القيد الجديد بالقيم العربية
ALTER TABLE technicians 
ADD CONSTRAINT technicians_specialization_check 
CHECK (specialization IN ('كهربائي', 'ميكانيكي', 'سمكري'));
