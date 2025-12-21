# نظام RBAC المتقدم - التوثيق الشامل

## 📋 نظرة عامة

تم تنفيذ نظام RBAC (Role-Based Access Control) متقدم يدعم:
- ✅ أدوار متعددة لكل مستخدم
- ✅ 65 صلاحية تفصيلية موزعة على 5 فئات
- ✅ صلاحيات استثنائية مؤقتة ودائمة
- ✅ سجل تدقيق شامل
- ✅ أدوار مخصصة قابلة للإنشاء
- ✅ Multi-tenancy support

---

## 🗃️ هيكل قاعدة البيانات

### الجداول الرئيسية

#### 1. `roles` - الأدوار
```sql
- id (uuid)
- organization_id (uuid)
- name (text) - الاسم بالعربية
- name_en (text) - الاسم بالإنجليزية
- key (text) - المفتاح التقني الفريد
- description (text)
- is_system_role (boolean) - دور أساسي أم مخصص
- is_active (boolean)
- created_by (uuid)
- created_at, updated_at (timestamptz)
```

**الأدوار الأساسية الثلاثة:**
- **Admin**: جميع الصلاحيات (65 صلاحية)
- **Customer Service**: صلاحيات متوسطة (32 صلاحية)
- **Receptionist**: صلاحيات محدودة (10 صلاحيات + المصروفات)

#### 2. `permissions` - الصلاحيات (65 صلاحية)
```sql
- id (uuid)
- key (text) - مثل "customers.create"
- resource (text) - المورد مثل "customers"
- action (text) - الإجراء مثل "create"
- name_ar, name_en (text)
- description_ar, description_en (text)
- category (text) - الفئة
- display_order (integer)
- is_active (boolean)
```

**الفئات الخمسة:**
1. `general` - عام (Dashboard)
2. `operations` - العمليات (العملاء، المركبات، أوامر العمل، المخزون، الفنيين)
3. `financial` - مالي (الفواتير، المصروفات، الرواتب)
4. `reports` - التقارير
5. `administration` - الإدارة (المستخدمين، الأدوار، الإعدادات)

#### 3. `role_permissions` - ربط الأدوار بالصلاحيات
```sql
- id (uuid)
- role_id (uuid)
- permission_id (uuid)
- granted_by (uuid)
- UNIQUE (role_id, permission_id)
```

#### 4. `user_roles` - ربط المستخدمين بالأدوار
```sql
- id (uuid)
- user_id (uuid)
- role_id (uuid)
- assigned_by (uuid)
- UNIQUE (user_id, role_id)
```

#### 5. `user_permission_overrides` - الصلاحيات الاستثنائية
```sql
- id (uuid)
- user_id (uuid)
- permission_id (uuid)
- is_granted (boolean) - منح أو إلغاء
- reason (text)
- granted_by (uuid)
- expires_at (timestamptz) - اختياري
```

#### 6. `rbac_audit_logs` - سجل التدقيق
```sql
- id (uuid)
- organization_id (uuid)
- user_id (uuid)
- action (text)
- resource_type (text)
- resource_id (uuid)
- old_value, new_value (jsonb)
- ip_address, user_agent (text)
```

---

## 🔧 دوال قاعدة البيانات

### 1. `get_user_all_permissions(p_user_id uuid)`
**الوظيفة:** جلب جميع صلاحيات المستخدم المحسوبة
**الحساب:** (صلاحيات الأدوار + الصلاحيات الممنوحة) - الصلاحيات الملغاة

```sql
SELECT * FROM get_user_all_permissions('user-uuid');
-- Returns: { permission_key }[]
```

### 2. `has_permission_rbac(p_user_id uuid, p_permission_key text)`
**الوظيفة:** التحقق من صلاحية محددة
**المنطق:** Admin → true | يحقق في الصلاحيات المحسوبة

```sql
SELECT has_permission_rbac('user-uuid', 'customers.create');
-- Returns: boolean
```

### 3. `has_any_permission_rbac(p_user_id uuid, p_permission_keys text[])`
**الوظيفة:** التحقق من أي صلاحية من قائمة

### 4. `has_role_rbac(p_user_id uuid, p_role_key text)`
**الوظيفة:** التحقق من دور معين

### 5. `count_users_with_role(p_role_id uuid)`
**الوظيفة:** عد المستخدمين بدور معين (قبل الحذف)

### 6. `get_user_active_roles(p_user_id uuid)`
**الوظيفة:** جلب الأدوار المفعلة للمستخدم

---

## 💻 Frontend Implementation

### 1. AuthContext المحدث

```typescript
interface AuthContextType {
  user: User | null;
  userRoles: UserRole[];
  computedPermissions: string[];
  hasPermission(key: PermissionKey | DetailedPermissionKey): boolean;
  hasDetailedPermission(key: DetailedPermissionKey): boolean;
  hasAnyPermission(keys: (PermissionKey | DetailedPermissionKey)[]): boolean;
  hasRole(roleKey: string): boolean;
  refreshPermissions(): Promise<void>;
  // ... existing methods
}
```

**المنطق:**
1. يحمل `user_roles` من قاعدة البيانات
2. يستدعي `get_user_all_permissions()` لحساب الصلاحيات
3. يخزن النتيجة في `computedPermissions`
4. دوال التحقق تعمل على `computedPermissions`

### 2. usePermission Hook

```typescript
const { can, canView, canEdit, canCreate, canUpdate, canDelete, canExport } = usePermission();

// Examples
if (can('customers.delete')) { /* ... */ }
if (canCreate('invoices')) { /* ... */ }
if (canView('reports')) { /* ... */ }
```

**الدوال المتاحة:**
- `can(permission)` - التحقق من صلاحية محددة
- `canView(resource)` - التحقق من صلاحية العرض
- `canEdit(resource)` - التحقق من صلاحيات التعديل
- `canCreate(resource)` - التحقق من صلاحية الإنشاء
- `canUpdate(resource)` - التحقق من صلاحية التحديث
- `canDelete(resource)` - التحقق من صلاحية الحذف
- `canExport(resource)` - التحقق من صلاحية التصدير
- `canAny(permissions[])` - التحقق من أي صلاحية
- `canAll(permissions[])` - التحقق من جميع الصلاحيات

### 3. ProtectedAction Component

```typescript
<ProtectedAction permission="customers.delete">
  <button>Delete</button>
</ProtectedAction>

<ProtectedAction
  permission={['invoices.create', 'invoices.update']}
  requireAll={false}
>
  <button>Save Invoice</button>
</ProtectedAction>
```

**الخصائص:**
- `permission`: صلاحية واحدة أو مصفوفة صلاحيات
- `requireAll`: هل يحتاج جميع الصلاحيات؟ (false = أي صلاحية)
- `fallback`: ما يظهر عند عدم وجود الصلاحية

---

## 📊 الصلاحيات الـ 65

### Dashboard (1)
- `dashboard.view`

### Customers (5)
- `customers.view`
- `customers.create`
- `customers.update`
- `customers.delete`
- `customers.export`

### Vehicles (4)
- `vehicles.view`, `create`, `update`, `delete`

### Work Orders (7)
- `work_orders.view`, `create`, `update`, `delete`
- `work_orders.cancel`, `complete`, `export`

### Invoices (7)
- `invoices.view`, `create`, `update`, `delete`
- `invoices.print`, `export`, `void`

### Inventory (6)
- `inventory.view`, `create`, `update`, `delete`
- `inventory.adjust_stock`, `export`

### Expenses (6)
- `expenses.view`, `create`, `update`, `delete`
- `expenses.approve`, `export`

### Salaries (6)
- `salaries.view`, `create`, `update`, `delete`
- `salaries.approve`, `export`

### Technicians (6)
- `technicians.view`, `create`, `update`, `delete`
- `technicians.view_performance`, `manage_assignments`

### Reports (5)
- `reports.view`, `export`
- `reports.financial`, `operations`, `performance`

### Settings (4)
- `settings.view`, `update`
- `settings.manage_workshop`, `manage_tax`

### Users (7)
- `users.view`, `create`, `update`, `delete`
- `users.manage_roles`, `manage_permissions`, `change_password`

### Roles (5)
- `roles.view`, `create`, `update`, `delete`
- `roles.manage_permissions`

### Audit Logs (1)
- `audit_logs.view`

---

## 🔐 RLS Policies

### Security Rules

1. **Roles Table:**
   - SELECT: Users في نفس المنظمة
   - INSERT/UPDATE/DELETE: Admin فقط
   - Cannot DELETE system roles

2. **Permissions Table:**
   - SELECT: جميع المستخدمين المصادق عليهم
   - No INSERT/UPDATE/DELETE (read-only)

3. **Role Permissions:**
   - SELECT: Users في نفس المنظمة
   - INSERT/DELETE: Admin فقط

4. **User Roles:**
   - SELECT: User نفسه أو Admin
   - INSERT/DELETE: Admin فقط

5. **Permission Overrides:**
   - SELECT: User نفسه أو Admin
   - INSERT/DELETE: Admin فقط

6. **Audit Logs:**
   - SELECT: Admin فقط
   - INSERT: جميع المستخدمين (تلقائي)

---

## 🛠️ API Services

### rolesService
```typescript
rolesService.getAllRoles()
rolesService.getRoleById(roleId)
rolesService.getRolePermissions(roleId)
rolesService.createRole(data)
rolesService.updateRole(roleId, data)
rolesService.deleteRole(roleId)
rolesService.updateRolePermissions(roleId, permissionIds)
rolesService.assignRoleToUser({ user_id, role_id })
rolesService.removeRoleFromUser(userRoleId)
rolesService.getUserRoles(userId)
rolesService.getRoleUsers(roleId)
```

### permissionsService
```typescript
permissionsService.getAllPermissions()
permissionsService.getPermissionsByCategory(category)
permissionsService.getUserPermissions(userId)
permissionsService.getUserPermissionOverrides(userId)
permissionsService.createPermissionOverride(data)
permissionsService.deletePermissionOverride(overrideId)
permissionsService.checkPermission(userId, permissionKey)
permissionsService.checkAnyPermission(userId, permissionKeys)
```

---

## 🎯 حالات الاستخدام

### 1. تعيين دور لمستخدم
```typescript
await rolesService.assignRoleToUser({
  user_id: 'user-uuid',
  role_id: 'role-uuid'
});
await refreshPermissions(); // تحديث الصلاحيات في Context
```

### 2. منح صلاحية استثنائية
```typescript
await permissionsService.createPermissionOverride({
  user_id: 'user-uuid',
  permission_id: 'permission-uuid',
  is_granted: true,
  reason: 'يحتاج للوصول المؤقت لحذف الفواتير',
  expires_at: '2025-12-31'
});
```

### 3. إنشاء دور مخصص
```typescript
const role = await rolesService.createRole({
  name: 'مدير المستودع',
  name_en: 'Warehouse Manager',
  key: 'warehouse_manager',
  description: 'يدير المخزون فقط',
  permission_ids: [/* IDs للصلاحيات المطلوبة */]
});
```

### 4. استخدام في المكونات
```typescript
function CustomerActions() {
  const { canDelete, canExport } = usePermission();

  return (
    <>
      <ProtectedAction permission="customers.delete">
        <button onClick={handleDelete}>حذف</button>
      </ProtectedAction>

      {canExport('customers') && (
        <button onClick={handleExport}>تصدير</button>
      )}
    </>
  );
}
```

---

## 📈 الخطوات التالية (اختياري)

### 1. Backend - Edge Functions
- إنشاء `/roles` endpoint
- إنشاء `/permissions` endpoint
- دعم CRUD operations
- التكامل مع audit logs

### 2. صفحات الإدارة
- صفحة إدارة الأدوار (RolesManagement.tsx)
- modal إنشاء/تعديل الأدوار
- modal اختيار الصلاحيات
- صفحة عرض جميع الصلاحيات
- modal الصلاحيات الاستثنائية
- صفحة سجل التدقيق

### 3. تحديث صفحة المستخدمين
- دعم تعيين أدوار متعددة
- عرض الأدوار الحالية
- إدارة الصلاحيات الاستثنائية

### 4. تطبيق الصلاحيات
- تحديث جميع الصفحات لاستخدام `ProtectedAction`
- إخفاء الأزرار حسب الصلاحيات
- تطبيق الصلاحيات على API calls

---

## ✅ ما تم إنجازه

- ✅ **قاعدة البيانات:**
  - 6 جداول مع RLS كامل
  - 6 دوال PostgreSQL
  - 65 صلاحية أولية
  - 3 أدوار أساسية

- ✅ **TypeScript Types:**
  - 11 interface للـ RBAC
  - Types مساعدة شاملة

- ✅ **Frontend Core:**
  - AuthContext موسع بالكامل
  - usePermission hook
  - ProtectedAction component

- ✅ **API Services:**
  - rolesService
  - permissionsService

- ✅ **Translations:**
  - 50+ مفتاح عربي/إنجليزي

- ✅ **Build:**
  - البناء ينجح بدون أخطاء
  - جميع الترجمات متطابقة

---

## 🎊 النتيجة

نظام RBAC متقدم وشامل جاهز للاستخدام والتوسع!
