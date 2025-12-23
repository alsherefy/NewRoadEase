/*
  # تصحيح تعيين الصلاحيات للأدوار النظامية

  1. المشكلة
    - كانت Migration السابقة تستخدم : بدلاً من . في مفاتيح الصلاحيات
    - الصلاحيات الصحيحة تستخدم نقطة (.) مثل dashboard.view

  2. الحل
    - تعيين الصلاحيات الصحيحة لدور customer_service
    - تعيين الصلاحيات الصحيحة لدور receptionist
*/

-- منح صلاحيات لدور customer_service
DO $$
DECLARE
  v_role_id uuid;
  v_permission_id uuid;
  v_permission_keys text[] := ARRAY[
    'dashboard.view',
    'customers.view',
    'customers.create',
    'customers.update',
    'customers.export',
    'vehicles.view',
    'vehicles.create',
    'vehicles.update',
    'work_orders.view',
    'work_orders.create',
    'work_orders.update',
    'work_orders.assign',
    'invoices.view',
    'invoices.create',
    'invoices.print',
    'inventory.view',
    'expenses.view',
    'technicians.view',
    'reports.view'
  ];
BEGIN
  FOR v_role_id IN 
    SELECT id FROM roles WHERE key = 'customer_service' AND is_system_role = true
  LOOP
    FOR v_permission_id IN 
      SELECT id FROM permissions 
      WHERE key = ANY(v_permission_keys)
    LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_permission_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- منح صلاحيات لدور receptionist
DO $$
DECLARE
  v_role_id uuid;
  v_permission_id uuid;
  v_permission_keys text[] := ARRAY[
    'dashboard.view',
    'customers.view',
    'customers.create',
    'vehicles.view',
    'work_orders.view',
    'work_orders.create',
    'invoices.view',
    'inventory.view'
  ];
BEGIN
  FOR v_role_id IN 
    SELECT id FROM roles WHERE key = 'receptionist' AND is_system_role = true
  LOOP
    FOR v_permission_id IN 
      SELECT id FROM permissions 
      WHERE key = ANY(v_permission_keys)
    LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_permission_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
