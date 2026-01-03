/*
  # Add Dashboard Customization System

  ## Overview
  This migration adds a comprehensive dashboard customization system that allows fine-grained control
  over what each user sees on their dashboard based on their permissions.

  ## 1. New Dashboard Permissions
  Adds granular permissions for different dashboard sections:
    - `dashboard.view_financial_stats` - View financial statistics and revenue data
    - `dashboard.view_open_orders` - View open work orders panel
    - `dashboard.view_open_invoices` - View open/unpaid invoices panel
    - `dashboard.view_inventory_alerts` - View inventory alerts and low stock warnings
    - `dashboard.view_expenses` - View expenses summary
    - `dashboard.view_technicians_performance` - View technicians performance metrics
    - `dashboard.view_activities` - View recent activities log

  ## 2. New Table: dashboard_preferences
  Stores user-specific dashboard customization preferences:
    - User can show/hide available sections
    - User can reorder sections
    - User can customize items per section
    - Preferences stored as JSON for flexibility

  ## 3. Security
    - Enable RLS on dashboard_preferences table
    - Users can only view/edit their own preferences
    - Default preferences auto-created on user signup

  ## 4. Important Notes
    - Admin users bypass permission checks (see all sections)
    - Permissions checked on both frontend and backend
    - Dashboard sections are dynamically rendered based on permissions
*/

-- Add new dashboard permissions
INSERT INTO permissions (key, resource, action, category, display_order)
VALUES
  ('dashboard.view_financial_stats', 'dashboard', 'view_financial_stats', 'dashboard', 10),
  ('dashboard.view_open_orders', 'dashboard', 'view_open_orders', 'dashboard', 20),
  ('dashboard.view_open_invoices', 'dashboard', 'view_open_invoices', 'dashboard', 30),
  ('dashboard.view_inventory_alerts', 'dashboard', 'view_inventory_alerts', 'dashboard', 40),
  ('dashboard.view_expenses', 'dashboard', 'view_expenses', 'dashboard', 50),
  ('dashboard.view_technicians_performance', 'dashboard', 'view_technicians_performance', 'dashboard', 60),
  ('dashboard.view_activities', 'dashboard', 'view_activities', 'dashboard', 70)
ON CONFLICT (key) DO NOTHING;

-- Create dashboard_preferences table
CREATE TABLE IF NOT EXISTS dashboard_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Array of section keys that are visible to the user
  visible_sections text[] DEFAULT ARRAY[
    'financial_stats',
    'open_orders',
    'open_invoices',
    'inventory_alerts',
    'expenses',
    'technicians_performance',
    'activities'
  ],
  
  -- Array defining the order of sections (by section key)
  section_order text[] DEFAULT ARRAY[
    'financial_stats',
    'open_orders',
    'open_invoices',
    'inventory_alerts',
    'expenses',
    'technicians_performance',
    'activities'
  ],
  
  -- JSON object for additional preferences (items per section, refresh rate, etc.)
  preferences jsonb DEFAULT '{
    "items_per_section": 5,
    "auto_refresh": true,
    "refresh_interval": 60,
    "compact_view": false
  }'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure one preference record per user
  UNIQUE(user_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_dashboard_preferences_user_id ON dashboard_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_preferences_org_id ON dashboard_preferences(organization_id);

-- Enable RLS
ALTER TABLE dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dashboard_preferences
CREATE POLICY "Users can view own dashboard preferences"
  ON dashboard_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own dashboard preferences"
  ON dashboard_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own dashboard preferences"
  ON dashboard_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function to auto-create default dashboard preferences for new users
CREATE OR REPLACE FUNCTION create_default_dashboard_preferences()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO dashboard_preferences (user_id, organization_id)
  VALUES (NEW.id, NEW.organization_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-create preferences when a new user is created
DROP TRIGGER IF EXISTS trigger_create_dashboard_preferences ON users;
CREATE TRIGGER trigger_create_dashboard_preferences
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_dashboard_preferences();

-- Grant dashboard permissions to system roles
DO $$
DECLARE
  admin_role_id uuid;
  customer_service_role_id uuid;
  receptionist_role_id uuid;
  
  perm_financial uuid;
  perm_open_orders uuid;
  perm_open_invoices uuid;
  perm_inventory uuid;
  perm_expenses uuid;
  perm_technicians uuid;
  perm_activities uuid;
BEGIN
  -- Get role IDs
  SELECT id INTO admin_role_id FROM roles WHERE key = 'admin' AND is_system_role = true;
  SELECT id INTO customer_service_role_id FROM roles WHERE key = 'customer_service' AND is_system_role = true;
  SELECT id INTO receptionist_role_id FROM roles WHERE key = 'receptionist' AND is_system_role = true;
  
  -- Get permission IDs
  SELECT id INTO perm_financial FROM permissions WHERE key = 'dashboard.view_financial_stats';
  SELECT id INTO perm_open_orders FROM permissions WHERE key = 'dashboard.view_open_orders';
  SELECT id INTO perm_open_invoices FROM permissions WHERE key = 'dashboard.view_open_invoices';
  SELECT id INTO perm_inventory FROM permissions WHERE key = 'dashboard.view_inventory_alerts';
  SELECT id INTO perm_expenses FROM permissions WHERE key = 'dashboard.view_expenses';
  SELECT id INTO perm_technicians FROM permissions WHERE key = 'dashboard.view_technicians_performance';
  SELECT id INTO perm_activities FROM permissions WHERE key = 'dashboard.view_activities';
  
  -- Admin gets all dashboard permissions (redundant since admin bypasses checks, but for completeness)
  IF admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES
      (admin_role_id, perm_financial),
      (admin_role_id, perm_open_orders),
      (admin_role_id, perm_open_invoices),
      (admin_role_id, perm_inventory),
      (admin_role_id, perm_expenses),
      (admin_role_id, perm_technicians),
      (admin_role_id, perm_activities)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;
  
  -- Customer Service gets most dashboard permissions except financial details
  IF customer_service_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES
      (customer_service_role_id, perm_open_orders),
      (customer_service_role_id, perm_open_invoices),
      (customer_service_role_id, perm_inventory),
      (customer_service_role_id, perm_technicians),
      (customer_service_role_id, perm_activities)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;
  
  -- Receptionist gets basic dashboard permissions
  IF receptionist_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES
      (receptionist_role_id, perm_open_orders),
      (receptionist_role_id, perm_open_invoices),
      (receptionist_role_id, perm_activities)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;
END $$;

-- Create function to get user's customized dashboard sections
CREATE OR REPLACE FUNCTION get_user_dashboard_sections(p_user_id uuid)
RETURNS TABLE (
  section_key text,
  has_permission boolean,
  is_visible boolean,
  section_order integer
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_admin boolean;
  v_preferences record;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id
    AND r.key = 'admin'
    AND r.is_active = true
  ) INTO v_is_admin;
  
  -- Get user preferences
  SELECT * INTO v_preferences
  FROM dashboard_preferences
  WHERE user_id = p_user_id;
  
  -- If no preferences exist, create defaults
  IF v_preferences IS NULL THEN
    INSERT INTO dashboard_preferences (user_id, organization_id)
    SELECT p_user_id, organization_id
    FROM users
    WHERE id = p_user_id
    RETURNING * INTO v_preferences;
  END IF;
  
  -- Return all possible sections with permission check and visibility
  RETURN QUERY
  WITH section_permissions AS (
    SELECT 
      'financial_stats' as key,
      'dashboard.view_financial_stats' as perm_key,
      1 as default_order
    UNION ALL SELECT 'open_orders', 'dashboard.view_open_orders', 2
    UNION ALL SELECT 'open_invoices', 'dashboard.view_open_invoices', 3
    UNION ALL SELECT 'inventory_alerts', 'dashboard.view_inventory_alerts', 4
    UNION ALL SELECT 'expenses', 'dashboard.view_expenses', 5
    UNION ALL SELECT 'technicians_performance', 'dashboard.view_technicians_performance', 6
    UNION ALL SELECT 'activities', 'dashboard.view_activities', 7
  )
  SELECT
    sp.key,
    COALESCE(v_is_admin, user_has_permission(p_user_id, sp.perm_key)) as has_permission,
    (sp.key = ANY(v_preferences.visible_sections)) as is_visible,
    COALESCE(
      array_position(v_preferences.section_order, sp.key),
      sp.default_order
    ) as section_order
  FROM section_permissions sp
  ORDER BY section_order;
END;
$$;

-- Add updated_at trigger for dashboard_preferences
CREATE OR REPLACE FUNCTION update_dashboard_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_dashboard_preferences_updated_at ON dashboard_preferences;
CREATE TRIGGER trigger_update_dashboard_preferences_updated_at
  BEFORE UPDATE ON dashboard_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_dashboard_preferences_updated_at();