/*
  # Fix Expense Installments Trigger

  1. Changes
    - Update generate_expense_installments function to use correct column name
    - Change NEW.date to NEW.expense_date throughout the function

  2. Notes
    - This fixes the error when adding new expenses
    - The column name in the expenses table is expense_date, not date
*/

-- Drop and recreate the function with correct column name
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