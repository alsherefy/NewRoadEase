/*
  # إزالة سياسات RLS القديمة التي تستخدم عمود role المحذوف

  1. المشكلة
    - سياسات RLS قديمة تحاول الوصول إلى users.role الذي تم حذفه
    - هذا يسبب خطأ "column 'role' does not exist"
    - البيانات لا تظهر لأي مستخدم بسبب فشل السياسات

  2. الحل
    - حذف جميع السياسات القديمة التي تستخدم users.role
    - السياسات الجديدة موجودة بالفعل وتستخدم user_roles و RBAC

  3. الجداول المتأثرة
    - work_orders
    - work_order_services  
    - technician_assignments
    - invoices
    - invoice_items
    - spare_parts
    - work_order_spare_parts
    - vehicles
*/

-- حذف سياسات work_orders القديمة
DROP POLICY IF EXISTS "Staff users can update own organization work orders" ON work_orders;
DROP POLICY IF EXISTS "Staff users can delete own organization work orders" ON work_orders;
DROP POLICY IF EXISTS "Admins and CS can update own organization work orders" ON work_orders;
DROP POLICY IF EXISTS "Admins and CS can delete own organization work orders" ON work_orders;

-- حذف سياسات work_order_services القديمة
DROP POLICY IF EXISTS "Staff users can update own organization work order services" ON work_order_services;
DROP POLICY IF EXISTS "Staff users can delete own organization work order services" ON work_order_services;
DROP POLICY IF EXISTS "Admins and CS can update own organization work order services" ON work_order_services;
DROP POLICY IF EXISTS "Admins and CS can delete own organization work order services" ON work_order_services;

-- حذف سياسات technician_assignments القديمة
DROP POLICY IF EXISTS "Staff users can update own organization technician assignments" ON technician_assignments;
DROP POLICY IF EXISTS "Staff users can delete own organization technician assignments" ON technician_assignments;
DROP POLICY IF EXISTS "Admins and CS can update own organization technician assignments" ON technician_assignments;
DROP POLICY IF EXISTS "Admins and CS can delete own organization technician assignments" ON technician_assignments;

-- حذف سياسات invoices القديمة
DROP POLICY IF EXISTS "Staff users can update own organization invoices" ON invoices;
DROP POLICY IF EXISTS "Staff users can delete own organization invoices" ON invoices;
DROP POLICY IF EXISTS "Admins and CS can update own organization invoices" ON invoices;
DROP POLICY IF EXISTS "Admins and CS can delete own organization invoices" ON invoices;

-- حذف سياسات invoice_items القديمة
DROP POLICY IF EXISTS "Staff users can update own organization invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Staff users can delete own organization invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Admins and CS can update own organization invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Admins and CS can delete own organization invoice items" ON invoice_items;

-- حذف سياسات spare_parts القديمة إن وجدت
DROP POLICY IF EXISTS "Staff users can update spare parts" ON spare_parts;
DROP POLICY IF EXISTS "Staff users can delete spare parts" ON spare_parts;

-- حذف سياسات work_order_spare_parts القديمة إن وجدت
DROP POLICY IF EXISTS "Staff users can update work order spare parts" ON work_order_spare_parts;
DROP POLICY IF EXISTS "Staff users can delete work order spare parts" ON work_order_spare_parts;

-- التحقق من أن السياسات الجديدة موجودة
DO $$
BEGIN
  -- التحقق من وجود السياسات البسيطة للعرض
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customers' 
    AND policyname = 'Users can view own organization customers'
  ) THEN
    RAISE EXCEPTION 'Missing RLS policy: Users can view own organization customers';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'work_orders' 
    AND policyname = 'Users can view own organization work orders'
  ) THEN
    RAISE EXCEPTION 'Missing RLS policy: Users can view own organization work orders';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'invoices' 
    AND policyname = 'Users can view own organization invoices'
  ) THEN
    RAISE EXCEPTION 'Missing RLS policy: Users can view own organization invoices';
  END IF;

  RAISE NOTICE 'Old role-based RLS policies removed successfully';
  RAISE NOTICE 'New organization-based RLS policies verified';
END $$;
