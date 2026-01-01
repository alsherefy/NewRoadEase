/*
  # Fix Search Functions Security Issues

  1. Security Issues Fixed
    - Enforce organization_id validation (no NULL allowed)
    - Validate user has access to requested organization
    - Add input sanitization for search queries
    - Prevent SQL injection attacks
    - Add length limits on search queries

  2. Affected Functions
    - search_customers()
    - search_vehicles()
    - search_spare_parts()

  3. Performance Improvements
    - Remove redundant ILIKE queries (use full-text search only)
    - Add query length validation
    - Optimize search ranking

  This migration fixes critical security vulnerabilities in search functions.
*/

-- =====================================================
-- DROP AND RECREATE SEARCH FUNCTIONS WITH SECURITY
-- =====================================================

-- Drop existing functions first
DROP FUNCTION IF EXISTS search_customers(text, uuid);
DROP FUNCTION IF EXISTS search_vehicles(text, uuid);
DROP FUNCTION IF EXISTS search_spare_parts(text, uuid);

-- Function: Search customers (SECURED)
CREATE OR REPLACE FUNCTION search_customers(search_query text, org_id uuid)
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
DECLARE
  user_org_id uuid;
  safe_query text;
BEGIN
  -- SECURITY: Validate user has access to this organization
  SELECT organization_id INTO user_org_id
  FROM users
  WHERE id = auth.uid();

  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not found or not authenticated';
  END IF;

  IF user_org_id != org_id THEN
    RAISE EXCEPTION 'Access denied: Cannot search data from another organization';
  END IF;

  -- INPUT VALIDATION: Check query length and sanitize
  IF search_query IS NULL OR LENGTH(TRIM(search_query)) = 0 THEN
    RAISE EXCEPTION 'Search query cannot be empty';
  END IF;

  IF LENGTH(search_query) > 100 THEN
    RAISE EXCEPTION 'Search query too long (max 100 characters)';
  END IF;

  -- Sanitize query: trim whitespace
  safe_query := TRIM(search_query);

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.phone,
    c.email,
    ts_rank(c.search_vector, plainto_tsquery('simple', safe_query)) as rank
  FROM customers c
  WHERE 
    c.search_vector @@ plainto_tsquery('simple', safe_query)
    AND c.organization_id = org_id
    AND c.deleted_at IS NULL
  ORDER BY rank DESC, c.name
  LIMIT 50;
END;
$$;

-- Function: Search vehicles (SECURED)
CREATE OR REPLACE FUNCTION search_vehicles(search_query text, org_id uuid)
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
DECLARE
  user_org_id uuid;
  safe_query text;
BEGIN
  -- SECURITY: Validate user has access to this organization
  SELECT organization_id INTO user_org_id
  FROM users
  WHERE id = auth.uid();

  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not found or not authenticated';
  END IF;

  IF user_org_id != org_id THEN
    RAISE EXCEPTION 'Access denied: Cannot search data from another organization';
  END IF;

  -- INPUT VALIDATION: Check query length and sanitize
  IF search_query IS NULL OR LENGTH(TRIM(search_query)) = 0 THEN
    RAISE EXCEPTION 'Search query cannot be empty';
  END IF;

  IF LENGTH(search_query) > 100 THEN
    RAISE EXCEPTION 'Search query too long (max 100 characters)';
  END IF;

  -- Sanitize query: trim whitespace
  safe_query := TRIM(search_query);

  RETURN QUERY
  SELECT
    v.id,
    v.plate_number,
    v.car_make,
    v.car_model,
    v.car_year,
    ts_rank(v.search_vector, plainto_tsquery('simple', safe_query)) as rank
  FROM vehicles v
  WHERE 
    v.search_vector @@ plainto_tsquery('simple', safe_query)
    AND v.organization_id = org_id
    AND v.deleted_at IS NULL
  ORDER BY rank DESC, v.plate_number
  LIMIT 50;
END;
$$;

-- Function: Search spare parts (SECURED)
CREATE OR REPLACE FUNCTION search_spare_parts(search_query text, org_id uuid)
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
DECLARE
  user_org_id uuid;
  safe_query text;
BEGIN
  -- SECURITY: Validate user has access to this organization
  SELECT organization_id INTO user_org_id
  FROM users
  WHERE id = auth.uid();

  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not found or not authenticated';
  END IF;

  IF user_org_id != org_id THEN
    RAISE EXCEPTION 'Access denied: Cannot search data from another organization';
  END IF;

  -- INPUT VALIDATION: Check query length and sanitize
  IF search_query IS NULL OR LENGTH(TRIM(search_query)) = 0 THEN
    RAISE EXCEPTION 'Search query cannot be empty';
  END IF;

  IF LENGTH(search_query) > 100 THEN
    RAISE EXCEPTION 'Search query too long (max 100 characters)';
  END IF;

  -- Sanitize query: trim whitespace
  safe_query := TRIM(search_query);

  RETURN QUERY
  SELECT
    sp.id,
    sp.name,
    sp.part_number,
    sp.category,
    sp.quantity,
    sp.unit_price,
    ts_rank(sp.search_vector, plainto_tsquery('simple', safe_query)) as rank
  FROM spare_parts sp
  WHERE 
    sp.search_vector @@ plainto_tsquery('simple', safe_query)
    AND sp.organization_id = org_id
    AND sp.deleted_at IS NULL
  ORDER BY rank DESC, sp.name
  LIMIT 50;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION search_customers(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION search_vehicles(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION search_spare_parts(text, uuid) TO authenticated;

-- Add helpful security comments
COMMENT ON FUNCTION search_customers(text, uuid) IS 'SECURED: Full-text search for customers. Validates organization access and sanitizes input.';
COMMENT ON FUNCTION search_vehicles(text, uuid) IS 'SECURED: Full-text search for vehicles. Validates organization access and sanitizes input.';
COMMENT ON FUNCTION search_spare_parts(text, uuid) IS 'SECURED: Full-text search for spare parts. Validates organization access and sanitizes input.';
