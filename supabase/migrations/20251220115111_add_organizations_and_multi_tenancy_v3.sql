/*
  # Add Organizations and Multi-Tenancy Support

  ## Overview
  This migration adds organization support to enable multi-tenancy and proper data isolation.
  It creates the organizations table and adds organization_id to all business tables.

  ## New Tables
  
  1. `organizations`
     - `id` (uuid, primary key) - Organization unique identifier
     - `name` (text) - Organization name
     - `created_at` (timestamptz) - Creation timestamp
     - `updated_at` (timestamptz) - Last update timestamp

  ## Schema Changes
  
  - Add `organization_id` to users table
  - Add `organization_id` to all business tables:
    - customers
    - vehicles
    - work_orders
    - invoices
    - technicians
    - spare_parts
    - expenses
    - salaries
    - technician_reports
  
  - Update user roles:
    - Map 'employee' and 'customer_service' to 'staff'
    - Support roles: admin, staff, user
  
  ## Indexes
  
  - Added indexes on organization_id columns for performance
  
  ## Security
  
  - Enable RLS on organizations table
  - Create policies for organization access based on user role
  - Admin: access all organizations
  - Staff/User: access only their organization

  ## Notes
  
  - Creates a default organization for existing data
  - All existing users and data assigned to default organization
*/

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add organization_id to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE users ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

-- Remove old constraint, migrate data, then add new constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Migrate existing role values before adding new constraint
UPDATE users SET role = 'staff' WHERE role IN ('employee', 'customer_service');

-- Add new constraint with updated roles
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'staff', 'user'));

-- Add organization_id to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

-- Add organization_id to vehicles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

-- Add organization_id to work_orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

-- Add organization_id to invoices table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

-- Add organization_id to technicians table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technicians' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE technicians ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

-- Add organization_id to spare_parts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'spare_parts' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE spare_parts ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

-- Add organization_id to expenses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE expenses ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

-- Add organization_id to salaries table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'salaries' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE salaries ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

-- Add organization_id to technician_reports table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technician_reports' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE technician_reports ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_organization_id ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_organization_id ON vehicles(organization_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_organization_id ON work_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_technicians_organization_id ON technicians(organization_id);
CREATE INDEX IF NOT EXISTS idx_spare_parts_organization_id ON spare_parts(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_organization_id ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_salaries_organization_id ON salaries(organization_id);
CREATE INDEX IF NOT EXISTS idx_technician_reports_organization_id ON technician_reports(organization_id);

-- Enable RLS on organizations table
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations table
CREATE POLICY "Admins can view all organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM users WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update organizations"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete organizations"
  ON organizations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Add trigger for updated_at on organizations
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create a default organization for existing data
INSERT INTO organizations (name) 
VALUES ('Default Organization')
ON CONFLICT DO NOTHING;

-- Assign all existing users and data to the default organization
DO $$
DECLARE
  default_org_id uuid;
BEGIN
  SELECT id INTO default_org_id FROM organizations WHERE name = 'Default Organization' LIMIT 1;
  
  IF default_org_id IS NOT NULL THEN
    UPDATE users SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE customers SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE vehicles SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE work_orders SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE invoices SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE technicians SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE spare_parts SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE expenses SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE salaries SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE technician_reports SET organization_id = default_org_id WHERE organization_id IS NULL;
  END IF;
END $$;
