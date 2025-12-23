/*
  # حذف الدوال القديمة التي تستخدم عمود role المحذوف

  1. المشكلة
    - الدالة get_current_user_role تحاول الوصول إلى users.role الذي لا يوجد
    - الدالة is_staff_user ربما تستخدم users.role أيضاً
    - هذا يسبب فشل جميع RLS policies التي تستخدم هذه الدوال
    - لا يمكن تحميل بيانات العملاء والفواتير والطلبات

  2. الحل
    - حذف الدوال القديمة التي لم تعد مستخدمة
    - النظام الآن يستخدم RBAC مع user_roles بدلاً من users.role
    - get_user_roles() هي الدالة الجديدة المستخدمة

  3. الدوال المحذوفة
    - get_current_user_role
    - is_staff_user
    - is_admin_user (إن وجدت)
*/

-- حذف الدالة get_current_user_role
DROP FUNCTION IF EXISTS get_current_user_role() CASCADE;

-- حذف الدالة is_staff_user
DROP FUNCTION IF EXISTS is_staff_user() CASCADE;

-- حذف الدالة is_admin_user
DROP FUNCTION IF EXISTS is_admin_user() CASCADE;

-- التحقق من أن get_user_roles موجودة (الدالة الجديدة)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_user_roles'
  ) THEN
    RAISE EXCEPTION 'Missing function: get_user_roles. This function is required for RBAC.';
  END IF;

  RAISE NOTICE 'Old role-based functions dropped successfully';
  RAISE NOTICE 'System now uses RBAC with get_user_roles function';
END $$;
