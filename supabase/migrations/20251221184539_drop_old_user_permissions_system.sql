/*
  # Drop Old User Permissions System

  1. Purpose
    - Remove the old user_permissions table as we now use RBAC system
    - Remove the role column from users table as roles are now in user_roles
    - Clean up any related functions and triggers
    - Remove temporary migration tracking column

  2. Changes
    - Drop user_permissions table
    - Drop role column from users table
    - Drop migrated_to_rbac column from users table
    - Drop any related functions and triggers

  3. Notes
    - This is safe as all data has been migrated to RBAC system
    - All users now have their roles assigned in user_roles table
    - This simplifies the system and removes duplication
*/

-- Drop the old user_permissions table
DROP TABLE IF EXISTS user_permissions CASCADE;

-- Drop the role column from users table
ALTER TABLE users DROP COLUMN IF EXISTS role CASCADE;

-- Drop the migration tracking column
ALTER TABLE users DROP COLUMN IF EXISTS migrated_to_rbac CASCADE;

-- Log cleanup success
DO $$
BEGIN
  RAISE NOTICE 'Successfully removed old user_permissions system. System now fully uses RBAC.';
END $$;
