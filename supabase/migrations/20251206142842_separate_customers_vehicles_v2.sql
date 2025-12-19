/*
  # فصل العملاء عن السيارات - الإصدار 2

  ## التغييرات

  ### 1. جدول جديد: vehicles (السيارات)
    - `id` (uuid, primary key)
    - `customer_id` (uuid, foreign key) - معرف العميل
    - `car_make` (text) - نوع السيارة
    - `car_model` (text) - موديل السيارة
    - `car_year` (integer) - سنة الصنع
    - `plate_number` (text, unique) - رقم اللوحة
    - `notes` (text, optional) - ملاحظات
    - `created_at` (timestamptz)

  ### 2. تحديث جدول work_orders
    - إضافة `vehicle_id` لربط الطلب بسيارة محددة

  ### 3. ترحيل البيانات
    - نقل بيانات السيارات من جدول customers إلى جدول vehicles
    - تحديث work_orders لربطها بالسيارات الجديدة

  ### 4. تحديث جدول customers
    - إزالة حقول السيارة بعد الترحيل

  ## الأمان
    - تفعيل RLS على جدول vehicles
    - سياسات للوصول العام (للتطوير)
*/

-- إنشاء جدول السيارات إن لم يكن موجوداً
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  car_make text NOT NULL,
  car_model text NOT NULL,
  car_year integer NOT NULL,
  plate_number text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- إضافة عمود vehicle_id إلى work_orders إن لم يكن موجوداً
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'vehicle_id'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ترحيل البيانات: نقل السيارات من customers إلى vehicles
DO $$
DECLARE
  customer_record RECORD;
  new_vehicle_id uuid;
  has_car_columns boolean;
BEGIN
  -- التحقق من وجود أعمدة السيارة في customers
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'car_make'
  ) INTO has_car_columns;
  
  IF has_car_columns THEN
    FOR customer_record IN 
      SELECT id, car_make, car_model, car_year, plate_number 
      FROM customers 
      WHERE car_make IS NOT NULL
    LOOP
      -- التحقق من عدم وجود السيارة مسبقاً
      SELECT id INTO new_vehicle_id FROM vehicles 
      WHERE customer_id = customer_record.id 
      AND plate_number = customer_record.plate_number
      LIMIT 1;
      
      IF new_vehicle_id IS NULL THEN
        -- إنشاء سيارة جديدة
        INSERT INTO vehicles (customer_id, car_make, car_model, car_year, plate_number)
        VALUES (
          customer_record.id,
          customer_record.car_make,
          customer_record.car_model,
          customer_record.car_year,
          customer_record.plate_number
        )
        RETURNING id INTO new_vehicle_id;
      END IF;
      
      -- تحديث work_orders لربطها بالسيارة
      UPDATE work_orders
      SET vehicle_id = new_vehicle_id
      WHERE customer_id = customer_record.id AND vehicle_id IS NULL;
    END LOOP;
    
    -- حذف أعمدة السيارة من customers
    ALTER TABLE customers DROP COLUMN IF EXISTS car_make;
    ALTER TABLE customers DROP COLUMN IF EXISTS car_model;
    ALTER TABLE customers DROP COLUMN IF EXISTS car_year;
    ALTER TABLE customers DROP COLUMN IF EXISTS plate_number;
  END IF;
END $$;

-- تفعيل RLS على جدول vehicles
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- حذف السياسة القديمة إن وجدت
DROP POLICY IF EXISTS "Allow all access to vehicles" ON vehicles;

-- إنشاء سياسة جديدة
CREATE POLICY "Allow all access to vehicles"
  ON vehicles FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON vehicles(customer_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_work_orders_vehicle ON work_orders(vehicle_id);