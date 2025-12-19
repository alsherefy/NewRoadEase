/*
  # تحديث نظام الفواتير
  
  1. تحديثات على جدول invoices
    - إضافة customer_id
    - إضافة vehicle_id
    - إضافة paid_amount
    - إضافة payment_method
    - إضافة notes
    - إضافة updated_at
    - تحديث tax_rate إلى 15 بشكل افتراضي
    - تحديث payment_status options
    
  2. تحديثات على جدول invoice_items
    - تغيير اسم total_price إلى total
  
  3. إضافات
    - دالة توليد رقم فاتورة
    - trigger لتحديث updated_at
*/

-- إضافة الحقول المفقودة في جدول invoices
DO $$
BEGIN
  -- إضافة customer_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN customer_id uuid NOT NULL DEFAULT gen_random_uuid();
  END IF;
  
  -- إضافة vehicle_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'vehicle_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN vehicle_id uuid;
  END IF;
  
  -- إضافة paid_amount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'paid_amount'
  ) THEN
    ALTER TABLE invoices ADD COLUMN paid_amount decimal(10,2) DEFAULT 0 NOT NULL;
  END IF;
  
  -- إضافة payment_method
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE invoices ADD COLUMN payment_method text DEFAULT 'cash';
  END IF;
  
  -- إضافة notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'notes'
  ) THEN
    ALTER TABLE invoices ADD COLUMN notes text DEFAULT '';
  END IF;
  
  -- إضافة updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE invoices ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- تحديث القيود على payment_status
DO $$
BEGIN
  ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_payment_status_check;
  ALTER TABLE invoices ADD CONSTRAINT invoices_payment_status_check 
    CHECK (payment_status IN ('paid', 'partial', 'unpaid'));
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- تحديث القيود على payment_method
DO $$
BEGIN
  ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_payment_method_check;
  ALTER TABLE invoices ADD CONSTRAINT invoices_payment_method_check 
    CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'other'));
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- تحديث tax_rate الافتراضي
ALTER TABLE invoices ALTER COLUMN tax_rate SET DEFAULT 15;

-- تحديث payment_status الافتراضي
ALTER TABLE invoices ALTER COLUMN payment_status SET DEFAULT 'unpaid';

-- تحديث اسم عمود في invoice_items
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_items' AND column_name = 'total_price'
  ) THEN
    ALTER TABLE invoice_items RENAME COLUMN total_price TO total;
  END IF;
END $$;

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_work_order ON invoices(work_order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- دالة لتوليد رقم فاتورة تلقائي
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
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
$$ LANGUAGE plpgsql;

-- دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- تطبيق الدالة على جدول الفواتير
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();