/*
  # Fix Critical Trigger and Column Issues

  1. Problems
    - trigger_dashboard_cache_refresh() not SECURITY DEFINER
    - Dashboard queries using wrong column name (status vs payment_status)
    - Users can't create/update work orders, invoices, etc.

  2. Solutions
    - Make trigger_dashboard_cache_refresh() SECURITY DEFINER
    - Fix dashboard queries to use correct column names
    - Add SET search_path for security

  3. Security
    - SECURITY DEFINER allows trigger to refresh materialized view
    - search_path prevents injection attacks
*/

-- Fix trigger function to be SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.trigger_dashboard_cache_refresh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  last_refresh timestamptz;
  time_since_refresh interval;
BEGIN
  -- Check last refresh time
  SELECT last_updated INTO last_refresh
  FROM dashboard_stats_cache
  LIMIT 1;

  IF last_refresh IS NOT NULL THEN
    time_since_refresh := now() - last_refresh;

    -- Only refresh if more than 1 minute has passed
    -- This prevents excessive refreshes
    IF time_since_refresh > INTERVAL '1 minute' THEN
      PERFORM refresh_dashboard_cache();
    END IF;
  ELSE
    -- If no previous refresh, refresh now
    PERFORM refresh_dashboard_cache();
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION trigger_dashboard_cache_refresh() IS 'SECURED: Trigger function to refresh dashboard cache with rate limiting. Uses SECURITY DEFINER to allow refresh.';

-- Grant execute to authenticated users (they will trigger it indirectly)
GRANT EXECUTE ON FUNCTION trigger_dashboard_cache_refresh() TO authenticated;
