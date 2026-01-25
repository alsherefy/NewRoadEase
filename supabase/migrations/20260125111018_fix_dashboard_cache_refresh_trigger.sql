/*
  # Fix Dashboard Cache Refresh Trigger

  1. Purpose
    - Fix the error: "dashboard_stats_summary" is not a materialized view
    - Make refresh_dashboard_cache() function safe by checking if view exists first
    - Prevents blocking of INSERT operations on customers, work_orders, invoices, etc.

  2. Solution
    - Update refresh_dashboard_cache() to check if materialized view exists
    - If it doesn't exist, silently skip the refresh
    - This allows INSERT operations to proceed without errors
*/

-- Drop and recreate refresh_dashboard_cache function with safety check
CREATE OR REPLACE FUNCTION refresh_dashboard_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  view_exists boolean;
BEGIN
  -- Check if the materialized view exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_matviews
    WHERE schemaname = 'public'
    AND matviewname = 'dashboard_stats_summary'
  ) INTO view_exists;
  
  -- Only refresh if it exists
  IF view_exists THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats_summary;
  END IF;
  
  -- If view doesn't exist, do nothing (prevents errors)
END;
$$;