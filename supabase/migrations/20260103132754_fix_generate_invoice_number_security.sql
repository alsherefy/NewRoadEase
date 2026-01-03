/*
  # Fix generate_invoice_number Function Security

  1. Changes
    - Make generate_invoice_number function SECURITY DEFINER
    - This allows it to bypass RLS policies when generating invoice numbers
    - Function needs to read all invoices to calculate next number

  2. Security
    - Function is read-only (SELECT only)
    - No user input is used in the query
    - Safe to use SECURITY DEFINER
*/

-- Drop and recreate the function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  next_number integer;
  invoice_num text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS integer)), 0) + 1
  INTO next_number
  FROM invoices
  WHERE invoice_number LIKE 'INV-%';

  invoice_num := 'INV-' || LPAD(next_number::text, 6, '0');
  RETURN invoice_num;
END;
$$;
