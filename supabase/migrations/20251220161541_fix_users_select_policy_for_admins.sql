/*
  # Fix Users View Policy for Admins

  1. Changes
    - Add policy to allow admins to view all users
    - Keep existing policy for users to view own profile
  
  2. Security
    - Admins can see all users for management purposes
    - Regular users can only see their own profile
*/

-- Add policy for admins to view all users
CREATE POLICY "Admins can view all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (get_current_user_role() = 'admin');
