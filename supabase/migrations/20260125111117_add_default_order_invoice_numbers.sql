/*
  # Add Default Values for Order and Invoice Numbers

  1. Purpose
    - Add DEFAULT values for work_orders.order_number using generate_work_order_number()
    - Add DEFAULT values for invoices.invoice_number using generate_invoice_number()
    - This fixes the issue where frontend doesn't provide these values on INSERT

  2. Root Cause
    - Frontend sends INSERT without order_number/invoice_number
    - These columns are NOT NULL but have no default
    - INSERT fails with constraint violation

  3. Solution
    - Set DEFAULT generate_work_order_number() for work_orders.order_number
    - Set DEFAULT generate_invoice_number() for invoices.invoice_number
    - Now these values are automatically generated on INSERT
*/

-- Work orders table: add default for order_number
ALTER TABLE work_orders 
ALTER COLUMN order_number SET DEFAULT generate_work_order_number();

-- Invoices table: add default for invoice_number
ALTER TABLE invoices 
ALTER COLUMN invoice_number SET DEFAULT generate_invoice_number();