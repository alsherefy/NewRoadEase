/*
  # Add CHECK Constraints for Data Integrity (Numeric and Logical Only)

  1. CHECK Constraints Added
    - Numeric constraints: amounts, quantities, percentages must be valid
    - Logical constraints: dates, ranges must be reasonable
    - Status constraints: only for English status values
    
  2. Excluded
    - Enum constraints for fields that may contain Arabic text
    - Service types, categories, specializations with localized values

  3. Benefits
    - Prevents invalid numeric data
    - Enforces logical business rules
    - Compatible with existing localized data
    - Improves data quality without breaking existing records
*/

-- =====================================================
-- WORK ORDERS CONSTRAINTS
-- =====================================================

DO $$ BEGIN
  ALTER TABLE work_orders
    ADD CONSTRAINT check_work_orders_status 
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE work_orders
    ADD CONSTRAINT check_work_orders_priority 
    CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE work_orders
    ADD CONSTRAINT check_work_orders_labor_cost_positive 
    CHECK (total_labor_cost >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE work_orders
    ADD CONSTRAINT check_work_orders_completed_after_created 
    CHECK (completed_at IS NULL OR completed_at >= created_at);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- INVOICES CONSTRAINTS
-- =====================================================

DO $$ BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT check_invoices_payment_status 
    CHECK (payment_status IN ('paid', 'partial', 'unpaid'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT check_invoices_subtotal_positive 
    CHECK (subtotal >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT check_invoices_tax_amount_positive 
    CHECK (tax_amount >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT check_invoices_total_positive 
    CHECK (total >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT check_invoices_paid_amount_positive 
    CHECK (paid_amount >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT check_invoices_paid_not_exceed_total 
    CHECK (paid_amount <= total);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT check_invoices_discount_percentage_range 
    CHECK (discount_percentage >= 0 AND discount_percentage <= 100);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT check_invoices_tax_rate_positive 
    CHECK (tax_rate >= 0 AND tax_rate <= 100);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT check_invoices_discount_amount_positive 
    CHECK (discount_amount >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- INVOICE ITEMS CONSTRAINTS
-- =====================================================

DO $$ BEGIN
  ALTER TABLE invoice_items
    ADD CONSTRAINT check_invoice_items_quantity_positive 
    CHECK (quantity > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE invoice_items
    ADD CONSTRAINT check_invoice_items_unit_price_positive 
    CHECK (unit_price >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE invoice_items
    ADD CONSTRAINT check_invoice_items_total_positive 
    CHECK (total >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- EXPENSES CONSTRAINTS
-- =====================================================

DO $$ BEGIN
  ALTER TABLE expenses
    ADD CONSTRAINT check_expenses_amount_positive 
    CHECK (amount > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE expenses
    ADD CONSTRAINT check_expenses_total_amount_positive 
    CHECK (total_amount IS NULL OR total_amount > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE expenses
    ADD CONSTRAINT check_expenses_installment_months_positive 
    CHECK (installment_months IS NULL OR installment_months > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE expenses
    ADD CONSTRAINT check_expenses_paid_installments_valid 
    CHECK (paid_installments IS NULL OR (paid_installments >= 0 AND (installment_months IS NULL OR paid_installments <= installment_months)));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- EXPENSE INSTALLMENTS CONSTRAINTS
-- =====================================================

DO $$ BEGIN
  ALTER TABLE expense_installments
    ADD CONSTRAINT check_expense_installments_amount_positive 
    CHECK (amount > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE expense_installments
    ADD CONSTRAINT check_expense_installments_number_positive 
    CHECK (installment_number > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- SALARIES CONSTRAINTS
-- =====================================================

DO $$ BEGIN
  ALTER TABLE salaries
    ADD CONSTRAINT check_salaries_month_range 
    CHECK (month >= 1 AND month <= 12);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE salaries
    ADD CONSTRAINT check_salaries_year_reasonable 
    CHECK (year >= 2020 AND year <= EXTRACT(YEAR FROM CURRENT_DATE) + 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE salaries
    ADD CONSTRAINT check_salaries_basic_salary_positive 
    CHECK (basic_salary >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE salaries
    ADD CONSTRAINT check_salaries_commission_positive 
    CHECK (commission_amount >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE salaries
    ADD CONSTRAINT check_salaries_bonus_positive 
    CHECK (bonus >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE salaries
    ADD CONSTRAINT check_salaries_total_positive 
    CHECK (total_salary >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE salaries
    ADD CONSTRAINT check_salaries_payment_status 
    CHECK (payment_status IN ('paid', 'partial', 'unpaid'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE salaries
    ADD CONSTRAINT check_salaries_paid_amount_positive 
    CHECK (paid_amount >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE salaries
    ADD CONSTRAINT check_salaries_work_orders_count_positive 
    CHECK (work_orders_count >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE salaries
    ADD CONSTRAINT check_salaries_work_orders_value_positive 
    CHECK (total_work_orders_value >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- SPARE PARTS CONSTRAINTS
-- =====================================================

DO $$ BEGIN
  ALTER TABLE spare_parts
    ADD CONSTRAINT check_spare_parts_quantity_non_negative 
    CHECK (quantity >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE spare_parts
    ADD CONSTRAINT check_spare_parts_unit_price_positive 
    CHECK (unit_price >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE spare_parts
    ADD CONSTRAINT check_spare_parts_minimum_quantity_non_negative 
    CHECK (minimum_quantity >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- WORK ORDER SPARE PARTS CONSTRAINTS
-- =====================================================

DO $$ BEGIN
  ALTER TABLE work_order_spare_parts
    ADD CONSTRAINT check_work_order_spare_parts_quantity_positive 
    CHECK (quantity > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE work_order_spare_parts
    ADD CONSTRAINT check_work_order_spare_parts_unit_price_positive 
    CHECK (unit_price >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE work_order_spare_parts
    ADD CONSTRAINT check_work_order_spare_parts_total_positive 
    CHECK (total >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- WORK ORDER SERVICES CONSTRAINTS
-- =====================================================

DO $$ BEGIN
  ALTER TABLE work_order_services
    ADD CONSTRAINT check_work_order_services_labor_cost_positive 
    CHECK (labor_cost >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- TECHNICIANS CONSTRAINTS (Numeric only)
-- =====================================================

DO $$ BEGIN
  ALTER TABLE technicians
    ADD CONSTRAINT check_technicians_percentage_range 
    CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE technicians
    ADD CONSTRAINT check_technicians_commission_rate_range 
    CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 100));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE technicians
    ADD CONSTRAINT check_technicians_fixed_salary_positive 
    CHECK (fixed_salary IS NULL OR fixed_salary >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE technicians
    ADD CONSTRAINT check_technicians_monthly_salary_positive 
    CHECK (monthly_salary IS NULL OR monthly_salary >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE technicians
    ADD CONSTRAINT check_technicians_allowances_positive 
    CHECK (allowances IS NULL OR allowances >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- TECHNICIAN ASSIGNMENTS CONSTRAINTS
-- =====================================================

DO $$ BEGIN
  ALTER TABLE technician_assignments
    ADD CONSTRAINT check_technician_assignments_share_positive 
    CHECK (share_amount >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- VEHICLES CONSTRAINTS
-- =====================================================

DO $$ BEGIN
  ALTER TABLE vehicles
    ADD CONSTRAINT check_vehicles_year_reasonable 
    CHECK (car_year IS NULL OR (car_year >= 1900 AND car_year <= EXTRACT(YEAR FROM CURRENT_DATE) + 2));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
