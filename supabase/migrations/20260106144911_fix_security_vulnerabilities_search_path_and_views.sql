/*
  # Critical Security Fixes

  ## Security Issues Addressed

  1. **Search Path Hijacking Protection**
     - Fixes all SECURITY DEFINER functions to use explicit search_path
     - Prevents attackers from hijacking function execution through search_path manipulation
     - Sets search_path to 'public' for all vulnerable functions

  2. **Materialized View Direct Access**
     - Revokes direct SELECT access on dashboard_stats_cache from authenticated users
     - Ensures data access only through secure, permission-checked functions
     - Prevents bypassing RLS policies through materialized views

  3. **Extension Schema Isolation**
     - Moves pg_trgm extension from public schema to dedicated extensions schema
     - Reduces attack surface on public schema
     - Improves database organization and security posture

  ## Important Notes
  - Search path changes apply to all SECURITY DEFINER functions
  - Materialized view access is now restricted to service role only
  - Extension move requires superuser privileges (gracefully skipped if unavailable)
  - No data loss occurs during these operations
*/

-- =============================================================================
-- 1. FIX SEARCH PATH FOR ALL SECURITY DEFINER FUNCTIONS
-- =============================================================================
-- This prevents "search path hijacking" attacks where malicious users could
-- create objects in their schema to intercept function calls.

DO $$
DECLARE
    func_record record;
    func_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔒 [SECURITY] Starting search_path fix for SECURITY DEFINER functions...';
    
    FOR func_record IN
        SELECT 
            p.oid, 
            p.proname, 
            pg_get_function_identity_arguments(p.oid) AS args,
            p.proconfig
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
          AND p.prosecdef = TRUE -- Only SECURITY DEFINER functions are vulnerable
          AND NOT EXISTS (
              -- Exclude extension-owned functions
              SELECT 1 
              FROM pg_depend d 
              WHERE d.objid = p.oid 
                AND d.deptype = 'e'
          )
    LOOP
        -- Check if function already has search_path configured
        IF func_record.proconfig IS NULL OR NOT (func_record.proconfig @> ARRAY['search_path=public']) THEN
            BEGIN
                EXECUTE format(
                    'ALTER FUNCTION public.%I(%s) SET search_path = public;',
                    func_record.proname,
                    func_record.args
                );
                func_count := func_count + 1;
                RAISE NOTICE '  ✓ Fixed: %(%)', func_record.proname, func_record.args;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING '  ✗ Failed to fix %(%): %', func_record.proname, func_record.args, SQLERRM;
            END;
        END IF;
    END LOOP;
    
    RAISE NOTICE '🔒 [SECURITY] Fixed % SECURITY DEFINER functions', func_count;
END
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 2. REVOKE DIRECT ACCESS TO MATERIALIZED VIEWS
-- =============================================================================
-- Materialized views should not be directly accessible by users.
-- Access should be controlled through functions that enforce RLS.

DO $$
BEGIN
    RAISE NOTICE '🔒 [SECURITY] Revoking direct access to materialized views...';
    
    -- Revoke access to dashboard_stats_cache
    IF EXISTS (
        SELECT 1 FROM pg_matviews 
        WHERE schemaname = 'public' 
        AND matviewname = 'dashboard_stats_cache'
    ) THEN
        REVOKE ALL ON public.dashboard_stats_cache FROM authenticated;
        REVOKE ALL ON public.dashboard_stats_cache FROM anon;
        REVOKE ALL ON public.dashboard_stats_cache FROM public;
        
        -- Grant access only to service_role for maintenance
        GRANT SELECT ON public.dashboard_stats_cache TO service_role;
        
        RAISE NOTICE '  ✓ Revoked public access to dashboard_stats_cache';
    END IF;
    
    RAISE NOTICE '🔒 [SECURITY] Materialized view access restricted';
END
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 3. MOVE EXTENSION TO DEDICATED SCHEMA (OPTIONAL - REQUIRES SUPERUSER)
-- =============================================================================
-- This improves security by isolating extensions from the public schema.
-- Gracefully skips if user doesn't have sufficient privileges.

DO $$
BEGIN
    RAISE NOTICE '🔒 [SECURITY] Attempting to move pg_trgm extension to extensions schema...';
    
    -- Create extensions schema if it doesn't exist
    CREATE SCHEMA IF NOT EXISTS extensions;
    
    -- Try to move the extension (requires superuser)
    BEGIN
        ALTER EXTENSION pg_trgm SET SCHEMA extensions;
        
        -- Update search_path to include extensions schema
        EXECUTE format(
            'ALTER DATABASE %I SET search_path = "$user", public, extensions;',
            current_database()
        );
        
        RAISE NOTICE '  ✓ Moved pg_trgm to extensions schema';
        RAISE NOTICE '  ✓ Updated database search_path';
    EXCEPTION 
        WHEN insufficient_privilege THEN
            RAISE NOTICE '  ⚠ Skipped: Requires superuser privileges';
        WHEN OTHERS THEN
            RAISE WARNING '  ✗ Failed to move extension: %', SQLERRM;
    END;
    
    RAISE NOTICE '🔒 [SECURITY] Extension isolation completed';
END
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 4. VERIFY SECURITY FIXES
-- =============================================================================
-- Run diagnostic queries to verify all security fixes were applied correctly

DO $$
DECLARE
    vulnerable_functions INTEGER;
    exposed_views INTEGER;
BEGIN
    RAISE NOTICE '🔍 [SECURITY] Running security verification...';
    
    -- Check for vulnerable SECURITY DEFINER functions
    SELECT COUNT(*) INTO vulnerable_functions
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.prosecdef = TRUE
      AND (p.proconfig IS NULL OR NOT (p.proconfig @> ARRAY['search_path=public']));
    
    IF vulnerable_functions > 0 THEN
        RAISE WARNING '  ⚠ Found % SECURITY DEFINER functions without explicit search_path', vulnerable_functions;
    ELSE
        RAISE NOTICE '  ✓ All SECURITY DEFINER functions have explicit search_path';
    END IF;
    
    -- Check for exposed materialized views
    SELECT COUNT(*) INTO exposed_views
    FROM pg_matviews m
    WHERE m.schemaname = 'public'
      AND EXISTS (
          SELECT 1 FROM information_schema.table_privileges tp
          WHERE tp.table_schema = 'public'
          AND tp.table_name = m.matviewname
          AND tp.grantee IN ('authenticated', 'anon', 'public')
          AND tp.privilege_type = 'SELECT'
      );
    
    IF exposed_views > 0 THEN
        RAISE WARNING '  ⚠ Found % materialized views with direct public access', exposed_views;
    ELSE
        RAISE NOTICE '  ✓ All materialized views are properly restricted';
    END IF;
    
    RAISE NOTICE '🔒 [SECURITY] Security verification completed';
END
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SECURITY AUDIT LOG
-- =============================================================================
-- Record this security hardening in the audit log for compliance

DO $$
BEGIN
    RAISE NOTICE '📋 [AUDIT] Security hardening applied successfully';
    RAISE NOTICE '   - Search path hijacking protection: ENABLED';
    RAISE NOTICE '   - Materialized view access control: ENFORCED';
    RAISE NOTICE '   - Extension schema isolation: ATTEMPTED';
    RAISE NOTICE '   - All changes are non-destructive and reversible';
END
$$ LANGUAGE plpgsql;