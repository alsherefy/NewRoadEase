/*
  # إنشاء الأدوار الأساسية وتعيين صلاحياتها
  
  1. إنشاء الأدوار الأساسية الثلاثة:
    - Admin: جميع الصلاحيات
    - Customer Service: صلاحيات متوسطة للعمليات والمالية
    - Receptionist: صلاحيات محدودة للاستقبال والعملاء
  
  2. ربط الصلاحيات بكل دور
*/

-- إنشاء الأدوار الأساسية لجميع المنظمات الموجودة
INSERT INTO roles (organization_id, name, name_en, key, description, is_system_role, is_active)
SELECT 
  id as organization_id,
  'المدير' as name,
  'Administrator' as name_en,
  'admin' as key,
  'دور المدير - صلاحيات كاملة على النظام' as description,
  true as is_system_role,
  true as is_active
FROM organizations
ON CONFLICT (organization_id, key) DO NOTHING;

INSERT INTO roles (organization_id, name, name_en, key, description, is_system_role, is_active)
SELECT 
  id as organization_id,
  'خدمة العملاء' as name,
  'Customer Service' as name_en,
  'customer_service' as key,
  'دور خدمة العملاء - صلاحيات متوسطة للعمليات والفواتير' as description,
  true as is_system_role,
  true as is_active
FROM organizations
ON CONFLICT (organization_id, key) DO NOTHING;

INSERT INTO roles (organization_id, name, name_en, key, description, is_system_role, is_active)
SELECT 
  id as organization_id,
  'موظف استقبال' as name,
  'Receptionist' as name_en,
  'receptionist' as key,
  'دور موظف الاستقبال - صلاحيات محدودة للاستقبال والعملاء' as description,
  true as is_system_role,
  true as is_active
FROM organizations
ON CONFLICT (organization_id, key) DO NOTHING;

-- ربط جميع الصلاحيات بدور Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ربط صلاحيات Customer Service (صلاحيات متوسطة)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'customer_service'
AND p.key IN (
  'dashboard.view',
  'customers.view', 'customers.create', 'customers.update', 'customers.delete', 'customers.export',
  'vehicles.view', 'vehicles.create', 'vehicles.update', 'vehicles.delete',
  'work_orders.view', 'work_orders.create', 'work_orders.update', 'work_orders.delete', 
  'work_orders.cancel', 'work_orders.complete', 'work_orders.export',
  'invoices.view', 'invoices.create', 'invoices.update', 'invoices.delete', 
  'invoices.print', 'invoices.export',
  'inventory.view', 'inventory.create', 'inventory.update', 'inventory.adjust_stock', 'inventory.export',
  'technicians.view', 'technicians.view_performance',
  'reports.view', 'reports.export', 'reports.operations'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ربط صلاحيات Receptionist (صلاحيات محدودة)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'receptionist'
AND p.key IN (
  'dashboard.view',
  'customers.view', 'customers.create', 'customers.update',
  'vehicles.view', 'vehicles.create', 'vehicles.update',
  'work_orders.view', 'work_orders.create',
  'invoices.view',
  'expenses.view', 'expenses.create', 'expenses.update', 'expenses.delete',
  'inventory.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;
