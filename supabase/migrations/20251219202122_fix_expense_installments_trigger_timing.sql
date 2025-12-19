/*
  # Fix Expense Installments Trigger Timing

  1. Changes
    - Split the trigger into two separate triggers
    - BEFORE INSERT: Sets up expense data (amount, total_amount)
    - AFTER INSERT: Creates installment records (after expense exists)
    
  2. Notes
    - This fixes the foreign key constraint violation
    - Installments are now created after the expense record exists
*/

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_generate_installments ON expenses;

-- Function for BEFORE INSERT - prepares expense data
CREATE OR REPLACE FUNCTION prepare_expense_data()
RETURNS TRIGGER AS $$
DECLARE
  monthly_amount numeric(10,2);
BEGIN
  IF NEW.payment_type = 'installments' AND NEW.installment_months > 0 THEN
    -- Calculate monthly amount
    monthly_amount := NEW.total_amount / NEW.installment_months;
    
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

-- Function for AFTER INSERT - creates installment records
CREATE OR REPLACE FUNCTION create_expense_installments()
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
      installment_due_date := NEW.expense_date + (i - 1) * INTERVAL '1 month';
      
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
        CASE WHEN i = 1 THEN NEW.expense_date ELSE NULL END
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create BEFORE INSERT trigger for data preparation
CREATE TRIGGER trigger_prepare_expense_data
  BEFORE INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION prepare_expense_data();

-- Create AFTER INSERT trigger for installment creation
CREATE TRIGGER trigger_create_expense_installments
  AFTER INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION create_expense_installments();