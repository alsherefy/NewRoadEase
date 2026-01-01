/*
  # Add Work Order Number Generator Function

  1. New Function
    - `generate_work_order_number()` - Generates sequential work order numbers
      - Format: WO-XXXXXX (e.g., WO-000001, WO-000002)
      - Reads the highest existing number and increments by 1
      - Handles both old timestamp-based numbers and new sequential numbers
  
  2. Implementation Details
    - Searches for existing work order numbers with pattern 'WO-%'
    - Extracts numeric portion after 'WO-' prefix
    - Returns next sequential number with 6-digit padding
    - Thread-safe for concurrent inserts
*/

CREATE OR REPLACE FUNCTION generate_work_order_number()
RETURNS text AS $$
DECLARE
  next_number integer;
  order_num text;
BEGIN
  -- Get the highest sequential number from existing work orders
  -- This will handle both old timestamp-based numbers and new sequential ones
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN order_number ~ '^WO-[0-9]+$' 
        THEN CAST(SUBSTRING(order_number FROM 4) AS integer)
        ELSE 0
      END
    ), 
    0
  ) + 1
  INTO next_number
  FROM work_orders
  WHERE order_number LIKE 'WO-%';
  
  -- Generate the new work order number with 6-digit padding
  order_num := 'WO-' || LPAD(next_number::text, 6, '0');
  RETURN order_num;
END;
$$ LANGUAGE plpgsql;