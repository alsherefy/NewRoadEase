/*
  # إضافة جدول إعدادات الورشة
  
  1. جداول جديدة
    - `workshop_settings`
      - `id` (uuid, primary key)
      - `name` (text) - اسم الورشة
      - `phone` (text) - رقم الهاتف
      - `address` (text) - العنوان
      - `email` (text) - البريد الإلكتروني
      - `tax_number` (text) - الرقم الضريبي
      - `commercial_registration` (text) - السجل التجاري
      - `logo_url` (text) - رابط الشعار
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. الأمان
    - تفعيل RLS على الجدول
    - السماح بالقراءة للجميع
    - السماح بالتعديل للمستخدمين المصرح لهم فقط
*/

CREATE TABLE IF NOT EXISTS workshop_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'ورشة الصيانة',
  phone text DEFAULT '',
  address text DEFAULT '',
  email text DEFAULT '',
  tax_number text DEFAULT '',
  commercial_registration text DEFAULT '',
  logo_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workshop_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read workshop settings"
  ON workshop_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can update workshop settings"
  ON workshop_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert workshop settings"
  ON workshop_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

INSERT INTO workshop_settings (name, phone, address, email)
VALUES ('ورشة الصيانة', '0500000000', 'الرياض، المملكة العربية السعودية', 'info@workshop.com')
ON CONFLICT DO NOTHING;