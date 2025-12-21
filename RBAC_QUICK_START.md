# RBAC - دليل البدء السريع

## 🚀 البدء السريع

### 1. استخدام الصلاحيات في المكونات

```typescript
import { usePermission } from '../hooks/usePermission';
import { ProtectedAction } from '../components/ProtectedAction';

function MyComponent() {
  const { can, canCreate, canDelete } = usePermission();

  return (
    <div>
      {/* Method 1: Using hook */}
      {canCreate('customers') && (
        <button>إضافة عميل</button>
      )}

      {/* Method 2: Using ProtectedAction component */}
      <ProtectedAction permission="customers.delete">
        <button>حذف</button>
      </ProtectedAction>

      {/* Multiple permissions (any) */}
      <ProtectedAction permission={['customers.update', 'customers.create']}>
        <button>حفظ</button>
      </ProtectedAction>

      {/* Multiple permissions (all required) */}
      <ProtectedAction
        permission={['customers.view', 'customers.delete']}
        requireAll={true}
      >
        <button>حذف متعدد</button>
      </ProtectedAction>
    </div>
  );
}
```

### 2. التحقق من الصلاحيات في AuthContext

```typescript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { hasPermission, hasDetailedPermission, hasAnyPermission } = useAuth();

  if (hasDetailedPermission('customers.delete')) {
    // User can delete customers
  }

  if (hasPermission('customers')) {
    // User can view customers
  }

  if (hasPermission('customers', true)) {
    // User can edit customers (view + create/update/delete)
  }

  if (hasAnyPermission(['customers.create', 'customers.update'])) {
    // User has at least one of these permissions
  }
}
```

### 3. استخدام API Services

```typescript
import { rolesService, permissionsService } from '../services';

// Get all roles
const roles = await rolesService.getAllRoles();

// Assign role to user
await rolesService.assignRoleToUser({
  user_id: userId,
  role_id: roleId
});

// Get user permissions
const permissions = await permissionsService.getUserPermissions(userId);

// Create permission override
await permissionsService.createPermissionOverride({
  user_id: userId,
  permission_id: permissionId,
  is_granted: true,
  reason: 'Temporary access needed',
  expires_at: '2025-12-31'
});
```

## 📋 الصلاحيات المتاحة

### Resource Permissions (بنمط resource.action)

**Customers:**
- `customers.view`, `customers.create`, `customers.update`, `customers.delete`, `customers.export`

**Work Orders:**
- `work_orders.view`, `work_orders.create`, `work_orders.update`, `work_orders.delete`
- `work_orders.cancel`, `work_orders.complete`, `work_orders.export`

**Invoices:**
- `invoices.view`, `invoices.create`, `invoices.update`, `invoices.delete`
- `invoices.print`, `invoices.export`, `invoices.void`

**Inventory:**
- `inventory.view`, `inventory.create`, `inventory.update`, `inventory.delete`
- `inventory.adjust_stock`, `inventory.export`

**Reports:**
- `reports.view`, `reports.export`
- `reports.financial`, `reports.operations`, `reports.performance`

**Users:**
- `users.view`, `users.create`, `users.update`, `users.delete`
- `users.manage_roles`, `users.manage_permissions`, `users.change_password`

**Roles:**
- `roles.view`, `roles.create`, `roles.update`, `roles.delete`, `roles.manage_permissions`

[See RBAC_IMPLEMENTATION.md for full list of 65 permissions]

## 🔧 الدوال المساعدة في usePermission

```typescript
const {
  can,           // can('customers.delete')
  canView,       // canView('customers')
  canEdit,       // canEdit('customers')
  canCreate,     // canCreate('customers')
  canUpdate,     // canUpdate('customers')
  canDelete,     // canDelete('customers')
  canExport,     // canExport('customers')
  canAny,        // canAny(['customers.create', 'customers.update'])
  canAll,        // canAll(['customers.view', 'customers.delete'])
  isAdmin,       // isAdmin()
  hasRole,       // hasRole('customer_service')
} = usePermission();
```

## 🎯 أمثلة عملية

### مثال 1: إخفاء زر الحذف

```typescript
<ProtectedAction permission="customers.delete">
  <button onClick={handleDelete} className="btn-danger">
    حذف العميل
  </button>
</ProtectedAction>
```

### مثال 2: تعطيل حقل إدخال

```typescript
const { canUpdate } = usePermission();

<input
  type="text"
  value={customerName}
  disabled={!canUpdate('customers')}
/>
```

### مثال 3: عرض قائمة مختلفة للمديرين

```typescript
const { isAdmin } = usePermission();

{isAdmin() ? (
  <AdminMenu />
) : (
  <UserMenu />
)}
```

### مثال 4: التحقق قبل API call

```typescript
const { canDelete } = usePermission();

async function handleDelete() {
  if (!canDelete('customers')) {
    toast.error('ليس لديك صلاحية لحذف العملاء');
    return;
  }

  await customersService.deleteCustomer(customerId);
}
```

## 📖 المزيد

للتوثيق الكامل، راجع: `RBAC_IMPLEMENTATION.md`
