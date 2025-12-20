# Authorization System Verification Checklist

This document provides a comprehensive checklist to verify the refactored hybrid authorization system is correctly implemented and functioning.

---

## Database Schema Verification

### Users Table

- [ ] **Role Enum Constraint**
  ```sql
  SELECT constraint_name, check_clause
  FROM information_schema.check_constraints
  WHERE table_name = 'users' AND constraint_name LIKE '%role%';
  ```
  **Expected**: Role constraint includes `'admin'`, `'customer_service'`, `'receptionist'`

- [ ] **All Users Have Valid Roles**
  ```sql
  SELECT id, email, role FROM users
  WHERE role NOT IN ('admin', 'customer_service', 'receptionist');
  ```
  **Expected**: Zero rows (all users have valid roles)

- [ ] **Organization Assignment**
  ```sql
  SELECT id, email FROM users WHERE organization_id IS NULL;
  ```
  **Expected**: Zero rows (all users belong to an organization)

- [ ] **Active Status**
  ```sql
  SELECT id, email, is_active FROM users WHERE is_active IS NULL;
  ```
  **Expected**: Zero rows (all users have explicit active status)

### User Permissions Table

- [ ] **Resource Constraint**
  ```sql
  SELECT constraint_name, check_clause
  FROM information_schema.check_constraints
  WHERE table_name = 'user_permissions' AND constraint_name LIKE '%resource%';
  ```
  **Expected**: Resource constraint includes all 11 permission keys: `dashboard`, `customers`, `work_orders`, `invoices`, `inventory`, `technicians`, `reports`, `settings`, `users`, `expenses`, `salaries`

- [ ] **Unique User-Resource Pairs**
  ```sql
  SELECT user_id, resource, COUNT(*)
  FROM user_permissions
  GROUP BY user_id, resource
  HAVING COUNT(*) > 1;
  ```
  **Expected**: Zero rows (no duplicate permissions per user-resource pair)

- [ ] **Valid Boolean Flags**
  ```sql
  SELECT id FROM user_permissions
  WHERE can_view IS NULL OR can_edit IS NULL;
  ```
  **Expected**: Zero rows (all permissions have explicit boolean values)

### RLS Policies

- [ ] **RLS Enabled on All Tables**
  ```sql
  SELECT schemaname, tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('users', 'customers', 'work_orders', 'invoices', 'inventory', 'technicians', 'expenses', 'salaries', 'user_permissions')
    AND rowsecurity = false;
  ```
  **Expected**: Zero rows (all critical tables have RLS enabled)

- [ ] **Organization Isolation Policies Exist**
  ```sql
  SELECT tablename, policyname
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('customers', 'work_orders', 'invoices', 'inventory')
    AND policyname LIKE '%organization%';
  ```
  **Expected**: At least one policy per table enforcing organization_id filtering

---

## Backend Verification

### File Changes Completed

- [ ] **Centralized Constants Created**
  - [ ] `/supabase/functions/_shared/constants/roles.ts` exists
  - [ ] `/supabase/functions/_shared/constants/permissions.ts` exists
  - [ ] `ROLES` constant defines all three roles
  - [ ] `PERMISSION_KEYS` constant defines all 11 resources
  - [ ] `DEFAULT_PERMISSIONS` constant defines baseline permissions for each role

- [ ] **Shared Type Definitions Updated**
  - [ ] `/supabase/functions/_shared/types.ts` uses `Role` type from constants
  - [ ] `JWTPayload.role` type is `Role` (not hardcoded union)

- [ ] **Module-Specific Type Definitions Updated** (6 files)
  - [ ] `/supabase/functions/expenses/_shared/types.ts` uses `Role` type
  - [ ] `/supabase/functions/inventory/_shared/types.ts` uses `Role` type
  - [ ] `/supabase/functions/settings/_shared/types.ts` uses `Role` type
  - [ ] `/supabase/functions/technicians/_shared/types.ts` uses `Role` type
  - [ ] `/supabase/functions/users/_shared/types.ts` uses `Role` type
  - [ ] `/supabase/functions/work-orders/_shared/types.ts` uses `Role` type

- [ ] **Shared Authentication Middleware Updated**
  - [ ] `/supabase/functions/_shared/middleware/auth.ts` imports `Role` and `ALL_ROLES`
  - [ ] `authenticateRequest` validates role against `ALL_ROLES`
  - [ ] Type assertion uses `Role` type

- [ ] **Module-Specific Authentication Middleware Updated** (5 files)
  - [ ] `/supabase/functions/expenses/_shared/middleware/auth.ts` uses `Role` type
  - [ ] `/supabase/functions/inventory/_shared/middleware/auth.ts` uses `Role` type
  - [ ] `/supabase/functions/settings/_shared/middleware/auth.ts` uses `Role` type
  - [ ] `/supabase/functions/technicians/_shared/middleware/auth.ts` uses `Role` type
  - [ ] `/supabase/functions/work-orders/_shared/middleware/auth.ts` uses `Role` type

- [ ] **Authorization Middleware Refactored**
  - [ ] `/supabase/functions/_shared/middleware/authorize.ts` updated with:
    - [ ] `authorize` function uses `Role[]` parameter type
    - [ ] `adminOnly` uses `[ROLES.ADMIN]`
    - [ ] `adminAndCustomerService` uses `[ROLES.ADMIN, ROLES.CUSTOMER_SERVICE]`
    - [ ] `allRoles` uses all three roles
    - [ ] `authorizePermission` function implemented
    - [ ] `authorizeDelete` function implemented

### Code Quality Checks

- [ ] **No Hardcoded Role Strings**
  ```bash
  grep -r "'admin' | 'staff' | 'user'" supabase/functions/
  ```
  **Expected**: No matches (all role references use constants)

- [ ] **No Hardcoded Permission Strings in Logic**
  ```bash
  grep -r "resource.*===.*'work_orders'" supabase/functions/_shared/
  ```
  **Expected**: Uses `PERMISSION_KEYS.WORK_ORDERS` instead

- [ ] **All Functions Import from Constants**
  ```bash
  grep -r "from.*constants/roles" supabase/functions/
  ```
  **Expected**: Multiple matches across shared and module-specific files

---

## Frontend Consistency

### AuthContext Role Checking

- [ ] **Role Constants Match Backend**
  - [ ] Check `/src/contexts/AuthContext.tsx` uses `admin`, `customer_service`, `receptionist`
  - [ ] No references to `staff` or `user` roles

- [ ] **Permission Keys Match Backend**
  - [ ] Check `/src/components/UserPermissionsManager.tsx` lists all 11 permission keys
  - [ ] Permission key names match backend constants exactly

### UI Permission Gates

- [ ] **Navigation Menu Respects Permissions**
  - [ ] Admin sees all menu items
  - [ ] Customer service sees appropriate subset
  - [ ] Receptionist sees limited menu items

- [ ] **Action Buttons Respect Permissions**
  - [ ] Delete buttons only visible to admins
  - [ ] Edit buttons respect `can_edit` permission
  - [ ] Create buttons respect `can_edit` permission

---

## API Endpoint Verification

### Authentication Integration

For each endpoint file (`/supabase/functions/*/index.ts`):

- [ ] **Imports Correct Middleware**
  - [ ] Uses `authenticateRequest` from shared or module-specific `_shared/middleware/auth.ts`
  - [ ] Uses authorization functions from `../`_shared/middleware/authorize.ts`

- [ ] **Authentication Applied to All Requests**
  - [ ] `const auth = await authenticateRequest(req)` called early in handler
  - [ ] OPTIONS requests return CORS response without auth

### Permission Checks Applied

- [ ] **GET Requests (View Permission)**
  - [ ] Call `await authorizePermission(auth, PERMISSION_KEYS.{RESOURCE}, 'view')`
  - [ ] Or use role-based check (`allRoles`, etc.) if appropriate

- [ ] **POST/PUT Requests (Edit Permission)**
  - [ ] Call `await authorizePermission(auth, PERMISSION_KEYS.{RESOURCE}, 'edit')`
  - [ ] Or use `adminOnly` if admin-exclusive

- [ ] **DELETE Requests (Admin-Only)**
  - [ ] Call `authorizeDelete(auth)` before processing deletion
  - [ ] Returns 403 Forbidden for non-admins

### Critical Endpoints Checked

- [ ] `/supabase/functions/work-orders/index.ts`
  - [ ] GET: View permission or role check
  - [ ] POST: Edit permission or role check
  - [ ] PUT: Edit permission or role check
  - [ ] DELETE: `authorizeDelete(auth)` called

- [ ] `/supabase/functions/invoices/index.ts`
  - [ ] GET: View permission or role check
  - [ ] POST: Edit permission or role check
  - [ ] PUT: Edit permission or role check
  - [ ] DELETE: `authorizeDelete(auth)` called

- [ ] `/supabase/functions/customers/index.ts`
  - [ ] GET: View permission or role check
  - [ ] POST: Edit permission or role check
  - [ ] PUT: Edit permission or role check
  - [ ] DELETE: `authorizeDelete(auth)` called

- [ ] `/supabase/functions/users/index.ts`
  - [ ] GET: Admin or appropriate role check
  - [ ] POST: Admin-only for user creation
  - [ ] PUT: Admin-only or self-update
  - [ ] DELETE: `authorizeDelete(auth)` called

- [ ] `/supabase/functions/inventory/index.ts`
  - [ ] GET: View permission or role check
  - [ ] POST: Edit permission or role check
  - [ ] PUT: Edit permission or role check
  - [ ] DELETE: `authorizeDelete(auth)` called

- [ ] `/supabase/functions/technicians/index.ts`
  - [ ] GET: View permission or role check
  - [ ] POST: Edit permission or role check
  - [ ] PUT: Edit permission or role check
  - [ ] DELETE: `authorizeDelete(auth)` called

- [ ] `/supabase/functions/expenses/index.ts`
  - [ ] GET: View permission or role check
  - [ ] POST: Edit permission or role check
  - [ ] PUT: Edit permission or role check
  - [ ] DELETE: `authorizeDelete(auth)` called

- [ ] `/supabase/functions/salaries/index.ts`
  - [ ] GET: View permission or role check
  - [ ] POST: Edit permission or role check
  - [ ] PUT: Edit permission or role check
  - [ ] DELETE: `authorizeDelete(auth)` called

- [ ] `/supabase/functions/reports/index.ts`
  - [ ] GET: View permission or role check

- [ ] `/supabase/functions/settings/index.ts`
  - [ ] GET: View permission or role check
  - [ ] PUT: Edit permission or role check

---

## End-to-End Testing Scenarios

### Scenario 1: Admin User

**Setup**: Create/use an admin user account

1. [ ] **Login**: Admin can log in successfully
2. [ ] **Dashboard**: Admin sees full dashboard with all metrics
3. [ ] **Navigation**: Admin sees all menu items (Customers, Work Orders, Invoices, Inventory, Technicians, Reports, Settings, Users, Expenses, Salaries)
4. [ ] **View Access**: Admin can view all resources
5. [ ] **Edit Access**: Admin can create and edit all resources
6. [ ] **Delete Access**: Admin can delete customers, work orders, invoices, inventory items, etc.
7. [ ] **User Management**: Admin can create new users, edit user roles, assign permissions
8. [ ] **Settings**: Admin can modify workshop settings

### Scenario 2: Customer Service User (Default Permissions)

**Setup**: Create a customer_service user without custom permissions

1. [ ] **Login**: Customer service user can log in successfully
2. [ ] **Dashboard**: User sees dashboard with read-only access
3. [ ] **Navigation**: User sees limited menu items (Dashboard, Customers, Work Orders, Invoices, Inventory, Technicians, Reports)
4. [ ] **View Access**:
   - [ ] Can view customers, work orders, invoices, inventory
   - [ ] Can view technicians (read-only)
   - [ ] Can view reports (read-only)
   - [ ] Cannot view settings, users, expenses, salaries (menu items hidden or access denied)
5. [ ] **Edit Access**:
   - [ ] Can create and edit customers, work orders, invoices, inventory
   - [ ] Cannot edit dashboard, technicians, reports
6. [ ] **Delete Access**: Cannot delete any resources (delete buttons hidden or return 403)
7. [ ] **User Management**: Cannot access user management section

### Scenario 3: Receptionist User (Default Permissions)

**Setup**: Create a receptionist user without custom permissions

1. [ ] **Login**: Receptionist can log in successfully
2. [ ] **Dashboard**: User sees dashboard with read-only access
3. [ ] **Navigation**: User sees very limited menu items (Dashboard, Customers, Work Orders)
4. [ ] **View Access**:
   - [ ] Can view customers
   - [ ] Can view work orders (read-only)
   - [ ] Can view dashboard (read-only)
   - [ ] Cannot view invoices, inventory, technicians, reports, settings, users, expenses, salaries
5. [ ] **Edit Access**:
   - [ ] Can create and edit customers
   - [ ] Cannot edit work orders, dashboard, or any other resources
6. [ ] **Delete Access**: Cannot delete any resources
7. [ ] **User Management**: Cannot access user management section

### Scenario 4: Custom Permissions

**Setup**: Create a receptionist user with custom `can_edit` permission for `work_orders`

1. [ ] **Permission Override**: Verify permission record exists in database
   ```sql
   SELECT * FROM user_permissions
   WHERE user_id = '{receptionist_user_id}' AND resource = 'work_orders';
   ```
2. [ ] **Edit Access**: Receptionist can now create and edit work orders
3. [ ] **View Access**: Still can view work orders (unchanged)
4. [ ] **Delete Restriction**: Still cannot delete work orders (admin-only)

### Scenario 5: Organization Isolation

**Setup**: Create two organizations with separate users and data

1. [ ] **User A (Org 1, Admin)**: Can access all data from Org 1
2. [ ] **User B (Org 2, Admin)**: Can access all data from Org 2
3. [ ] **Cross-Org Access**: User A cannot access Org 2 data (returns empty results or 404)
4. [ ] **Cross-Org Access**: User B cannot access Org 1 data (returns empty results or 404)
5. [ ] **Database Query**: Direct database query filtering by `organization_id` returns only org-specific data

### Scenario 6: Delete Restrictions

**Setup**: Use a customer_service user with edit permissions

1. [ ] **Attempt Delete Customer**: Returns 403 Forbidden
2. [ ] **Attempt Delete Work Order**: Returns 403 Forbidden
3. [ ] **Attempt Delete Invoice**: Returns 403 Forbidden
4. [ ] **UI Verification**: Delete buttons not visible or disabled for non-admin users
5. [ ] **Admin Delete**: Admin user can successfully delete the same resources

---

## Security Testing

### Authorization Bypass Attempts

- [ ] **Tampering with JWT Token**
  - [ ] Modified role in token is rejected (token signature invalid)
  - [ ] Expired token is rejected

- [ ] **Direct API Calls Without Auth**
  - [ ] All endpoints return 401 Unauthorized without Bearer token

- [ ] **Direct API Calls with Invalid Role**
  - [ ] User with role `'hacker'` is rejected during authentication

- [ ] **Permission Escalation via API**
  - [ ] User cannot modify their own permissions via API (admin-only)
  - [ ] User cannot change their own role via API (admin-only)

- [ ] **Organization Boundary Bypass**
  - [ ] User cannot access data by guessing organization IDs
  - [ ] RLS policies enforce organization filtering even with direct SQL

### Common Vulnerabilities

- [ ] **SQL Injection**: All parameterized queries (Supabase client handles this)
- [ ] **Mass Assignment**: API only accepts expected fields in request body
- [ ] **IDOR (Insecure Direct Object Reference)**: Resource IDs are validated against user's organization
- [ ] **CSRF**: Edge Functions use stateless JWT auth (no CSRF risk)

---

## Performance Verification

### Database Indexes

- [ ] **Organization Filtering Indexes**
  ```sql
  SELECT tablename, indexname
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexdef LIKE '%organization_id%';
  ```
  **Expected**: Indexes exist on `organization_id` columns for frequently queried tables

- [ ] **User Permissions Index**
  ```sql
  SELECT indexname FROM pg_indexes
  WHERE tablename = 'user_permissions'
    AND (indexdef LIKE '%user_id%' OR indexdef LIKE '%resource%');
  ```
  **Expected**: Composite index on `(user_id, resource)` for fast permission lookups

### Query Performance

- [ ] **Permission Check Query Time**
  - Test `authorizePermission` with large permission dataset
  - **Expected**: < 50ms for permission lookup

- [ ] **Organization Data Query Time**
  - Test large organization with 1000+ work orders
  - **Expected**: < 200ms for filtered paginated results

---

## Deployment Verification

### Pre-Deployment Checks

- [ ] **All Edge Functions Build Successfully**
  ```bash
  npm run build
  ```
  **Expected**: No TypeScript errors

- [ ] **All Migrations Applied**
  ```sql
  SELECT * FROM supabase_migrations ORDER BY version DESC LIMIT 5;
  ```
  **Expected**: Latest migration timestamp matches most recent migration file

- [ ] **Environment Variables Set**
  - [ ] `SUPABASE_URL` exists
  - [ ] `SUPABASE_ANON_KEY` exists
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` exists

### Post-Deployment Checks

- [ ] **Edge Functions Deployed**
  - [ ] All 12 functions show as deployed in Supabase dashboard
  - [ ] All functions return successful health check

- [ ] **Database Connections Work**
  - [ ] Frontend can fetch data via API
  - [ ] Edge functions can query database

- [ ] **Authentication Flow Works**
  - [ ] User can log in
  - [ ] User can log out
  - [ ] Token refresh works (if implemented)

---

## Documentation Review

- [ ] **`AUTHORIZATION_SYSTEM.md` Created**
  - [ ] Contains complete overview of hybrid system
  - [ ] Documents all three roles with baseline permissions
  - [ ] Documents all 11 permission keys
  - [ ] Includes API integration examples
  - [ ] Includes security best practices
  - [ ] Documents the role mismatch fix

- [ ] **`AUTHORIZATION_VERIFICATION.md` Created** (This Document)
  - [ ] Contains comprehensive verification checklist
  - [ ] Includes test scenarios
  - [ ] Includes security testing guidelines

- [ ] **Code Comments Updated**
  - [ ] Authorization middleware includes JSDoc comments
  - [ ] Constants include descriptive comments
  - [ ] Critical security logic is commented

---

## Sign-Off

### Development Team

- [ ] **Backend Developer**: Verified all Edge Functions updated and tested
- [ ] **Frontend Developer**: Verified UI reflects correct permissions
- [ ] **Database Administrator**: Verified all RLS policies are correct
- [ ] **QA Engineer**: Completed all test scenarios successfully
- [ ] **Security Reviewer**: Approved authorization logic and security controls

### Deployment Approval

- [ ] **Staging Environment**: All checks passed
- [ ] **Production Environment**: Ready for deployment
- [ ] **Rollback Plan**: Documented and tested

---

## Notes

- This checklist should be executed in a staging environment before production deployment.
- Any failed check should be investigated and resolved before proceeding.
- Document any deviations or special circumstances in the project's issue tracker.
- Consider automating portions of this checklist with integration tests.

---

**Last Updated**: 2025-12-20
**Version**: 1.0
**Status**: Initial Release
