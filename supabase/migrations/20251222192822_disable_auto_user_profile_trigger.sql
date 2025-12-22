/*
  # Disable Automatic User Profile Creation Trigger

  1. Changes
    - Disable the on_auth_user_created trigger that automatically creates user profiles
    - This trigger conflicts with the users edge function which creates profiles manually
    - The edge function has more control over role assignment and organization selection

  2. Security
    - User profiles will be created by the users edge function only
    - This prevents duplicate profile creation and conflicts
*/

-- Disable the automatic user profile creation trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the function if not needed elsewhere
DROP FUNCTION IF EXISTS handle_new_user_signup();