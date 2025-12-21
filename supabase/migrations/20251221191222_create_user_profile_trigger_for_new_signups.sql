/*
  # Auto-Create User Profiles for New Signups

  ## Purpose
  Automatically create user profiles in public.users table when new users sign up via auth.

  ## Changes
  1. Create missing user profiles for existing auth users
  2. Add trigger to automatically create profiles for new signups
  3. Assign default 'receptionist' role to new users

  ## Notes
  - All new users get assigned to the default organization
  - New users are assigned the 'receptionist' role by default
  - Admin must manually upgrade users to higher roles as needed
*/

-- First, get the default organization ID
DO $$
DECLARE
  default_org_id uuid;
  default_role_id uuid;
  missing_user record;
BEGIN
  -- Get default organization
  SELECT id INTO default_org_id FROM organizations LIMIT 1;
  
  IF default_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found. Please create an organization first.';
  END IF;

  -- Get receptionist role for the default organization
  SELECT id INTO default_role_id 
  FROM roles 
  WHERE key = 'receptionist' 
    AND organization_id = default_org_id 
    AND is_system_role = true
  LIMIT 1;

  IF default_role_id IS NULL THEN
    RAISE EXCEPTION 'Receptionist role not found for default organization.';
  END IF;

  -- Create profiles for auth users that don't have them
  FOR missing_user IN 
    SELECT au.id, au.email, COALESCE(au.raw_user_meta_data->>'full_name', 'User') as full_name
    FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.id
    WHERE pu.id IS NULL
  LOOP
    -- Insert user profile
    INSERT INTO public.users (id, email, full_name, organization_id, is_active)
    VALUES (
      missing_user.id,
      missing_user.email,
      missing_user.full_name,
      default_org_id,
      true
    )
    ON CONFLICT (id) DO NOTHING;

    -- Assign receptionist role
    INSERT INTO user_roles (user_id, role_id)
    VALUES (missing_user.id, default_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    RAISE NOTICE 'Created profile for user: %', missing_user.email;
  END LOOP;
END $$;

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  default_org_id uuid;
  default_role_id uuid;
  user_full_name text;
BEGIN
  -- Get default organization
  SELECT id INTO default_org_id FROM organizations LIMIT 1;
  
  IF default_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found. Cannot create user profile.';
  END IF;

  -- Get receptionist role
  SELECT id INTO default_role_id 
  FROM roles 
  WHERE key = 'receptionist' 
    AND organization_id = default_org_id 
    AND is_system_role = true
  LIMIT 1;

  IF default_role_id IS NULL THEN
    RAISE EXCEPTION 'Receptionist role not found. Cannot assign role to user.';
  END IF;

  -- Extract full name from metadata or use email
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  -- Create user profile
  INSERT INTO public.users (id, email, full_name, organization_id, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    user_full_name,
    default_org_id,
    true
  );

  -- Assign default role
  INSERT INTO user_roles (user_id, role_id)
  VALUES (NEW.id, default_role_id);

  RETURN NEW;
END;
$$;

-- Create trigger for new user signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_signup();
