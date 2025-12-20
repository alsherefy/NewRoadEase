/*
  # إضافة organization_id لجدول الإعدادات وتحديث البيانات القديمة

  1. التغييرات
    - إضافة عمود organization_id لجدول workshop_settings
    - تحديث جميع البيانات القديمة بـ organization_id
    - إضافة foreign key constraint
    
  2. الأمان
    - تحديث RLS policies لاستخدام organization_id
*/

-- إضافة عمود organization_id لجدول workshop_settings
ALTER TABLE workshop_settings 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

-- تحديث البيانات الموجودة بـ organization_id من أول organization
UPDATE workshop_settings 
SET organization_id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
WHERE organization_id IS NULL;

-- تحديث طلبات الصيانة
UPDATE work_orders 
SET organization_id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
WHERE organization_id IS NULL;

-- تحديث الفواتير
UPDATE invoices 
SET organization_id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
WHERE organization_id IS NULL;

-- تحديث الفنيين
UPDATE technicians 
SET organization_id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
WHERE organization_id IS NULL;

-- تحديث العملاء
UPDATE customers 
SET organization_id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
WHERE organization_id IS NULL;

-- تحديث المركبات
UPDATE vehicles 
SET organization_id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
WHERE organization_id IS NULL;

-- تحديث قطع الغيار
UPDATE spare_parts 
SET organization_id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
WHERE organization_id IS NULL;

-- تحديث المصروفات
UPDATE expenses 
SET organization_id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
WHERE organization_id IS NULL;

-- تحديث الرواتب
UPDATE salaries 
SET organization_id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
WHERE organization_id IS NULL;

-- إعادة إنشاء RLS policies لـ workshop_settings
DROP POLICY IF EXISTS "Users can view workshop settings" ON workshop_settings;
DROP POLICY IF EXISTS "Admins can insert workshop settings" ON workshop_settings;
DROP POLICY IF EXISTS "Admins can update workshop settings" ON workshop_settings;

CREATE POLICY "Users can view own organization settings"
  ON workshop_settings FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert organization settings"
  ON workshop_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update organization settings"
  ON workshop_settings FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- إنشاء index لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_workshop_settings_organization_id ON workshop_settings(organization_id);