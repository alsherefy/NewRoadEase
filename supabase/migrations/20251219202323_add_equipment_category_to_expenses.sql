/*
  # Add Equipment Category to Expenses

  1. Changes
    - Update the category check constraint to include 'equipment'
    - This allows users to categorize expenses for equipment purchases
    
  2. Notes
    - Drops the old constraint and creates a new one with equipment included
*/

-- Drop the old check constraint
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- Add new check constraint with equipment included
ALTER TABLE expenses ADD CONSTRAINT expenses_category_check 
  CHECK (category IN ('salaries', 'maintenance', 'materials', 'equipment', 'rent', 'electricity', 'water', 'fuel', 'other'));