/*
  # Add priority field to work_orders

  1. Changes
    - Add `priority` column to work_orders table with values: low, medium, high, urgent
    - Default value is 'medium'
    - Add index for faster filtering by priority
  
  2. Notes
    - This field helps prioritize work orders in the workshop
    - Staff can filter and sort by priority for better workflow management
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'priority'
  ) THEN
    ALTER TABLE work_orders 
    ADD COLUMN priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
    
    CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON work_orders(priority);
  END IF;
END $$;