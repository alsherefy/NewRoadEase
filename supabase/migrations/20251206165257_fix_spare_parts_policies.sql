/*
  # Fix Spare Parts Access Policies

  ## Changes
  - Update RLS policies to allow anonymous users (anon role) to manage spare parts
  - This enables the application to work without authentication
  
  ## Security Note
  - Currently allowing anon access for workshop management
  - Should add authentication in production environment
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to read spare parts" ON spare_parts;
DROP POLICY IF EXISTS "Allow authenticated users to insert spare parts" ON spare_parts;
DROP POLICY IF EXISTS "Allow authenticated users to update spare parts" ON spare_parts;
DROP POLICY IF EXISTS "Allow authenticated users to delete spare parts" ON spare_parts;

-- Create new policies that allow anon access
CREATE POLICY "Allow all to read spare parts"
  ON spare_parts
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all to insert spare parts"
  ON spare_parts
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all to update spare parts"
  ON spare_parts
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all to delete spare parts"
  ON spare_parts
  FOR DELETE
  TO anon, authenticated
  USING (true);
