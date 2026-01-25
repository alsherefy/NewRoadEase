/*
  # Clean Orphaned Auth Users (V2)

  1. Purpose
    - Remove users from auth.users who don't have a profile in public.users
    - This fixes login issues for users who exist in auth but not in the system
    - Keep only users with valid profiles

  2. Safety
    - Only deletes users who are NOT in public.users
    - Preserves all users with valid profiles
*/

-- Delete auth users that don't have a corresponding public.users record
DO $$
DECLARE
  orphaned_user RECORD;
  deleted_count INTEGER := 0;
BEGIN
  FOR orphaned_user IN 
    SELECT au.id, au.email
    FROM auth.users au
    LEFT JOIN public.users pu ON pu.id = au.id
    WHERE pu.id IS NULL
  LOOP
    -- Delete from auth.users
    DELETE FROM auth.users WHERE id = orphaned_user.id;
    deleted_count := deleted_count + 1;
    
    RAISE NOTICE 'Deleted orphaned user: % (%)', orphaned_user.email, orphaned_user.id;
  END LOOP;
  
  RAISE NOTICE 'Total orphaned users deleted: %', deleted_count;
END $$;