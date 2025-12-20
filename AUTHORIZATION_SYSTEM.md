# Authorization System Documentation

## Overview

This application implements a **Hybrid Authorization System** that combines:
- **Role-Based Access Control (RBAC)**: Three distinct user roles with baseline permissions
- **Permission-Based Access Control (ABAC)**: Fine-grained, customizable permissions per user and resource

This hybrid approach provides both simplicity (through roles) and flexibility (through custom permissions), enabling secure multi-tenant data access with hierarchical control.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Authentication Layer                     │
│  JWT Token → User Profile → Role + Organization Validation  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Authorization Layer                        │
│                                                               │
│  ┌──────────────┐      ┌──────────────────────────────┐    │
│  │ RBAC Check   │──┬──>│ Admin? → ALLOW ALL           │    │
│  │ (Role-Based) │  │   └──────────────────────────────┘    │
│  └──────────────┘  │                                         │
│                     │   ┌──────────────────────────────┐    │
│                     └──>│ Other Roles? → Check ABAC    │    │
│                         └──────────────┬───────────────┘    │
│                                        │                     │
│                                        ▼                     │
│                         ┌──────────────────────────────┐    │
│                         │ ABAC Check (Permission-Based)│    │
│                         │ Query user_permissions table │    │
│                         │ Check can_view / can_edit    │    │
│                         └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Access Layer                         │
│          RLS Policies Enforce Database-Level Security        │
│             organization_id Isolation for Multi-tenancy      │
└─────────────────────────────────────────────────────────────┘
```

---

## Role Definitions

### 1. Admin (`admin`)

**Description**: Super user with unrestricted access to all system resources and functions.

**Baseline Permissions**:
- Full access to all 11 resources
- Can view, create, edit, and delete all data
- Can manage users and assign permissions
- Bypasses all permission checks at the API layer
- Can access data across the entire organization

**Use Cases**:
- Workshop owners
- System administrators
- IT managers

---

### 2. Customer Service (`customer_service`)

**Description**: Front-line staff who handle customer interactions, work orders, and invoicing.

**Baseline Permissions**:
| Resource      | Can View | Can Edit | Notes                                    |
|---------------|----------|----------|------------------------------------------|
| Dashboard     | ✅       | ❌       | Read-only access to metrics              |
| Customers     | ✅       | ✅       | Full management of customer records      |
| Work Orders   | ✅       | ✅       | Create and manage work orders            |
| Invoices      | ✅       | ✅       | Create and manage invoices               |
| Inventory     | ✅       | ✅       | Manage spare parts inventory             |
| Technicians   | ✅       | ❌       | View technician list only                |
| Reports       | ✅       | ❌       | View reports only                        |
| Settings      | ❌       | ❌       | No access                                |
| Users         | ❌       | ❌       | No access                                |
| Expenses      | ❌       | ❌       | No access                                |
| Salaries      | ❌       | ❌       | No access                                |

**Use Cases**:
- Service advisors
- Front desk staff
- Customer relationship managers

---

### 3. Receptionist (`receptionist`)

**Description**: Entry-level staff with limited access, primarily for customer registration and viewing work orders.

**Baseline Permissions**:
| Resource      | Can View | Can Edit | Notes                                    |
|---------------|----------|----------|------------------------------------------|
| Dashboard     | ✅       | ❌       | Read-only access to metrics              |
| Customers     | ✅       | ✅       | Register and update customer information |
| Work Orders   | ✅       | ❌       | View work orders only                    |
| Invoices      | ❌       | ❌       | No access                                |
| Inventory     | ❌       | ❌       | No access                                |
| Technicians   | ❌       | ❌       | No access                                |
| Reports       | ❌       | ❌       | No access                                |
| Settings      | ❌       | ❌       | No access                                |
| Users         | ❌       | ❌       | No access                                |
| Expenses      | ❌       | ❌       | No access                                |
| Salaries      | ❌       | ❌       | No access                                |

**Use Cases**:
- Reception desk staff
- Appointment schedulers
- Entry-level customer service

---

## Permission System

### 11 Permission Keys (Resources)

Each resource in the system has associated permissions:

1. **dashboard**: System metrics and overview
2. **customers**: Customer records and profiles
3. **work_orders**: Service work orders and tracking
4. **invoices**: Billing and payment records
5. **inventory**: Spare parts and stock management
6. **technicians**: Technician profiles and assignments
7. **reports**: Analytics and reporting
8. **settings**: System configuration
9. **users**: User management
10. **expenses**: Business expense tracking
11. **salaries**: Payroll and compensation

### Permission Attributes

Each user-resource permission pair has two boolean flags:

- **can_view**: Grants read access to the resource
- **can_edit**: Grants write access (create, update) to the resource

**Note on Deletion**: Delete operations are restricted to **Admin only** across all resources, regardless of permissions.

### Custom Permissions

The `user_permissions` table stores custom permissions that override baseline role permissions:

```sql
CREATE TABLE user_permissions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  resource TEXT CHECK (resource IN ('dashboard', 'customers', ...)),
  can_view BOOLEAN DEFAULT FALSE,
  can_edit BOOLEAN DEFAULT FALSE
);
```

**Example**: A receptionist can be granted `can_edit` permission for `work_orders`, elevating them beyond their baseline role.

---

## Authorization Flow

### Step-by-Step Process

#### 1. Authentication
```typescript
const auth = await authenticateRequest(req);
// Returns: { userId, role, organizationId, email, fullName }
```

- Extract JWT token from `Authorization` header
- Validate token with Supabase Auth
- Fetch user profile from `users` table
- Validate `is_active` status and `organization_id`
- Validate role is one of: `admin`, `customer_service`, `receptionist`

#### 2. Role-Based Authorization (Simple Cases)
```typescript
adminOnly(auth);  // Only admin can proceed
adminAndCustomerService(auth);  // Admin or customer_service can proceed
allRoles(auth);  // Any authenticated user can proceed
```

#### 3. Permission-Based Authorization (Complex Cases)
```typescript
// Check if user can VIEW work_orders
await authorizePermission(auth, PERMISSION_KEYS.WORK_ORDERS, 'view');

// Check if user can EDIT customers
await authorizePermission(auth, PERMISSION_KEYS.CUSTOMERS, 'edit');
```

**Logic**:
- If user role is `admin`, **skip** permission check (always allowed)
- Query `user_permissions` table for user's permissions on the specified resource
- If no permission record exists, **deny access**
- If `action === 'view'`, check `can_view` flag
- If `action === 'edit'`, check `can_edit` flag
- Throw `ForbiddenError` if permission is missing

#### 4. Delete Authorization (Admin-Only)
```typescript
authorizeDelete(auth);  // Only admin can delete
```

#### 5. Database-Level Security (RLS)
- All tables enforce Row Level Security (RLS)
- Policies check `organization_id` to isolate tenant data
- Policies verify user role and permissions at the database layer
- Defense-in-depth: authorization at both API and database layers

---

## Multi-Tenancy & Organization Isolation

### Organization Boundaries

Every user belongs to exactly one organization (`organization_id` in users table). All data is scoped to organizations:

- `customers.organization_id`
- `work_orders.organization_id`
- `invoices.organization_id`
- `inventory.organization_id`
- etc.

### RLS Policy Pattern

```sql
CREATE POLICY "Users can view own organization data"
  ON work_orders FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );
```

### Admin Hierarchical Access

Admins have access to all data **within their organization**, not across all organizations. Multi-organization management requires separate super-admin infrastructure (not implemented in this system).

---

## Critical Fix: Role Mismatch Resolution

### The Problem

**Before**: The backend Supabase Functions used outdated role names:
- `admin` (correct)
- `staff` (outdated, should be `customer_service`)
- `user` (outdated, should be `receptionist`)

**Impact**: Authorization checks failed because the database and frontend used `customer_service` and `receptionist`, but the backend expected `staff` and `user`.

### The Solution

**Unified Role Definitions**: Created centralized constants in `/supabase/functions/_shared/constants/roles.ts`:

```typescript
export const ROLES = {
  ADMIN: 'admin',
  CUSTOMER_SERVICE: 'customer_service',
  RECEPTIONIST: 'receptionist',
} as const;
```

**Updated Files** (15+ files):
- All `JWTPayload` type definitions
- All `authenticateRequest` functions
- All authorization middleware
- All inline type definitions in endpoint files

**Role Mapping** (for historical reference):
- `staff` → `customer_service`
- `user` → `receptionist`

---

## API Integration Guide

### Using Authorization Middleware in Endpoints

#### Example 1: Simple Role Check

```typescript
import { authenticateRequest } from "./_shared/middleware/auth.ts";
import { adminOnly } from "../_shared/middleware/authorize.ts";

Deno.serve(async (req: Request) => {
  const auth = await authenticateRequest(req);
  adminOnly(auth);  // Throws ForbiddenError if not admin

  // Proceed with admin-only logic
});
```

#### Example 2: Permission-Based Check for GET (View)

```typescript
import { authenticateRequest } from "./_shared/middleware/auth.ts";
import { authorizePermission } from "../_shared/middleware/authorize.ts";
import { PERMISSION_KEYS } from "../_shared/constants/roles.ts";

Deno.serve(async (req: Request) => {
  const auth = await authenticateRequest(req);

  if (req.method === "GET") {
    await authorizePermission(auth, PERMISSION_KEYS.WORK_ORDERS, 'view');
    // Fetch and return data
  }
});
```

#### Example 3: Permission-Based Check for POST/PUT (Edit)

```typescript
import { authenticateRequest } from "./_shared/middleware/auth.ts";
import { authorizePermission } from "../_shared/middleware/authorize.ts";
import { PERMISSION_KEYS } from "../_shared/constants/roles.ts";

Deno.serve(async (req: Request) => {
  const auth = await authenticateRequest(req);

  if (req.method === "POST" || req.method === "PUT") {
    await authorizePermission(auth, PERMISSION_KEYS.CUSTOMERS, 'edit');
    // Proceed with create/update logic
  }
});
```

#### Example 4: Delete Restriction (Admin-Only)

```typescript
import { authenticateRequest } from "./_shared/middleware/auth.ts";
import { authorizeDelete } from "../_shared/middleware/authorize.ts";

Deno.serve(async (req: Request) => {
  const auth = await authenticateRequest(req);

  if (req.method === "DELETE") {
    authorizeDelete(auth);  // Throws ForbiddenError if not admin
    // Proceed with delete logic
  }
});
```

---

## Security Best Practices

### 1. Defense in Depth
- **Never** rely solely on frontend permission checks
- Always validate at both API and database (RLS) layers
- Assume the frontend can be manipulated

### 2. Organization Isolation
- Always filter queries by `organization_id`
- Never expose `organization_id` as a user-controlled parameter
- Use the authenticated user's `organizationId` from JWT payload

### 3. Least Privilege Principle
- Grant minimum permissions required for a role
- Use custom permissions to elevate access only when needed
- Regularly audit user permissions

### 4. Admin Restrictions
- Even admins should not bypass critical business logic
- Log all admin actions for audit trails
- Consider implementing admin approval workflows for sensitive operations

### 5. Token Security
- Use short-lived JWT tokens
- Implement token refresh mechanisms
- Validate token expiration on every request

### 6. Error Handling
- Do not leak sensitive information in error messages
- Use generic "Access denied" messages for authorization failures
- Log detailed errors server-side for debugging

---

## Migration Notes

### For Existing Deployments

#### 1. Database Role Validation

Verify that all users in the `users` table have roles matching the new schema:

```sql
SELECT id, email, role FROM users WHERE role NOT IN ('admin', 'customer_service', 'receptionist');
```

If any users have `staff` or `user` roles, update them:

```sql
UPDATE users SET role = 'customer_service' WHERE role = 'staff';
UPDATE users SET role = 'receptionist' WHERE role = 'user';
```

#### 2. Frontend Consistency

Ensure the frontend `AuthContext` and permission checking logic use the new role names:
- `admin` (unchanged)
- `customer_service` (was `staff`)
- `receptionist` (was `user`)

#### 3. Permission Seeding

For users with the `customer_service` or `receptionist` roles, seed default permissions in the `user_permissions` table based on the baseline permissions defined in this document.

---

## Testing Checklist

### End-to-End Authorization Tests

1. **Admin Access**
   - ✅ Admin can access all resources
   - ✅ Admin can delete any resource
   - ✅ Admin bypasses permission checks

2. **Customer Service Access**
   - ✅ Can view and edit customers, work_orders, invoices, inventory
   - ✅ Can view (but not edit) dashboard, technicians, reports
   - ✅ Cannot access settings, users, expenses, salaries
   - ✅ Cannot delete any resource

3. **Receptionist Access**
   - ✅ Can view and edit customers
   - ✅ Can view (but not edit) dashboard, work_orders
   - ✅ Cannot access invoices, inventory, technicians, reports, settings, users, expenses, salaries
   - ✅ Cannot delete any resource

4. **Custom Permissions**
   - ✅ Custom permissions override baseline role permissions
   - ✅ Granting `can_edit` for a receptionist on `work_orders` allows editing

5. **Organization Isolation**
   - ✅ Users can only access data from their own organization
   - ✅ Admins cannot access data from other organizations
   - ✅ RLS policies enforce organization boundaries

6. **Delete Restrictions**
   - ✅ Only admins can delete resources
   - ✅ Non-admins receive 403 Forbidden when attempting deletion
   - ✅ RLS policies enforce deletion restrictions at database layer

---

## Troubleshooting

### Common Issues

#### Issue: User gets "Access Denied" despite having correct role

**Possible Causes**:
1. Missing permissions record in `user_permissions` table for non-admin users
2. `is_active` flag is set to `false` in users table
3. User's `organization_id` is NULL

**Solution**: Verify user record and seed default permissions.

#### Issue: Admin cannot access resources

**Possible Causes**:
1. Role in database is not exactly `'admin'` (check for typos, extra spaces)
2. RLS policies are too restrictive

**Solution**: Verify role spelling, check RLS policies allow admin access.

#### Issue: Frontend shows permission, but backend denies access

**Possible Causes**:
1. Frontend permission check is out of sync with backend
2. JWT token is stale (contains outdated role/permissions)

**Solution**: Refresh user session, ensure frontend and backend use same permission logic.

---

## Conclusion

This hybrid authorization system provides a robust, scalable foundation for secure multi-tenant access control. By combining RBAC for simplicity and ABAC for flexibility, the system accommodates diverse user roles while maintaining strict security boundaries.

**Key Takeaways**:
- Three unified roles: `admin`, `customer_service`, `receptionist`
- 11 resource permissions with `can_view` and `can_edit` flags
- Admins bypass permission checks; others require explicit permissions
- Delete operations are admin-only
- Multi-tenancy enforced via `organization_id` isolation
- Defense-in-depth: authorization at API and database (RLS) layers

For implementation details, refer to the codebase:
- Constants: `/supabase/functions/_shared/constants/roles.ts`
- Middleware: `/supabase/functions/_shared/middleware/authorize.ts`
- Database migrations: `/supabase/migrations/`
