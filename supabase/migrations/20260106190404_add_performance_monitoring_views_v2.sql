/*
  # إضافة Views للمراقبة والتحليل

  ## الغرض
  - مراقبة أداء النظام
  - تحديد Bottlenecks
  - تتبع استخدام الـ Indexes
*/

-- ==========================================
-- 1. View لمراقبة أحجام الجداول
-- ==========================================

CREATE OR REPLACE VIEW database_size_overview AS
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size,
  pg_total_relation_size(schemaname||'.'||tablename) as total_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

GRANT SELECT ON database_size_overview TO authenticated;

-- ==========================================
-- 2. View لمراقبة استخدام الـ Indexes
-- ==========================================

CREATE OR REPLACE VIEW index_usage_stats AS
SELECT
  schemaname,
  relname as tablename,
  indexrelname as indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  CASE
    WHEN idx_scan = 0 THEN 'UNUSED'
    WHEN idx_scan < 10 THEN 'RARELY'
    WHEN idx_scan < 100 THEN 'MODERATE'
    ELSE 'FREQUENT'
  END as usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

GRANT SELECT ON index_usage_stats TO authenticated;

-- ==========================================
-- 3. View لمراقبة أداء الجداول
-- ==========================================

CREATE OR REPLACE VIEW table_performance_stats AS
SELECT
  schemaname,
  relname as tablename,
  seq_scan as sequential_scans,
  idx_scan as index_scans,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  n_live_tup as live_tuples,
  n_dead_tup as dead_tuples,
  CASE
    WHEN n_live_tup > 0 THEN
      ROUND(100.0 * n_dead_tup / n_live_tup, 2)
    ELSE 0
  END as dead_tuples_pct,
  last_vacuum,
  last_autovacuum,
  last_analyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

GRANT SELECT ON table_performance_stats TO authenticated;

-- ==========================================
-- 4. View لمراقبة الـ Cache Hit Ratio
-- ==========================================

CREATE OR REPLACE VIEW cache_hit_ratio AS
SELECT
  schemaname,
  relname as tablename,
  heap_blks_read as disk_reads,
  heap_blks_hit as cache_hits,
  CASE
    WHEN (heap_blks_hit + heap_blks_read) = 0 THEN 0
    ELSE ROUND(100.0 * heap_blks_hit / (heap_blks_hit + heap_blks_read), 2)
  END as cache_hit_ratio,
  CASE
    WHEN (heap_blks_hit + heap_blks_read) = 0 THEN 'NO DATA'
    WHEN 100.0 * heap_blks_hit / (heap_blks_hit + heap_blks_read) > 99 THEN 'EXCELLENT'
    WHEN 100.0 * heap_blks_hit / (heap_blks_hit + heap_blks_read) > 95 THEN 'GOOD'
    WHEN 100.0 * heap_blks_hit / (heap_blks_hit + heap_blks_read) > 90 THEN 'OK'
    ELSE 'POOR'
  END as status
FROM pg_statio_user_tables
WHERE schemaname = 'public'
  AND (heap_blks_hit + heap_blks_read) > 0
ORDER BY heap_blks_read DESC;

GRANT SELECT ON cache_hit_ratio TO authenticated;

-- ==========================================
-- 5. View لمراقبة الـ RLS Policies
-- ==========================================

CREATE OR REPLACE VIEW rls_policies_overview AS
SELECT
  schemaname,
  tablename,
  COUNT(*) as policy_count,
  array_agg(DISTINCT cmd) as policy_commands
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY COUNT(*) DESC;

GRANT SELECT ON rls_policies_overview TO authenticated;

-- ==========================================
-- 6. View للفحص السريع للنظام
-- ==========================================

CREATE OR REPLACE VIEW system_health_check AS
SELECT
  'Database Size' as metric,
  pg_size_pretty(pg_database_size(current_database())) as value,
  'INFO' as status
UNION ALL
SELECT
  'Total Tables',
  (SELECT COUNT(*)::text FROM pg_tables WHERE schemaname = 'public'),
  'OK'
UNION ALL
SELECT
  'Total Indexes',
  (SELECT COUNT(*)::text FROM pg_indexes WHERE schemaname = 'public'),
  'OK'
UNION ALL
SELECT
  'Unused Indexes',
  (SELECT COUNT(*)::text FROM pg_stat_user_indexes WHERE idx_scan = 0 AND schemaname = 'public'),
  CASE WHEN (SELECT COUNT(*) FROM pg_stat_user_indexes WHERE idx_scan = 0 AND schemaname = 'public') > 10 THEN 'WARNING' ELSE 'OK' END
UNION ALL
SELECT
  'Total RLS Policies',
  (SELECT COUNT(*)::text FROM pg_policies WHERE schemaname = 'public'),
  'OK';

GRANT SELECT ON system_health_check TO authenticated;

-- ==========================================
-- 7. تسجيل النتائج
-- ==========================================

DO $$
DECLARE
  total_tables int;
  total_indexes int;
  unused_indexes int;
BEGIN
  SELECT COUNT(*) INTO total_tables FROM pg_tables WHERE schemaname = 'public';
  SELECT COUNT(*) INTO total_indexes FROM pg_indexes WHERE schemaname = 'public';
  SELECT COUNT(*) INTO unused_indexes FROM pg_stat_user_indexes WHERE idx_scan = 0 AND schemaname = 'public';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Performance Monitoring Views Created';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'System: % tables, % indexes (% unused)', total_tables, total_indexes, unused_indexes;
  RAISE NOTICE '';
  RAISE NOTICE 'New views:';
  RAISE NOTICE '  - database_size_overview';
  RAISE NOTICE '  - index_usage_stats';
  RAISE NOTICE '  - table_performance_stats';
  RAISE NOTICE '  - cache_hit_ratio';
  RAISE NOTICE '  - rls_policies_overview';
  RAISE NOTICE '  - system_health_check';
  RAISE NOTICE '========================================';
END $$;