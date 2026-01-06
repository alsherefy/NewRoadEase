# دليل المراقبة والصيانة - Performance Monitoring Guide

## 📊 نظرة عامة

تم إضافة 6 Views جديدة لمراقبة أداء النظام وتحديد المشاكل قبل حدوثها.

---

## 🔍 Views المراقبة المتاحة

### 1. system_health_check - الفحص السريع
**الاستخدام:**
```sql
SELECT * FROM system_health_check;
```

**النتيجة:**
| Metric | Value | Status |
|--------|-------|--------|
| Database Size | 150 MB | INFO |
| Total Tables | 27 | OK |
| Total Indexes | 231 | OK |
| Unused Indexes | 5 | OK |
| Total RLS Policies | 180 | OK |

**متى تستخدمه:**
- فحص يومي سريع للنظام
- قبل deploy تغييرات جديدة
- عند الشك في وجود مشاكل

---

### 2. database_size_overview - أحجام الجداول
**الاستخدام:**
```sql
SELECT * FROM database_size_overview
ORDER BY total_bytes DESC
LIMIT 10;
```

**النتيجة:**
| Table | Total Size | Table Size | Indexes Size |
|-------|-----------|------------|--------------|
| work_orders | 45 MB | 30 MB | 15 MB |
| invoices | 38 MB | 25 MB | 13 MB |
| customers | 12 MB | 8 MB | 4 MB |

**متى تستخدمه:**
- معرفة الجداول التي تستهلك مساحة كبيرة
- التخطيط لـ partitioning أو archiving
- تحديد الجداول التي تحتاج optimization

**تحذير:**
إذا كان جدول واحد أكبر من 1 GB، فكّر في:
- Partitioning
- Archiving old data
- Index optimization

---

### 3. index_usage_stats - استخدام الـ Indexes
**الاستخدام:**
```sql
-- عرض الـ indexes غير المستخدمة
SELECT * FROM index_usage_stats
WHERE usage_status = 'UNUSED'
ORDER BY index_size DESC;
```

**النتيجة:**
| Table | Index | Scans | Size | Status |
|-------|-------|-------|------|---------|
| work_orders | idx_old_field | 0 | 5 MB | UNUSED |

**متى تستخدمه:**
- شهرياً للبحث عن indexes غير مستخدمة
- بعد إضافة indexes جديدة (انتظر أسبوع ثم تحقق)
- عند مشاكل في الأداء

**إجراءات:**
```sql
-- إذا كان Index غير مستخدم (scans = 0) بعد شهر
DROP INDEX IF EXISTS idx_old_field;
```

**⚠️ تحذير:** لا تحذف index إلا إذا:
- عدد الـ scans = 0 لمدة شهر كامل
- متأكد أنه ليس للـ foreign keys
- عملت backup قبل الحذف

---

### 4. table_performance_stats - أداء الجداول
**الاستخدام:**
```sql
-- البحث عن جداول تحتاج VACUUM
SELECT tablename, dead_tuples_pct, last_autovacuum
FROM table_performance_stats
WHERE dead_tuples_pct > 10
ORDER BY dead_tuples_pct DESC;
```

**النتيجة:**
| Table | Dead Tuples % | Last Vacuum |
|-------|---------------|-------------|
| invoices | 15.3% | 2 days ago |

**متى تستخدمه:**
- أسبوعياً للتحقق من صحة الجداول
- عند بطء في الاستعلامات
- بعد عمليات delete/update كبيرة

**إجراءات:**
```sql
-- إذا كانت dead_tuples_pct > 20%
VACUUM ANALYZE invoices;

-- للجداول الكبيرة جداً
VACUUM (VERBOSE, ANALYZE) work_orders;
```

---

### 5. cache_hit_ratio - نسبة الـ Cache
**الاستخدام:**
```sql
SELECT * FROM cache_hit_ratio
ORDER BY cache_hit_ratio ASC
LIMIT 10;
```

**النتيجة:**
| Table | Disk Reads | Cache Hits | Ratio | Status |
|-------|-----------|------------|-------|---------|
| work_orders | 1000 | 99000 | 99.0% | EXCELLENT |
| customers | 500 | 4500 | 90.0% | OK |

**متى تستخدمه:**
- شهرياً لتقييم أداء الذاكرة
- عند بطء عام في النظام
- للتخطيط لزيادة الذاكرة

**فهم النتائج:**
- **EXCELLENT (>99%)**: ممتاز! معظم البيانات في الذاكرة
- **GOOD (95-99%)**: جيد، أداء مقبول
- **OK (90-95%)**: مقبول لكن يمكن تحسينه
- **POOR (<90%)**: مشكلة! النظام يحتاج ذاكرة أكثر

**إجراءات:**
إذا كانت النسبة أقل من 90%:
1. زيادة shared_buffers في PostgreSQL
2. إضافة ذاكرة للسيرفر
3. تحسين الاستعلامات لتقليل الـ data scans

---

### 6. rls_policies_overview - ملخص السياسات
**الاستخدام:**
```sql
SELECT * FROM rls_policies_overview
ORDER BY policy_count DESC;
```

**النتيجة:**
| Table | Policy Count | Commands |
|-------|-------------|----------|
| work_orders | 4 | {SELECT, INSERT, UPDATE, DELETE} |
| customers | 4 | {SELECT, INSERT, UPDATE, DELETE} |

**متى تستخدمه:**
- عند إضافة RLS policies جديدة
- للتأكد من عدم وجود تكرار
- عند مشاكل في الصلاحيات

**تحذير:**
إذا كان عدد السياسات لجدول واحد > 10:
- راجع السياسات وابحث عن تكرار
- فكّر في دمج السياسات المتشابهة
- استخدم FOR ALL بدلاً من سياسات منفصلة

---

## 🔧 استعلامات مفيدة

### التحقق من Materialized Views

```sql
-- Dashboard cache status
SELECT * FROM dashboard_cache_info;

-- معلومات الـ permissions cache
SELECT COUNT(*) as total_cached_permissions,
       COUNT(DISTINCT user_id) as unique_users
FROM user_active_permissions;
```

### Force Refresh

```sql
-- تحديث Dashboard cache
SELECT force_refresh_dashboard();

-- تحديث Permissions cache
SELECT refresh_permissions_cache();
```

### تحليل استعلام بطيء

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM work_orders_detailed
WHERE organization_id = 'your-org-id';
```

**فهم النتائج:**
- **Seq Scan**: يقرأ الجدول كاملاً (بطيء!)
- **Index Scan**: يستخدم index (سريع!)
- **Execution Time**: الوقت الفعلي
- **Planning Time**: وقت التخطيط

إذا رأيت Seq Scan على جدول كبير:
```sql
-- أضف index
CREATE INDEX idx_work_orders_org
ON work_orders(organization_id);
```

---

## 📅 جدول الصيانة الموصى به

### يومياً (5 دقائق)
```sql
-- فحص سريع
SELECT * FROM system_health_check;

-- التحقق من الأخطاء في logs
-- (عن طريق Supabase Dashboard)
```

### أسبوعياً (15 دقيقة)
```sql
-- التحقق من freshness
SELECT * FROM dashboard_cache_info;

-- البحث عن جداول تحتاج VACUUM
SELECT tablename, dead_tuples_pct
FROM table_performance_stats
WHERE dead_tuples_pct > 10;

-- Force refresh إذا لزم
SELECT force_refresh_dashboard();
SELECT refresh_permissions_cache();
```

### شهرياً (30 دقيقة)
```sql
-- فحص شامل للنظام
SELECT * FROM system_health_check;
SELECT * FROM database_size_overview LIMIT 10;
SELECT * FROM cache_hit_ratio;

-- البحث عن indexes غير مستخدمة
SELECT * FROM index_usage_stats
WHERE usage_status = 'UNUSED'
ORDER BY index_size DESC;

-- تحديث إحصائيات PostgreSQL
ANALYZE;

-- فحص الـ RLS policies
SELECT * FROM rls_policies_overview
ORDER BY policy_count DESC;
```

### ربع سنوي (ساعة)
```sql
-- تحليل شامل
VACUUM ANALYZE;

-- مراجعة كل الـ indexes
SELECT * FROM index_usage_stats;

-- حذف indexes غير مستخدمة (بحذر!)
-- مراجعة وتحسين RLS policies
-- تحديث التوثيق
```

---

## 🚨 علامات التحذير

### ⚠️ يجب التصرف فوراً إذا:

1. **Cache Hit Ratio < 80%**
   ```sql
   SELECT * FROM cache_hit_ratio WHERE cache_hit_ratio < 80;
   ```
   **الحل:** زيادة الذاكرة أو تحسين الاستعلامات

2. **Dead Tuples > 30%**
   ```sql
   SELECT * FROM table_performance_stats WHERE dead_tuples_pct > 30;
   ```
   **الحل:** `VACUUM ANALYZE table_name;`

3. **Unused Indexes > 20 MB**
   ```sql
   SELECT * FROM index_usage_stats
   WHERE usage_status = 'UNUSED'
   AND index_size > '20 MB';
   ```
   **الحل:** مراجعة وربما حذف الـ indexes

4. **Dashboard Cache Stale > 1 hour**
   ```sql
   SELECT * FROM dashboard_cache_info WHERE age > '1 hour';
   ```
   **الحل:** `SELECT force_refresh_dashboard();`

5. **Table Size > 2 GB**
   ```sql
   SELECT * FROM database_size_overview WHERE total_bytes > 2147483648;
   ```
   **الحل:** فكّر في partitioning أو archiving

---

## 💡 نصائح للأداء الأمثل

### 1. استخدم الدوال المحسّنة
```sql
✅ الصحيح:
SELECT * FROM get_dashboard_stats('org_id');
SELECT user_has_permission_cached('user_id', 'permission');

❌ الخطأ:
SELECT COUNT(*) FROM work_orders WHERE ... -- يدوياً
```

### 2. استخدم Views المحسّنة
```sql
✅ الصحيح:
SELECT * FROM work_orders_detailed WHERE organization_id = 'org_id';

❌ الخطأ:
SELECT wo.*, c.name, v.plate_number, ... -- joins معقدة يدوياً
```

### 3. استخدم Caching في Frontend
```typescript
// ✅ الصحيح
import { cache, CacheKeys, CacheTTL } from '../utils/cacheUtils';

const data = await cache.fetchWithCache(
  CacheKeys.TECHNICIANS_LIST,
  () => techniciansService.getAll(),
  CacheTTL.MEDIUM
);

// ❌ الخطأ
const data = await techniciansService.getAll(); // كل مرة من الـ server
```

### 4. راقب الأداء باستمرار
```sql
-- أضف هذا في routine يومي
SELECT * FROM system_health_check;
```

---

## 📊 Benchmarks للمقارنة

### Dashboard Performance
- **Target**: < 200ms
- **Acceptable**: < 500ms
- **Slow**: > 1 second
- **Critical**: > 3 seconds

### Page Load Times
- **Work Orders**: < 500ms
- **Invoices**: < 500ms
- **Customers**: < 300ms

### Permission Checks
- **Target**: < 10ms
- **Acceptable**: < 50ms
- **Slow**: > 100ms

---

## 🔗 مراجع إضافية

### تقارير التحسينات:
- `PERFORMANCE_OPTIMIZATIONS_2026_COMPLETE.md` - تقرير شامل
- `نصائح_الأداء_والصيانة.md` - دليل المطور

### Monitoring Views:
- `system_health_check` - فحص سريع
- `database_size_overview` - أحجام الجداول
- `index_usage_stats` - استخدام الـ indexes
- `table_performance_stats` - أداء الجداول
- `cache_hit_ratio` - نسبة الـ cache
- `rls_policies_overview` - ملخص السياسات

### Helper Functions:
- `get_dashboard_stats()` - إحصائيات Dashboard
- `user_has_permission_cached()` - التحقق من صلاحية
- `refresh_dashboard_cache()` - تحديث cache
- `refresh_permissions_cache()` - تحديث صلاحيات

---

## ✅ Checklist للمراقبة

### يومياً:
- [ ] فحص `system_health_check`
- [ ] التحقق من الأخطاء في Logs

### أسبوعياً:
- [ ] فحص `dashboard_cache_info`
- [ ] فحص `table_performance_stats`
- [ ] Force refresh إذا لزم

### شهرياً:
- [ ] فحص `index_usage_stats`
- [ ] فحص `cache_hit_ratio`
- [ ] فحص `database_size_overview`
- [ ] تنفيذ `ANALYZE`
- [ ] مراجعة `rls_policies_overview`

### ربع سنوي:
- [ ] تنفيذ `VACUUM ANALYZE`
- [ ] مراجعة شاملة للـ indexes
- [ ] تحديث التوثيق
- [ ] مراجعة RLS policies

---

**تذكر:** المراقبة المستمرة تمنع المشاكل الكبيرة!

🎯 **الهدف:** نظام سريع ومستقر دائماً
