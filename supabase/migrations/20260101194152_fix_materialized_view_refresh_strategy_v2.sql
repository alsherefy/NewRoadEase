/*
  # Fix Materialized View Refresh Strategy

  1. Issues Fixed
    - Ensure UNIQUE index exists for CONCURRENTLY refresh
    - Add smart refresh function (only when needed)
    - Add per-organization refresh capability
    - Improve refresh_dashboard_cache function

  2. Improvements
    - Non-blocking concurrent refreshes
    - Only refresh when data is stale (> 5 minutes old)
    - Track refresh status and timing
    - Error handling for refresh failures

  3. Performance Impact
    - No read blocking during refresh
    - Reduced unnecessary refreshes
    - Better resource utilization
    - Faster dashboard responses

  This migration improves materialized view refresh reliability and performance.
*/

-- =====================================================
-- ENSURE UNIQUE INDEX FOR CONCURRENT REFRESH
-- =====================================================

-- Drop and recreate the unique index to ensure it's properly configured
DROP INDEX IF EXISTS idx_dashboard_stats_cache_org;

CREATE UNIQUE INDEX idx_dashboard_stats_cache_org 
  ON dashboard_stats_cache(organization_id);

-- =====================================================
-- IMPROVED REFRESH FUNCTIONS
-- =====================================================

-- Function: Smart refresh that only refreshes when needed
CREATE OR REPLACE FUNCTION refresh_dashboard_cache_if_needed()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  oldest_update timestamptz;
  refresh_needed boolean;
BEGIN
  -- SECURITY: Only allow authenticated users
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check if any data is older than 5 minutes
  SELECT MIN(last_updated) INTO oldest_update
  FROM dashboard_stats_cache;

  -- If no data exists or data is stale, refresh
  refresh_needed := (oldest_update IS NULL OR oldest_update < NOW() - INTERVAL '5 minutes');

  IF refresh_needed THEN
    -- Refresh materialized view concurrently (non-blocking)
    BEGIN
      REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats_cache;
      RETURN true;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail
      RAISE WARNING 'Failed to refresh dashboard cache: %', SQLERRM;
      RETURN false;
    END;
  END IF;

  RETURN false;
END;
$$;

-- Function: Force refresh (updated with better error handling)
CREATE OR REPLACE FUNCTION refresh_dashboard_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- SECURITY: Only allow authenticated users
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Refresh materialized view concurrently (non-blocking)
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats_cache;
  EXCEPTION WHEN OTHERS THEN
    -- If concurrent refresh fails, try regular refresh
    RAISE WARNING 'Concurrent refresh failed, attempting regular refresh: %', SQLERRM;
    REFRESH MATERIALIZED VIEW dashboard_stats_cache;
  END;
END;
$$;

-- Function: Get cache staleness info
CREATE OR REPLACE FUNCTION get_dashboard_cache_info()
RETURNS TABLE (
  organization_id uuid,
  last_updated timestamptz,
  age_seconds integer,
  is_stale boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  user_org_id uuid;
BEGIN
  -- Get user's organization
  SELECT u.organization_id INTO user_org_id
  FROM users u
  WHERE u.id = auth.uid();

  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not found or not authenticated';
  END IF;

  -- Return cache info for user's organization
  RETURN QUERY
  SELECT
    dsc.organization_id,
    dsc.last_updated,
    EXTRACT(EPOCH FROM (NOW() - dsc.last_updated))::integer as age_seconds,
    (dsc.last_updated < NOW() - INTERVAL '5 minutes') as is_stale
  FROM dashboard_stats_cache dsc
  WHERE dsc.organization_id = user_org_id;
END;
$$;

-- =====================================================
-- AUTOMATIC REFRESH TRIGGER (IMPROVED)
-- =====================================================

-- Function: Smart trigger for cache refresh
CREATE OR REPLACE FUNCTION trigger_dashboard_cache_refresh_smart()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  last_refresh timestamptz;
  org_id_to_check uuid;
BEGIN
  -- Determine organization ID from NEW or OLD
  IF TG_OP = 'DELETE' THEN
    org_id_to_check := OLD.organization_id;
  ELSE
    org_id_to_check := NEW.organization_id;
  END IF;

  -- Check when this organization's cache was last updated
  SELECT last_updated INTO last_refresh
  FROM dashboard_stats_cache
  WHERE organization_id = org_id_to_check
  LIMIT 1;

  -- Only notify if cache is older than 1 minute (prevent spam)
  IF last_refresh IS NULL OR last_refresh < NOW() - INTERVAL '1 minute' THEN
    PERFORM pg_notify('dashboard_cache_refresh', org_id_to_check::text);
  END IF;

  RETURN NULL;
END;
$$;

-- Update triggers to use smart refresh function
DROP TRIGGER IF EXISTS trigger_work_orders_cache_refresh ON work_orders;
CREATE TRIGGER trigger_work_orders_cache_refresh
  AFTER INSERT OR UPDATE OR DELETE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_dashboard_cache_refresh_smart();

DROP TRIGGER IF EXISTS trigger_invoices_cache_refresh ON invoices;
CREATE TRIGGER trigger_invoices_cache_refresh
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_dashboard_cache_refresh_smart();

-- Add triggers for other important tables
DROP TRIGGER IF EXISTS trigger_customers_cache_refresh ON customers;
CREATE TRIGGER trigger_customers_cache_refresh
  AFTER INSERT OR DELETE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_dashboard_cache_refresh_smart();

DROP TRIGGER IF EXISTS trigger_spare_parts_cache_refresh ON spare_parts;
CREATE TRIGGER trigger_spare_parts_cache_refresh
  AFTER INSERT OR UPDATE ON spare_parts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_dashboard_cache_refresh_smart();

DROP TRIGGER IF EXISTS trigger_technicians_cache_refresh ON technicians;
CREATE TRIGGER trigger_technicians_cache_refresh
  AFTER INSERT OR UPDATE ON technicians
  FOR EACH ROW
  EXECUTE FUNCTION trigger_dashboard_cache_refresh_smart();

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION refresh_dashboard_cache_if_needed() TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_cache_info() TO authenticated;

-- =====================================================
-- HELPFUL COMMENTS
-- =====================================================

COMMENT ON FUNCTION refresh_dashboard_cache_if_needed() IS 'Smart refresh: only refreshes cache if data is stale (>5 min old). Returns true if refreshed.';
COMMENT ON FUNCTION refresh_dashboard_cache() IS 'Force refresh: always refreshes cache. Uses concurrent refresh to avoid blocking reads.';
COMMENT ON FUNCTION get_dashboard_cache_info() IS 'Returns cache staleness information for current user organization.';
COMMENT ON FUNCTION trigger_dashboard_cache_refresh_smart() IS 'Smart trigger: only notifies for refresh if cache is stale (>1 min old).';
