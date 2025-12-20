/*
  # Update User Roles System

  1. Changes
    - Drop existing role check constraint
    - Update existing user roles from old system to new system:
      * 'staff' → 'customer_service'
      * 'user' → 'receptionist'
      * 'admin' → 'admin' (unchanged)
    - Add new constraint with three roles: admin, customer_service, receptionist
  
  2. Role Definitions
    - admin: Full system access, can delete orders and invoices
    - customer_service: Can delete orders and invoices, manage most operations
    - receptionist: Limited access, cannot delete orders or invoices
  
  3. Security
    - Maintains existing RLS policies
    - Role constraint ensures data integrity
*/

-- Remove old constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Migrate existing role values to new system
UPDATE users SET role = 'customer_service' WHERE role = 'staff';
UPDATE users SET role = 'receptionist' WHERE role = 'user';

-- Add new constraint with updated roles
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'customer_service', 'receptionist'));
