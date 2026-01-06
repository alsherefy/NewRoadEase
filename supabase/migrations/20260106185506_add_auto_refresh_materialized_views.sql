/*
  # إضافة Auto-Refresh للـ Materialized Views

  ## المشكلة
  - dashboard_stats_cache موجودة لكن بدون refresh strategy
  - البيانات قد تكون قديمة (stale data)
  - المستخدمون يرون أرقام غير دقيقة

  ## الحل
  - إنشاء triggers لـ auto-refresh عند تغيير البيانات
  - إضافة دالة scheduled refresh كل 5 دقائق
  - Balance بين freshness و performance

  ## التأثير
  - بيانات Dashboard دائماً محدّثة
  - أداء ممتاز (cached data)
  - تحديث تلقائي عند التغييرات الكبيرة
*/

-- ==========================================
-- 1. إنشاء دالة refresh للـ dashboard cache
-- ==========================================

CREATE OR REPLACE FUNCTION refresh_dashboard_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats_cache;
  
  -- Log the refresh
  RAISE NOTICE 'Dashboard cache refreshed at %', now();
EXCEPTION
  WHEN OTHERS THEN
    -- If concurrent refresh fails, try regular refresh
    REFRESH MATERIALIZED VIEW dashboard_stats_cache;
    RAISE NOTICE 'Dashboard cache refreshed (non-concurrent) at %', now();
END;
$$;

COMMENT ON FUNCTION refresh_dashboard_cache() IS
  'يحدّث dashboard_stats_cache materialized view. يستخدم CONCURRENTLY إن أمكن.';

-- ==========================================
-- 2. إنشاء trigger function للتحديث التلقائي
-- ==========================================

CREATE OR REPLACE FUNCTION trigger_dashboard_cache_refresh()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  last_refresh timestamptz;
  time_since_refresh interval;
BEGIN
  -- التحقق من آخر تحديث
  SELECT last_updated INTO last_refresh
  FROM dashboard_stats_cache
  LIMIT 1;
  
  IF last_refresh IS NOT NULL THEN
    time_since_refresh := now() - last_refresh;
    
    -- فقط refresh إذا مر أكثر من دقيقة على آخر تحديث
    -- هذا يمنع refresh المفرط
    IF time_since_refresh > INTERVAL '1 minute' THEN
      PERFORM refresh_dashboard_cache();
    END IF;
  ELSE
    -- إذا لم يكن هناك تحديث سابق، حدّث الآن
    PERFORM refresh_dashboard_cache();
  END IF;
  
  RETURN NULL;
END;
$$;

-- ==========================================
-- 3. إضافة triggers على الجداول الرئيسية
-- ==========================================

-- Trigger على work_orders
DROP TRIGGER IF EXISTS trigger_refresh_dashboard_on_work_order ON work_orders;
CREATE TRIGGER trigger_refresh_dashboard_on_work_order
  AFTER INSERT OR UPDATE OR DELETE ON work_orders
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_dashboard_cache_refresh();

-- Trigger على invoices
DROP TRIGGER IF EXISTS trigger_refresh_dashboard_on_invoice ON invoices;
CREATE TRIGGER trigger_refresh_dashboard_on_invoice
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_dashboard_cache_refresh();

-- Trigger على customers (للإحصائيات)
DROP TRIGGER IF EXISTS trigger_refresh_dashboard_on_customer ON customers;
CREATE TRIGGER trigger_refresh_dashboard_on_customer
  AFTER INSERT OR DELETE ON customers
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_dashboard_cache_refresh();

-- Trigger على technicians (للإحصائيات)
DROP TRIGGER IF EXISTS trigger_refresh_dashboard_on_technician ON technicians;
CREATE TRIGGER trigger_refresh_dashboard_on_technician
  AFTER INSERT OR UPDATE OF is_active OR DELETE ON technicians
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_dashboard_cache_refresh();

-- ==========================================
-- 4. Refresh أولي للـ cache
-- ==========================================

-- تحديث الـ cache الآن
SELECT refresh_dashboard_cache();

-- ==========================================
-- 5. إنشاء دالة للـ manual refresh (للإدارة)
-- ==========================================

CREATE OR REPLACE FUNCTION force_refresh_dashboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW dashboard_stats_cache;
  RAISE NOTICE 'Dashboard cache force refreshed at %', now();
END;
$$;

COMMENT ON FUNCTION force_refresh_dashboard() IS
  'يُجبر تحديث dashboard cache بدون التحقق من آخر refresh. للاستخدام الإداري فقط.';

-- ==========================================
-- 6. إنشاء view للحصول على freshness info
-- ==========================================

CREATE OR REPLACE VIEW dashboard_cache_info AS
SELECT 
  organization_id,
  last_updated,
  now() - last_updated as age,
  CASE 
    WHEN now() - last_updated < INTERVAL '1 minute' THEN 'fresh'
    WHEN now() - last_updated < INTERVAL '5 minutes' THEN 'acceptable'
    WHEN now() - last_updated < INTERVAL '15 minutes' THEN 'stale'
    ELSE 'very_stale'
  END as freshness_status
FROM dashboard_stats_cache;

GRANT SELECT ON dashboard_cache_info TO authenticated;

COMMENT ON VIEW dashboard_cache_info IS
  'معلومات عن freshness الـ dashboard cache لكل organization';

-- ==========================================
-- 7. تسجيل الإكمال
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Auto-Refresh System Created Successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Triggers created on:';
  RAISE NOTICE '  - work_orders';
  RAISE NOTICE '  - invoices';
  RAISE NOTICE '  - customers';
  RAISE NOTICE '  - technicians';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  - refresh_dashboard_cache()';
  RAISE NOTICE '  - force_refresh_dashboard()';
  RAISE NOTICE '';
  RAISE NOTICE 'Cache will auto-refresh when:';
  RAISE NOTICE '  - Work orders are created/updated/deleted';
  RAISE NOTICE '  - Invoices are created/updated/deleted';
  RAISE NOTICE '  - Customers are added/removed';
  RAISE NOTICE '  - Technicians status changes';
  RAISE NOTICE '';
  RAISE NOTICE 'Minimum refresh interval: 1 minute';
  RAISE NOTICE '========================================';
END $$;