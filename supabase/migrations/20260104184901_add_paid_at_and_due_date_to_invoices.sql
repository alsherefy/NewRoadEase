/*
  # Add Payment and Due Date Tracking to Invoices

  ## Problem
  The invoices table is missing critical timestamp fields needed for financial reporting:
  - `paid_at` - timestamp when invoice was paid
  - `due_date` - when payment is due (for calculating overdue invoices)

  ## Changes
  1. Add `paid_at` column (timestamptz, nullable)
  2. Add `due_date` column (timestamptz, nullable, default 30 days from creation)
  3. Backfill `paid_at` for existing paid invoices (use updated_at as approximation)
  4. Set `due_date` for existing invoices (30 days from created_at)
  5. Add trigger to auto-set `paid_at` when status becomes 'paid'

  ## Impact
  - Dashboard financial stats will now work correctly
  - Overdue invoice tracking will function properly
*/

-- 1. Add the missing columns
ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS due_date timestamptz;

-- 2. Backfill paid_at for existing paid invoices
-- Use updated_at as a reasonable approximation of when they were paid
UPDATE invoices
SET paid_at = updated_at
WHERE payment_status = 'paid' 
  AND paid_at IS NULL;

-- 3. Set due_date for existing invoices (30 days from creation)
UPDATE invoices
SET due_date = created_at + INTERVAL '30 days'
WHERE due_date IS NULL;

-- 4. Create trigger function to auto-set paid_at when status becomes 'paid'
CREATE OR REPLACE FUNCTION set_invoice_paid_at()
RETURNS TRIGGER AS $$
BEGIN
  -- If payment_status is changing to 'paid' and paid_at is not set
  IF NEW.payment_status = 'paid' AND OLD.payment_status != 'paid' AND NEW.paid_at IS NULL THEN
    NEW.paid_at = NOW();
  END IF;
  
  -- If payment_status is changing from 'paid' to something else, clear paid_at
  IF OLD.payment_status = 'paid' AND NEW.payment_status != 'paid' THEN
    NEW.paid_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach trigger to invoices table
DROP TRIGGER IF EXISTS trigger_set_invoice_paid_at ON invoices;
CREATE TRIGGER trigger_set_invoice_paid_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_paid_at();

-- 6. Create index for performance on date-based queries
CREATE INDEX IF NOT EXISTS idx_invoices_paid_at ON invoices(paid_at) WHERE paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status_paid_at ON invoices(payment_status, paid_at);
