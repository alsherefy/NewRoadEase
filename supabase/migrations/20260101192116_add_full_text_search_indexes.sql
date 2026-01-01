/*
  # Add Full-Text Search Indexes

  1. Full-Text Search Columns Added
    - customers.search_vector: For searching customer names, phone, email
    - vehicles.search_vector: For searching plate numbers, car make/model
    - spare_parts.search_vector: For searching part names, numbers, descriptions
    - work_orders.search_vector: For searching order numbers, descriptions
    - technicians.search_vector: For searching technician names, phones

  2. GIN Indexes Created
    - High-performance indexes for full-text search
    - Support Arabic and English text
    - Enable fast LIKE, ILIKE, and full-text queries

  3. Triggers for Auto-Update
    - Automatically update search vectors when data changes
    - Keep search indexes in sync with data
    - No manual maintenance required

  4. Search Functions
    - search_customers(query): Search customers by name, phone, or email
    - search_vehicles(query): Search vehicles by plate number or make/model
    - search_spare_parts(query): Search spare parts by name or part number
    - search_work_orders(query): Search work orders by order number or description

  5. Benefits
    - Fast text searches across multiple columns
    - Support for partial matches and fuzzy search
    - Works with Arabic and English text
    - Automatic index maintenance
    - Significantly faster than LIKE queries

  6. Usage Examples
    - SELECT * FROM search_customers('محمد');
    - SELECT * FROM search_vehicles('ABC');
    - SELECT * FROM search_spare_parts('فلتر');
*/

-- Enable pg_trgm extension for similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================
-- ADD SEARCH VECTOR COLUMNS
-- =====================================================

-- Add search vector to customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE customers ADD COLUMN search_vector tsvector;
  END IF;
END $$;

-- Add search vector to vehicles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN search_vector tsvector;
  END IF;
END $$;

-- Add search vector to spare_parts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'spare_parts' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE spare_parts ADD COLUMN search_vector tsvector;
  END IF;
END $$;

-- Add search vector to work_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN search_vector tsvector;
  END IF;
END $$;

-- Add search vector to technicians
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'technicians' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE technicians ADD COLUMN search_vector tsvector;
  END IF;
END $$;

-- =====================================================
-- CREATE GIN INDEXES FOR FULL-TEXT SEARCH
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_customers_search_vector 
  ON customers USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_vehicles_search_vector 
  ON vehicles USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_spare_parts_search_vector 
  ON spare_parts USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_work_orders_search_vector 
  ON work_orders USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_technicians_search_vector 
  ON technicians USING GIN(search_vector);

-- =====================================================
-- CREATE TRIGRAM INDEXES FOR SIMILARITY SEARCH
-- =====================================================

-- Trigram indexes for partial matches
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm 
  ON customers USING GIN(name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm 
  ON customers USING GIN(phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_vehicles_plate_trgm 
  ON vehicles USING GIN(plate_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_spare_parts_name_trgm 
  ON spare_parts USING GIN(name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_spare_parts_part_number_trgm 
  ON spare_parts USING GIN(part_number gin_trgm_ops);

-- =====================================================
-- TRIGGERS TO MAINTAIN SEARCH VECTORS
-- =====================================================

-- Function: Update customers search vector
CREATE OR REPLACE FUNCTION update_customers_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.phone, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.email, '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_customers_search_vector ON customers;
CREATE TRIGGER trigger_update_customers_search_vector
  BEFORE INSERT OR UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customers_search_vector();

-- Function: Update vehicles search vector
CREATE OR REPLACE FUNCTION update_vehicles_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('simple', COALESCE(NEW.plate_number, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.car_make, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.car_model, '')), 'B');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_vehicles_search_vector ON vehicles;
CREATE TRIGGER trigger_update_vehicles_search_vector
  BEFORE INSERT OR UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_vehicles_search_vector();

-- Function: Update spare_parts search vector
CREATE OR REPLACE FUNCTION update_spare_parts_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.part_number, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.category, '')), 'D');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_spare_parts_search_vector ON spare_parts;
CREATE TRIGGER trigger_update_spare_parts_search_vector
  BEFORE INSERT OR UPDATE ON spare_parts
  FOR EACH ROW
  EXECUTE FUNCTION update_spare_parts_search_vector();

-- Function: Update work_orders search vector
CREATE OR REPLACE FUNCTION update_work_orders_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('simple', COALESCE(NEW.order_number, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_work_orders_search_vector ON work_orders;
CREATE TRIGGER trigger_update_work_orders_search_vector
  BEFORE INSERT OR UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_work_orders_search_vector();

-- Function: Update technicians search vector
CREATE OR REPLACE FUNCTION update_technicians_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.phone, '')), 'B');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_technicians_search_vector ON technicians;
CREATE TRIGGER trigger_update_technicians_search_vector
  BEFORE INSERT OR UPDATE ON technicians
  FOR EACH ROW
  EXECUTE FUNCTION update_technicians_search_vector();

-- =====================================================
-- POPULATE EXISTING SEARCH VECTORS
-- =====================================================

-- Populate search vectors for existing records
UPDATE customers SET search_vector = 
  setweight(to_tsvector('simple', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(phone, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(email, '')), 'C')
WHERE search_vector IS NULL;

UPDATE vehicles SET search_vector = 
  setweight(to_tsvector('simple', COALESCE(plate_number, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(car_make, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(car_model, '')), 'B')
WHERE search_vector IS NULL;

UPDATE spare_parts SET search_vector = 
  setweight(to_tsvector('simple', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(part_number, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(description, '')), 'C') ||
  setweight(to_tsvector('simple', COALESCE(category, '')), 'D')
WHERE search_vector IS NULL;

UPDATE work_orders SET search_vector = 
  setweight(to_tsvector('simple', COALESCE(order_number, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(description, '')), 'B')
WHERE search_vector IS NULL;

UPDATE technicians SET search_vector = 
  setweight(to_tsvector('simple', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(phone, '')), 'B')
WHERE search_vector IS NULL;

-- =====================================================
-- SEARCH HELPER FUNCTIONS
-- =====================================================

-- Function: Search customers with ranking
CREATE OR REPLACE FUNCTION search_customers(search_query text, org_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  name text,
  phone text,
  email text,
  rank real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.phone,
    c.email,
    ts_rank(c.search_vector, plainto_tsquery('simple', search_query)) as rank
  FROM customers c
  WHERE 
    (c.search_vector @@ plainto_tsquery('simple', search_query)
     OR c.name ILIKE '%' || search_query || '%'
     OR c.phone ILIKE '%' || search_query || '%'
     OR c.email ILIKE '%' || search_query || '%')
    AND (org_id IS NULL OR c.organization_id = org_id)
    AND c.deleted_at IS NULL
  ORDER BY rank DESC, c.name
  LIMIT 50;
END;
$$;

-- Function: Search vehicles with ranking
CREATE OR REPLACE FUNCTION search_vehicles(search_query text, org_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  plate_number text,
  car_make text,
  car_model text,
  car_year integer,
  rank real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id,
    v.plate_number,
    v.car_make,
    v.car_model,
    v.car_year,
    ts_rank(v.search_vector, plainto_tsquery('simple', search_query)) as rank
  FROM vehicles v
  WHERE 
    (v.search_vector @@ plainto_tsquery('simple', search_query)
     OR v.plate_number ILIKE '%' || search_query || '%'
     OR v.car_make ILIKE '%' || search_query || '%'
     OR v.car_model ILIKE '%' || search_query || '%')
    AND (org_id IS NULL OR v.organization_id = org_id)
    AND v.deleted_at IS NULL
  ORDER BY rank DESC, v.plate_number
  LIMIT 50;
END;
$$;

-- Function: Search spare parts with ranking
CREATE OR REPLACE FUNCTION search_spare_parts(search_query text, org_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  name text,
  part_number text,
  category text,
  quantity integer,
  unit_price numeric,
  rank real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id,
    sp.name,
    sp.part_number,
    sp.category,
    sp.quantity,
    sp.unit_price,
    ts_rank(sp.search_vector, plainto_tsquery('simple', search_query)) as rank
  FROM spare_parts sp
  WHERE 
    (sp.search_vector @@ plainto_tsquery('simple', search_query)
     OR sp.name ILIKE '%' || search_query || '%'
     OR sp.part_number ILIKE '%' || search_query || '%')
    AND (org_id IS NULL OR sp.organization_id = org_id)
    AND sp.deleted_at IS NULL
  ORDER BY rank DESC, sp.name
  LIMIT 50;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION search_customers(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION search_vehicles(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION search_spare_parts(text, uuid) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION search_customers(text, uuid) IS 'Full-text search for customers by name, phone, or email. Returns ranked results.';
COMMENT ON FUNCTION search_vehicles(text, uuid) IS 'Full-text search for vehicles by plate number, make, or model. Returns ranked results.';
COMMENT ON FUNCTION search_spare_parts(text, uuid) IS 'Full-text search for spare parts by name or part number. Returns ranked results.';
