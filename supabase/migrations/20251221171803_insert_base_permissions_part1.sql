/*
  # إدخال الصلاحيات الأساسية - الجزء 1
  
  الصلاحيات المضافة:
  - Dashboard
  - Customers
  - Vehicles  
  - Work Orders
  - Invoices
*/

-- Dashboard Permissions
INSERT INTO permissions (key, resource, action, name_ar, name_en, description_ar, description_en, category, display_order) VALUES
('dashboard.view', 'dashboard', 'view', 'عرض لوحة التحكم', 'View Dashboard', 'القدرة على رؤية لوحة التحكم والإحصائيات', 'Ability to view dashboard and statistics', 'general', 1)
ON CONFLICT (key) DO NOTHING;

-- Customers Permissions
INSERT INTO permissions (key, resource, action, name_ar, name_en, description_ar, description_en, category, display_order) VALUES
('customers.view', 'customers', 'view', 'عرض العملاء', 'View Customers', 'القدرة على عرض قائمة العملاء وتفاصيلهم', 'Ability to view customers list and details', 'operations', 10),
('customers.create', 'customers', 'create', 'إضافة عميل', 'Create Customer', 'القدرة على إضافة عملاء جدد', 'Ability to create new customers', 'operations', 11),
('customers.update', 'customers', 'update', 'تعديل العملاء', 'Update Customers', 'القدرة على تعديل بيانات العملاء', 'Ability to update customer data', 'operations', 12),
('customers.delete', 'customers', 'delete', 'حذف العملاء', 'Delete Customers', 'القدرة على حذف العملاء', 'Ability to delete customers', 'operations', 13),
('customers.export', 'customers', 'export', 'تصدير العملاء', 'Export Customers', 'القدرة على تصدير بيانات العملاء', 'Ability to export customer data', 'operations', 14)
ON CONFLICT (key) DO NOTHING;

-- Vehicles Permissions
INSERT INTO permissions (key, resource, action, name_ar, name_en, description_ar, description_en, category, display_order) VALUES
('vehicles.view', 'vehicles', 'view', 'عرض المركبات', 'View Vehicles', 'القدرة على عرض قائمة المركبات', 'Ability to view vehicles list', 'operations', 20),
('vehicles.create', 'vehicles', 'create', 'إضافة مركبة', 'Create Vehicle', 'القدرة على إضافة مركبات جديدة', 'Ability to create new vehicles', 'operations', 21),
('vehicles.update', 'vehicles', 'update', 'تعديل المركبات', 'Update Vehicles', 'القدرة على تعديل بيانات المركبات', 'Ability to update vehicle data', 'operations', 22),
('vehicles.delete', 'vehicles', 'delete', 'حذف المركبات', 'Delete Vehicles', 'القدرة على حذف المركبات', 'Ability to delete vehicles', 'operations', 23)
ON CONFLICT (key) DO NOTHING;

-- Work Orders Permissions
INSERT INTO permissions (key, resource, action, name_ar, name_en, description_ar, description_en, category, display_order) VALUES
('work_orders.view', 'work_orders', 'view', 'عرض أوامر العمل', 'View Work Orders', 'القدرة على عرض أوامر العمل', 'Ability to view work orders', 'operations', 30),
('work_orders.create', 'work_orders', 'create', 'إنشاء أمر عمل', 'Create Work Order', 'القدرة على إنشاء أوامر عمل جديدة', 'Ability to create new work orders', 'operations', 31),
('work_orders.update', 'work_orders', 'update', 'تعديل أوامر العمل', 'Update Work Orders', 'القدرة على تعديل أوامر العمل', 'Ability to update work orders', 'operations', 32),
('work_orders.delete', 'work_orders', 'delete', 'حذف أوامر العمل', 'Delete Work Orders', 'القدرة على حذف أوامر العمل', 'Ability to delete work orders', 'operations', 33),
('work_orders.cancel', 'work_orders', 'cancel', 'إلغاء أوامر العمل', 'Cancel Work Orders', 'القدرة على إلغاء أوامر العمل', 'Ability to cancel work orders', 'operations', 34),
('work_orders.complete', 'work_orders', 'complete', 'إكمال أوامر العمل', 'Complete Work Orders', 'القدرة على تحديد أوامر العمل كمكتملة', 'Ability to mark work orders as complete', 'operations', 35),
('work_orders.export', 'work_orders', 'export', 'تصدير أوامر العمل', 'Export Work Orders', 'القدرة على تصدير بيانات أوامر العمل', 'Ability to export work orders data', 'operations', 36)
ON CONFLICT (key) DO NOTHING;

-- Invoices Permissions
INSERT INTO permissions (key, resource, action, name_ar, name_en, description_ar, description_en, category, display_order) VALUES
('invoices.view', 'invoices', 'view', 'عرض الفواتير', 'View Invoices', 'القدرة على عرض الفواتير', 'Ability to view invoices', 'financial', 40),
('invoices.create', 'invoices', 'create', 'إنشاء فاتورة', 'Create Invoice', 'القدرة على إنشاء فواتير جديدة', 'Ability to create new invoices', 'financial', 41),
('invoices.update', 'invoices', 'update', 'تعديل الفواتير', 'Update Invoices', 'القدرة على تعديل الفواتير', 'Ability to update invoices', 'financial', 42),
('invoices.delete', 'invoices', 'delete', 'حذف الفواتير', 'Delete Invoices', 'القدرة على حذف الفواتير', 'Ability to delete invoices', 'financial', 43),
('invoices.print', 'invoices', 'print', 'طباعة الفواتير', 'Print Invoices', 'القدرة على طباعة الفواتير', 'Ability to print invoices', 'financial', 44),
('invoices.export', 'invoices', 'export', 'تصدير الفواتير', 'Export Invoices', 'القدرة على تصدير بيانات الفواتير', 'Ability to export invoices data', 'financial', 45),
('invoices.void', 'invoices', 'void', 'إلغاء الفواتير', 'Void Invoices', 'القدرة على إلغاء الفواتير', 'Ability to void invoices', 'financial', 46)
ON CONFLICT (key) DO NOTHING;
