/*
  # Add Default Organization ID - Critical Fix

  1. Purpose
    - Add DEFAULT value for organization_id columns to automatically use current user's organization
    - This fixes the issue where frontend doesn't send organization_id in INSERT operations
    - RLS policies require organization_id to match, so this ensures it's always set correctly

  2. Root Cause
    - Frontend sends INSERT data without organization_id
    - RLS policies check: organization_id = get_user_organization_id()
    - When organization_id is NULL, the check fails and INSERT is blocked

  3. Solution
    - Set DEFAULT get_user_organization_id() for organization_id in all relevant tables
    - This ensures organization_id is automatically populated on INSERT
    - Works seamlessly with existing RLS policies

  4. Tables Modified
    - customers
    - vehicles
    - work_orders
    - invoices
    - spare_parts
    - expenses
    - technicians
    - salaries
*/

-- Customers table
ALTER TABLE customers 
ALTER COLUMN organization_id SET DEFAULT get_user_organization_id();

-- Vehicles table
ALTER TABLE vehicles 
ALTER COLUMN organization_id SET DEFAULT get_user_organization_id();

-- Work orders table
ALTER TABLE work_orders 
ALTER COLUMN organization_id SET DEFAULT get_user_organization_id();

-- Invoices table
ALTER TABLE invoices 
ALTER COLUMN organization_id SET DEFAULT get_user_organization_id();

-- Spare parts table
ALTER TABLE spare_parts 
ALTER COLUMN organization_id SET DEFAULT get_user_organization_id();

-- Expenses table
ALTER TABLE expenses 
ALTER COLUMN organization_id SET DEFAULT get_user_organization_id();

-- Technicians table
ALTER TABLE technicians 
ALTER COLUMN organization_id SET DEFAULT get_user_organization_id();

-- Salaries table
ALTER TABLE salaries 
ALTER COLUMN organization_id SET DEFAULT get_user_organization_id();