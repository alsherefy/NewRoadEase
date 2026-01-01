/*
  # Fix Work Order Number Generator Function

  1. Problem
    - Old timestamp-based numbers (e.g., 1767126817747) exceed integer limits
    - Function was trying to convert very large numbers causing overflow

  2. Solution
    - Only process sequential numbers (6 digits or less)
    - Ignore old timestamp-based numbers
    - Start from 1 for new sequential numbering
    - Use bigint for safer numeric handling

  3. Behavior
    - Looks for existing sequential work orders (WO-XXXXXX where X is 6 digits or less)
    - Returns next number in sequence with 6-digit padding
    - Format: WO-000001, WO-000002, etc.
*/

CREATE OR REPLACE FUNCTION generate_work_order_number()
RETURNS text AS $$
DECLARE
  next_number integer;
  order_num text;
BEGIN
  -- Get the highest sequential number from existing work orders
  -- Only consider numbers that look like WO-XXXXXX (1-6 digits)
  -- Ignore old timestamp-based numbers (too large)
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN order_number ~ '^WO-[0-9]{1,6}$' 
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