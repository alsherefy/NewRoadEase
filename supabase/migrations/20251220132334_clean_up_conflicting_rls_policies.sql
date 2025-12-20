/*
  # تنظيف وإصلاح RLS policies المتضاربة

  1. التغييرات
    - حذف جميع policies القديمة والمتضاربة
    - إنشاء policies جديدة محكمة ومتسقة
    - التأكد من عزل البيانات حسب organization_id
    
  2. الأمان
    - policies محكمة تعتمد على organization_id
    - عدم السماح بالوصول إلا لبيانات المنظمة نفسها
*/

-- حذف جميع policies القديمة لـ workshop_settings
DROP POLICY IF EXISTS "Anyone can read workshop settings" ON workshop_settings;
DROP POLICY IF EXISTS "Authenticated users can insert workshop settings" ON workshop_settings;
DROP POLICY IF EXISTS "Authenticated users can update workshop settings" ON workshop_settings;
DROP POLICY IF EXISTS "Users can view own organization settings" ON workshop_settings;
DROP POLICY IF EXISTS "Admins can insert organization settings" ON workshop_settings;
DROP POLICY IF EXISTS "Admins can update organization settings" ON workshop_settings;

-- إنشاء policies جديدة محكمة لـ workshop_settings
CREATE POLICY "Users can view own organization settings"
  ON workshop_settings FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert own organization settings"
  ON workshop_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update own organization settings"
  ON workshop_settings FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- حذف policy الخطيرة لـ work_orders
DROP POLICY IF EXISTS "Allow all access to work_orders" ON work_orders;

-- حذف policies القديمة لـ work_orders
DROP POLICY IF EXISTS "Users can view work orders" ON work_orders;
DROP POLICY IF EXISTS "Users can insert work orders" ON work_orders;
DROP POLICY IF EXISTS "Admins and customer service can delete work orders" ON work_orders;
DROP POLICY IF EXISTS "Admins and customer service can update work orders" ON work_orders;

-- إنشاء policies جديدة محكمة لـ work_orders
CREATE POLICY "Users can view own organization work orders"
  ON work_orders FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own organization work orders"
  ON work_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins and CS can update own organization work orders"
  ON work_orders FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR role = 'customer_service')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR role = 'customer_service')
    )
  );

CREATE POLICY "Admins and CS can delete own organization work orders"
  ON work_orders FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR role = 'customer_service')
    )
  );