/*
  # تعيين الصلاحيات للأدوار النظامية

  1. دور customer_service
    - صلاحيات متوسطة للتعامل مع العملاء والطلبات
    - يمكنه عرض وإنشاء وتحديث (لكن ليس حذف)

  2. دور receptionist
    - صلاحيات أساسية للعرض فقط
    - يمكنه رؤية البيانات الأساسية

  3. ملاحظة
    - سيتم تطبيق الصلاحيات على جميع الأدوار في جميع المؤسسات
*/

-- منح صلاحيات لدور customer_service
DO $$
DECLARE
  v_role_id uuid;
  v_permission_id uuid;
  v_permission_keys text[] := ARRAY[
    'dashboard:view',
    'customers:view',
    'customers:create',
    'customers:update',
    'customers:export',
    'vehicles:view',
    'vehicles:create',
    'vehicles:update',
    'work_orders:view',
    'work_orders:create',
    'work_orders:update',
    'work_orders:assign',
    'invoices:view',
    'invoices:create',
    'invoices:print',
    'inventory:view',
    'expenses:view',
    'technicians:view',
    'reports:view'
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
    'dashboard:view',
    'customers:view',
    'customers:create',
    'vehicles:view',
    'work_orders:view',
    'work_orders:create',
    'invoices:view',
    'inventory:view'
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
