/*
  # تنظيف جداول البيانات الأساسية
  
  ## الهدف
  إزالة جميع النصوص المترجمة من قاعدة البيانات والاعتماد على مفاتيح الترجمة فقط
  
  ## التغييرات
  
  ### 1. جدول roles
  - حذف حقل name (النص العربي)
  - حذف حقل name_en (النص الإنجليزي)
  - الاحتفاظ فقط بحقل key للاستخدام في نظام الترجمة
  
  ### 2. جدول permissions
  - حذف حقل name_ar (النص العربي)
  - حذف حقل name_en (النص الإنجليزي)
  - حذف حقل description_ar (الوصف العربي)
  - حذف حقل description_en (الوصف الإنجليزي)
  - الاحتفاظ بـ key, resource, action, category للاستخدام في نظام الترجمة
  
  ## الفوائد
  - قاعدة بيانات نظيفة بالإنجليزية فقط
  - سهولة إضافة لغات جديدة
  - فصل واضح بين System Data و User Data
  - صيانة أسهل - الترجمات في مكان واحد
  
  ## الملاحظات
  - البيانات المدخلة يدوياً (أسماء العملاء، الملاحظات) لا تتأثر
  - النصوص ستأتي من ملفات الترجمة في Frontend
*/

-- حذف الأعمدة غير المطلوبة من جدول roles
ALTER TABLE roles DROP COLUMN IF EXISTS name;
ALTER TABLE roles DROP COLUMN IF EXISTS name_en;

-- حذف الأعمدة غير المطلوبة من جدول permissions
ALTER TABLE permissions DROP COLUMN IF EXISTS name_ar;
ALTER TABLE permissions DROP COLUMN IF EXISTS name_en;
ALTER TABLE permissions DROP COLUMN IF EXISTS description_ar;
ALTER TABLE permissions DROP COLUMN IF EXISTS description_en;
