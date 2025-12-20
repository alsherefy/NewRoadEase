/*
  # إصلاح سياسات الأمان لجدول الفواتير

  1. المشكلة
    - جدول invoices يفتقد إلى سياسات SELECT و INSERT
    - المستخدمون لا يستطيعون إنشاء أو عرض الفواتير بسبب RLS

  2. الحل
    - إضافة policy للسماح بعرض الفواتير حسب organization_id
    - إضافة policy للسماح بإنشاء الفواتير حسب organization_id

  3. الأمان
    - جميع السياسات تعتمد على organization_id
    - كل منظمة يمكنها فقط الوصول لبياناتها
*/

-- حذف أي policies قديمة متضاربة
DROP POLICY IF EXISTS "Allow all access to invoices" ON invoices;

-- إضافة policy للسماح بعرض الفواتير
CREATE POLICY "Users can view own organization invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- إضافة policy للسماح بإنشاء الفواتير
CREATE POLICY "Users can insert own organization invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- تحديث policies للـ UPDATE والـ DELETE لتشمل organization_id
DROP POLICY IF EXISTS "Admins and customer service can update invoices" ON invoices;
DROP POLICY IF EXISTS "Admins and customer service can delete invoices" ON invoices;

CREATE POLICY "Admins and CS can update own organization invoices"
  ON invoices FOR UPDATE
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

CREATE POLICY "Admins and CS can delete own organization invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR role = 'customer_service')
    )
  );