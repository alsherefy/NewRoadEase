/*
  # إصلاح RLS Policies لجداول العملاء والسيارات

  1. المشكلة
    - جداول customers و vehicles لا تحتوي على SELECT و INSERT policies
    - هذا يمنع المستخدمين من قراءة أو إضافة بيانات

  2. الحل
    - إضافة SELECT policies لقراءة البيانات
    - إضافة INSERT policies لإضافة بيانات جديدة
    - كل المستخدمين يمكنهم القراءة والإضافة ضمن منظمتهم فقط
    
  3. الأمان
    - جميع العمليات محكمة بـ organization_id
    - كل مستخدم يرى فقط بيانات منظمته
*/

-- إضافة SELECT policies لجدول customers
CREATE POLICY "Users can view own organization customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- إضافة INSERT policy لجدول customers
CREATE POLICY "Users can insert own organization customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- إضافة SELECT policies لجدول vehicles
CREATE POLICY "Users can view own organization vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- إضافة INSERT policy لجدول vehicles
CREATE POLICY "Users can insert own organization vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );
