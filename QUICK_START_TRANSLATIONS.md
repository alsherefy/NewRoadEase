# Quick Start: Using Translations in ROAD EASE

## 🎯 TL;DR

- **System data** (roles, permissions) = English keys in DB → Translated in i18n files
- **User data** (names, notes) = Stored as-is in DB → No translation

## 🚀 Quick Examples

### Translating Roles

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  const userRole = 'admin'; // from database

  // ✅ Correct
  return <span>{t('roles.admin.name')}</span>; // "مدير" or "Administrator"

  // ✅ Better: Use helper
  import { translateRole } from '../utils/translationHelpers';
  return <span>{translateRole(userRole, t)}</span>;

  // ❌ Wrong (old way)
  return <span>{t('roles.admin')}</span>; // Won't work anymore
}
```

### Translating Permissions

```typescript
import { translatePermission } from '../utils/translationHelpers';

function PermissionBadge({ permissionKey }) {
  const { t } = useTranslation();

  // ✅ Correct
  return (
    <div>
      <p>{t(`permissions.details.${permissionKey}.name`)}</p>
      <p>{t(`permissions.details.${permissionKey}.description`)}</p>
    </div>
  );

  // ✅ Better: Use helper
  return (
    <div>
      <p>{translatePermission(permissionKey, t)}</p>
      <p>{translatePermissionDescription(permissionKey, t)}</p>
    </div>
  );
}
```

## 📦 Helper Functions

```typescript
import {
  translateRole,
  translateRoleDescription,
  translatePermission,
  translatePermissionDescription,
  getRoleColor,
  getRoleBgColor,
  getRoleGradient
} from '../utils/translationHelpers';

// Role translation
translateRole('admin', t) // → "مدير" or "Administrator"
translateRoleDescription('admin', t) // → Full description

// Permission translation
translatePermission('customers.view', t) // → "عرض العملاء"
translatePermissionDescription('customers.view', t) // → Full description

// Styling helpers
getRoleColor('admin') // → "text-orange-600"
getRoleBgColor('customer_service') // → "bg-green-100"
getRoleGradient('receptionist') // → "from-blue-500 to-blue-600"
```

## 🗂️ Translation File Structure

### Roles (`roles.{roleKey}.name`)
```typescript
t('roles.admin.name') // "مدير"
t('roles.customer_service.name') // "خدمة عملاء"
t('roles.receptionist.name') // "موظف استقبال"
```

### Permissions (`permissions.details.{permissionKey}.name`)
```typescript
t('permissions.details.dashboard.view.name') // "عرض لوحة التحكم"
t('permissions.details.customers.view.name') // "عرض العملاء"
t('permissions.details.customers.create.name') // "إضافة عميل"
```

## ⚠️ Common Mistakes

```typescript
// ❌ DON'T: Use old translation keys
t('roles.admin') // This won't work

// ✅ DO: Use new nested structure
t('roles.admin.name')

// ❌ DON'T: Try to translate user data
t('customer_names.' + customerName) // User data is NOT translated

// ✅ DO: Display user data as-is
<span>{customerName}</span> // Display exactly as entered
```

## 🎨 Role Colors Reference

| Role | Text Color | Background | Gradient |
|------|-----------|------------|----------|
| `admin` | `text-orange-600` | `bg-orange-100` | `from-orange-500 to-orange-600` |
| `customer_service` | `text-green-600` | `bg-green-100` | `from-green-500 to-green-600` |
| `receptionist` | `text-blue-600` | `bg-blue-100` | `from-blue-500 to-blue-600` |

## 📚 Full Documentation

For complete details, see [SYSTEM_DATA_SEPARATION.md](./SYSTEM_DATA_SEPARATION.md)

## 🔍 Need Help?

1. Check if your translation key exists in `src/locales/{lang}/common.json`
2. Use browser console to see missing translation warnings
3. Run `npm run validate:i18n` to check for missing keys
4. Read the full documentation for advanced use cases
