/*
  # Fix RLS Policies for Receptionist Role

  ## Problem
  The `is_admin_or_customer_service()` function only checks for 'admin' and 'customer_service' roles,
  excluding 'receptionist' users from accessing data even when they have proper permissions.

  ## Changes
  1. Drop existing policies that use the old function
  2. Drop the old `is_admin_or_customer_service()` function
  3. Create new `is_staff_user()` function that includes 'receptionist' role
  4. Recreate policies with the new function

  ## Security
  - Maintains RLS security by checking user role and active status
  - Only authenticated users with proper roles can access data
*/

-- Step 1: Drop existing policies on customers table
DROP POLICY IF EXISTS "Admins and customer service can delete customers" ON customers;
DROP POLICY IF EXISTS "Admins and customer service can update customers" ON customers;

-- Step 2: Drop existing policies on vehicles table
DROP POLICY IF EXISTS "Admins and customer service can delete vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins and customer service can update vehicles" ON vehicles;

-- Step 3: Drop the old function now that policies are removed
DROP FUNCTION IF EXISTS is_admin_or_customer_service();

-- Step 4: Create new function with better name that includes all staff roles
CREATE OR REPLACE FUNCTION is_staff_user()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND is_active = true 
    AND role IN ('admin', 'customer_service', 'receptionist')
  );
$$;

-- Step 5: Recreate customers table policies with new function
CREATE POLICY "Staff users can delete customers"
  ON customers
  FOR DELETE
  TO authenticated
  USING (is_staff_user());

CREATE POLICY "Staff users can update customers"
  ON customers
  FOR UPDATE
  TO authenticated
  USING (is_staff_user())
  WITH CHECK (is_staff_user());

-- Step 6: Recreate vehicles table policies with new function
CREATE POLICY "Staff users can delete vehicles"
  ON vehicles
  FOR DELETE
  TO authenticated
  USING (is_staff_user());

CREATE POLICY "Staff users can update vehicles"
  ON vehicles
  FOR UPDATE
  TO authenticated
  USING (is_staff_user())
  WITH CHECK (is_staff_user());
