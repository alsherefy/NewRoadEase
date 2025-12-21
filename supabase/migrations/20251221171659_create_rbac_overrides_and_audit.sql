/*
  # إنشاء جداول الصلاحيات الاستثنائية وسجل التدقيق
  
  1. الجداول الجديدة
    - user_permission_overrides - للصلاحيات الاستثنائية للمستخدمين
    - rbac_audit_logs - سجل التدقيق لجميع تغييرات RBAC
  
  2. الأمان
    - تفعيل RLS
    - سياسات أمان للإدارة والقراءة
*/

-- جدول الصلاحيات الاستثنائية للمستخدمين
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE NOT NULL,
  is_granted boolean DEFAULT true,
  reason text,
  granted_by uuid REFERENCES users(id),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_permission_override UNIQUE (user_id, permission_id)
);

-- جدول سجل التدقيق
CREATE TABLE IF NOT EXISTS rbac_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- إنشاء الفهارس
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user_id ON user_permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_permission_id ON user_permission_overrides(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_expires_at ON user_permission_overrides(expires_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON rbac_audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON rbac_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON rbac_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON rbac_audit_logs(action);

-- تفعيل RLS
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbac_audit_logs ENABLE ROW LEVEL SECURITY;

-- سياسات RLS للصلاحيات الاستثنائية
CREATE POLICY "Users can view their own permission overrides"
  ON user_permission_overrides FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT id FROM users WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "Only admins can manage permission overrides"
  ON user_permission_overrides FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "Only admins can delete permission overrides"
  ON user_permission_overrides FOR DELETE
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM users WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

-- سياسات RLS لسجل التدقيق
CREATE POLICY "Admins can view audit logs in their organization"
  ON rbac_audit_logs FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can insert audit logs"
  ON rbac_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);
