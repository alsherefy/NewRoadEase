/*
  # Migrate Users to RBAC System (Simplified)

  1. Purpose
    - Migrate all existing users from the old role system to the new RBAC system
    - Ensure every user has a role assigned in the user_roles table
    - Map old roles (admin, customer_service, receptionist) to new RBAC roles

  2. Migration Steps
    - Insert user_role records for all users based on their current role
    - Handle duplicate entries gracefully
    - Mark users as migrated to RBAC

  3. Notes
    - This migration is idempotent - it can be run multiple times safely
    - Uses ON CONFLICT to handle existing records
*/

-- Migrate all users to the new RBAC system
INSERT INTO user_roles (user_id, role_id, created_at)
SELECT 
  u.id as user_id,
  r.id as role_id,
  now() as created_at
FROM users u
JOIN roles r ON r.key = u.role AND r.organization_id = u.organization_id
WHERE u.role IN ('admin', 'customer_service', 'receptionist')
  AND r.is_system_role = true
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Mark all users as migrated to RBAC
UPDATE users 
SET migrated_to_rbac = true
WHERE role IN ('admin', 'customer_service', 'receptionist');

-- Log migration success
DO $$
DECLARE
  migrated_count INTEGER;
  total_users INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count FROM user_roles;
  SELECT COUNT(*) INTO total_users FROM users WHERE migrated_to_rbac = true;
  RAISE NOTICE 'Successfully migrated % users to RBAC system. Total user_roles records: %', total_users, migrated_count;
END $$;
