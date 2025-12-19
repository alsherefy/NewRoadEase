/*
  # Add Expense Installments System

  1. Changes to `expenses` table
    - Add `payment_type` field (full/installments)
    - Add `total_amount` field for installment tracking
    - Add `installment_months` field (1-12 months)
    - Add `paid_installments` field to track progress
    - Note: 'equipment' category is already supported as text field

  2. New Table: `expense_installments`
    - `id` (uuid, primary key)
    - `expense_id` (uuid, foreign key to expenses)
    - `installment_number` (integer, 1-12)
    - `amount` (numeric, installment amount)
    - `due_date` (date, payment due date)
    - `is_paid` (boolean, payment status)
    - `paid_date` (date, actual payment date)
    - `created_at` (timestamptz)

  3. Security
    - Enable RLS on `expense_installments`
    - Add policies for authenticated users

  4. Notes
    - For full payments: payment_type = 'full', installment_months = NULL
    - For installments: payment_type = 'installments', installment_months = 1-12
    - Installments are auto-generated based on installment_months
    - First installment due date = expense date, subsequent = +1 month each
*/

-- Add new columns to expenses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expenses' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE expenses ADD COLUMN payment_type text DEFAULT 'full' CHECK (payment_type IN ('full', 'installments'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expenses' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE expenses ADD COLUMN total_amount numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expenses' AND column_name = 'installment_months'
  ) THEN
    ALTER TABLE expenses ADD COLUMN installment_months integer CHECK (installment_months >= 1 AND installment_months <= 12);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expenses' AND column_name = 'paid_installments'
  ) THEN
    ALTER TABLE expenses ADD COLUMN paid_installments integer DEFAULT 0;
  END IF;
END $$;

-- Update existing expenses to have proper values
UPDATE expenses 
SET payment_type = 'full', 
    total_amount = amount,
    paid_installments = 1
WHERE payment_type IS NULL;

-- Create expense_installments table
CREATE TABLE IF NOT EXISTS expense_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  installment_number integer NOT NULL CHECK (installment_number >= 1 AND installment_number <= 12),
  amount numeric(10,2) NOT NULL,
  due_date date NOT NULL,
  is_paid boolean DEFAULT false,
  paid_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(expense_id, installment_number)
);

-- Enable RLS
ALTER TABLE expense_installments ENABLE ROW LEVEL SECURITY;

-- Policies for expense_installments
CREATE POLICY "Users can view expense installments"
  ON expense_installments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert expense installments"
  ON expense_installments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update expense installments"
  ON expense_installments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete expense installments"
  ON expense_installments FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_expense_installments_expense_id ON expense_installments(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_installments_due_date ON expense_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_expense_installments_is_paid ON expense_installments(is_paid);

-- Function to generate installments
CREATE OR REPLACE FUNCTION generate_expense_installments()
RETURNS TRIGGER AS $$
DECLARE
  monthly_amount numeric(10,2);
  i integer;
  installment_due_date date;
BEGIN
  -- Only generate installments if payment_type is 'installments'
  IF NEW.payment_type = 'installments' AND NEW.installment_months > 0 THEN
    -- Calculate monthly amount
    monthly_amount := NEW.total_amount / NEW.installment_months;
    
    -- Generate installment records
    FOR i IN 1..NEW.installment_months LOOP
      -- Calculate due date: expense date + (i-1) months
      installment_due_date := NEW.date + (i - 1) * INTERVAL '1 month';
      
      INSERT INTO expense_installments (
        expense_id,
        installment_number,
        amount,
        due_date,
        is_paid,
        paid_date
      ) VALUES (
        NEW.id,
        i,
        monthly_amount,
        installment_due_date,
        CASE WHEN i = 1 THEN true ELSE false END,
        CASE WHEN i = 1 THEN NEW.date ELSE NULL END
      );
    END LOOP;
    
    -- Set paid_installments to 1 (first installment auto-paid)
    NEW.paid_installments := 1;
    -- Set amount to first installment
    NEW.amount := monthly_amount;
  ELSIF NEW.payment_type = 'full' THEN
    -- For full payment, set total_amount = amount
    NEW.total_amount := NEW.amount;
    NEW.paid_installments := 1;
    NEW.installment_months := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_generate_installments ON expenses;
CREATE TRIGGER trigger_generate_installments
  BEFORE INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION generate_expense_installments();