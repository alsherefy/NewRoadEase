/*
  # Clean Orphaned Auth Accounts

  ## Purpose
  Remove auth.users accounts that don't have corresponding profiles in public.users table.

  ## Changes
  - Delete orphaned auth accounts
  - Keep only alsherefy@live.com account

  ## Security
  - Only deletes accounts without profiles
  - Preserves the admin account
*/

-- Delete orphaned auth accounts (those without profiles in public.users)
DELETE FROM auth.users
WHERE id IN (
  SELECT au.id 
  FROM auth.users au
  LEFT JOIN public.users pu ON au.id = pu.id
  WHERE pu.id IS NULL
);
