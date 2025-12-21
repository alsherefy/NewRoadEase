/*
  # إدخال الصلاحيات الأساسية - الجزء 2
  
  الصلاحيات المضافة:
  - Inventory
  - Expenses
  - Salaries
  - Technicians
  - Reports
  - Settings
  - Users
  - Roles
  - Audit Logs
*/

-- Inventory Permissions
INSERT INTO permissions (key, resource, action, name_ar, name_en, description_ar, description_en, category, display_order) VALUES
('inventory.view', 'inventory', 'view', 'عرض المخزون', 'View Inventory', 'القدرة على عرض قطع الغيار', 'Ability to view spare parts inventory', 'operations', 50),
('inventory.create', 'inventory', 'create', 'إضافة قطعة', 'Create Spare Part', 'القدرة على إضافة قطع غيار جديدة', 'Ability to add new spare parts', 'operations', 51),
('inventory.update', 'inventory', 'update', 'تعديل المخزون', 'Update Inventory', 'القدرة على تعديل بيانات قطع الغيار', 'Ability to update spare parts data', 'operations', 52),
('inventory.delete', 'inventory', 'delete', 'حذف من المخزون', 'Delete from Inventory', 'القدرة على حذف قطع الغيار', 'Ability to delete spare parts', 'operations', 53),
('inventory.adjust_stock', 'inventory', 'adjust_stock', 'تعديل الكميات', 'Adjust Stock', 'القدرة على تعديل كميات المخزون', 'Ability to adjust stock quantities', 'operations', 54),
('inventory.export', 'inventory', 'export', 'تصدير المخزون', 'Export Inventory', 'القدرة على تصدير بيانات المخزون', 'Ability to export inventory data', 'operations', 55)
ON CONFLICT (key) DO NOTHING;

-- Expenses Permissions
INSERT INTO permissions (key, resource, action, name_ar, name_en, description_ar, description_en, category, display_order) VALUES
('expenses.view', 'expenses', 'view', 'عرض المصروفات', 'View Expenses', 'القدرة على عرض المصروفات', 'Ability to view expenses', 'financial', 60),
('expenses.create', 'expenses', 'create', 'إضافة مصروف', 'Create Expense', 'القدرة على إضافة مصروفات جديدة', 'Ability to add new expenses', 'financial', 61),
('expenses.update', 'expenses', 'update', 'تعديل المصروفات', 'Update Expenses', 'القدرة على تعديل المصروفات', 'Ability to update expenses', 'financial', 62),
('expenses.delete', 'expenses', 'delete', 'حذف المصروفات', 'Delete Expenses', 'القدرة على حذف المصروفات', 'Ability to delete expenses', 'financial', 63),
('expenses.approve', 'expenses', 'approve', 'الموافقة على المصروفات', 'Approve Expenses', 'القدرة على الموافقة على المصروفات', 'Ability to approve expenses', 'financial', 64),
('expenses.export', 'expenses', 'export', 'تصدير المصروفات', 'Export Expenses', 'القدرة على تصدير بيانات المصروفات', 'Ability to export expenses data', 'financial', 65)
ON CONFLICT (key) DO NOTHING;

-- Salaries Permissions
INSERT INTO permissions (key, resource, action, name_ar, name_en, description_ar, description_en, category, display_order) VALUES
('salaries.view', 'salaries', 'view', 'عرض الرواتب', 'View Salaries', 'القدرة على عرض الرواتب', 'Ability to view salaries', 'financial', 70),
('salaries.create', 'salaries', 'create', 'إنشاء راتب', 'Create Salary', 'القدرة على إنشاء سجلات رواتب جديدة', 'Ability to create new salary records', 'financial', 71),
('salaries.update', 'salaries', 'update', 'تعديل الرواتب', 'Update Salaries', 'القدرة على تعديل الرواتب', 'Ability to update salaries', 'financial', 72),
('salaries.delete', 'salaries', 'delete', 'حذف الرواتب', 'Delete Salaries', 'القدرة على حذف سجلات الرواتب', 'Ability to delete salary records', 'financial', 73),
('salaries.approve', 'salaries', 'approve', 'الموافقة على الرواتب', 'Approve Salaries', 'القدرة على الموافقة على الرواتب', 'Ability to approve salaries', 'financial', 74),
('salaries.export', 'salaries', 'export', 'تصدير الرواتب', 'Export Salaries', 'القدرة على تصدير بيانات الرواتب', 'Ability to export salaries data', 'financial', 75)
ON CONFLICT (key) DO NOTHING;

-- Technicians Permissions
INSERT INTO permissions (key, resource, action, name_ar, name_en, description_ar, description_en, category, display_order) VALUES
('technicians.view', 'technicians', 'view', 'عرض الفنيين', 'View Technicians', 'القدرة على عرض الفنيين', 'Ability to view technicians', 'operations', 80),
('technicians.create', 'technicians', 'create', 'إضافة فني', 'Create Technician', 'القدرة على إضافة فنيين جدد', 'Ability to add new technicians', 'operations', 81),
('technicians.update', 'technicians', 'update', 'تعديل الفنيين', 'Update Technicians', 'القدرة على تعديل بيانات الفنيين', 'Ability to update technicians data', 'operations', 82),
('technicians.delete', 'technicians', 'delete', 'حذف الفنيين', 'Delete Technicians', 'القدرة على حذف الفنيين', 'Ability to delete technicians', 'operations', 83),
('technicians.view_performance', 'technicians', 'view_performance', 'عرض أداء الفنيين', 'View Technician Performance', 'القدرة على عرض تقارير أداء الفنيين', 'Ability to view technician performance reports', 'operations', 84),
('technicians.manage_assignments', 'technicians', 'manage_assignments', 'إدارة تعيينات الفنيين', 'Manage Technician Assignments', 'القدرة على تعيين الفنيين للمهام', 'Ability to assign technicians to tasks', 'operations', 85)
ON CONFLICT (key) DO NOTHING;

-- Reports Permissions
INSERT INTO permissions (key, resource, action, name_ar, name_en, description_ar, description_en, category, display_order) VALUES
('reports.view', 'reports', 'view', 'عرض التقارير', 'View Reports', 'القدرة على عرض التقارير', 'Ability to view reports', 'reports', 90),
('reports.export', 'reports', 'export', 'تصدير التقارير', 'Export Reports', 'القدرة على تصدير التقارير', 'Ability to export reports', 'reports', 91),
('reports.financial', 'reports', 'financial', 'التقارير المالية', 'Financial Reports', 'القدرة على عرض التقارير المالية', 'Ability to view financial reports', 'reports', 92),
('reports.operations', 'reports', 'operations', 'تقارير العمليات', 'Operations Reports', 'القدرة على عرض تقارير العمليات', 'Ability to view operations reports', 'reports', 93),
('reports.performance', 'reports', 'performance', 'تقارير الأداء', 'Performance Reports', 'القدرة على عرض تقارير الأداء', 'Ability to view performance reports', 'reports', 94)
ON CONFLICT (key) DO NOTHING;

-- Settings Permissions
INSERT INTO permissions (key, resource, action, name_ar, name_en, description_ar, description_en, category, display_order) VALUES
('settings.view', 'settings', 'view', 'عرض الإعدادات', 'View Settings', 'القدرة على عرض إعدادات الورشة', 'Ability to view workshop settings', 'administration', 100),
('settings.update', 'settings', 'update', 'تعديل الإعدادات', 'Update Settings', 'القدرة على تعديل إعدادات الورشة', 'Ability to update workshop settings', 'administration', 101),
('settings.manage_workshop', 'settings', 'manage_workshop', 'إدارة بيانات الورشة', 'Manage Workshop', 'القدرة على إدارة بيانات الورشة الأساسية', 'Ability to manage basic workshop data', 'administration', 102),
('settings.manage_tax', 'settings', 'manage_tax', 'إدارة الضرائب', 'Manage Tax', 'القدرة على إدارة إعدادات الضرائب', 'Ability to manage tax settings', 'administration', 103)
ON CONFLICT (key) DO NOTHING;

-- Users Permissions
INSERT INTO permissions (key, resource, action, name_ar, name_en, description_ar, description_en, category, display_order) VALUES
('users.view', 'users', 'view', 'عرض المستخدمين', 'View Users', 'القدرة على عرض المستخدمين', 'Ability to view users', 'administration', 110),
('users.create', 'users', 'create', 'إضافة مستخدم', 'Create User', 'القدرة على إضافة مستخدمين جدد', 'Ability to create new users', 'administration', 111),
('users.update', 'users', 'update', 'تعديل المستخدمين', 'Update Users', 'القدرة على تعديل بيانات المستخدمين', 'Ability to update user data', 'administration', 112),
('users.delete', 'users', 'delete', 'حذف المستخدمين', 'Delete Users', 'القدرة على حذف المستخدمين', 'Ability to delete users', 'administration', 113),
('users.manage_roles', 'users', 'manage_roles', 'إدارة أدوار المستخدمين', 'Manage User Roles', 'القدرة على تعيين الأدوار للمستخدمين', 'Ability to assign roles to users', 'administration', 114),
('users.manage_permissions', 'users', 'manage_permissions', 'إدارة صلاحيات المستخدمين', 'Manage User Permissions', 'القدرة على إدارة الصلاحيات الاستثنائية', 'Ability to manage permission overrides', 'administration', 115),
('users.change_password', 'users', 'change_password', 'تغيير كلمات المرور', 'Change Passwords', 'القدرة على تغيير كلمات مرور المستخدمين', 'Ability to change user passwords', 'administration', 116)
ON CONFLICT (key) DO NOTHING;

-- Roles Permissions
INSERT INTO permissions (key, resource, action, name_ar, name_en, description_ar, description_en, category, display_order) VALUES
('roles.view', 'roles', 'view', 'عرض الأدوار', 'View Roles', 'القدرة على عرض الأدوار', 'Ability to view roles', 'administration', 120),
('roles.create', 'roles', 'create', 'إنشاء دور', 'Create Role', 'القدرة على إنشاء أدوار جديدة', 'Ability to create new roles', 'administration', 121),
('roles.update', 'roles', 'update', 'تعديل الأدوار', 'Update Roles', 'القدرة على تعديل الأدوار', 'Ability to update roles', 'administration', 122),
('roles.delete', 'roles', 'delete', 'حذف الأدوار', 'Delete Roles', 'القدرة على حذف الأدوار', 'Ability to delete roles', 'administration', 123),
('roles.manage_permissions', 'roles', 'manage_permissions', 'إدارة صلاحيات الأدوار', 'Manage Role Permissions', 'القدرة على تعيين الصلاحيات للأدوار', 'Ability to assign permissions to roles', 'administration', 124)
ON CONFLICT (key) DO NOTHING;

-- Audit Logs Permissions
INSERT INTO permissions (key, resource, action, name_ar, name_en, description_ar, description_en, category, display_order) VALUES
('audit_logs.view', 'audit_logs', 'view', 'عرض سجل التدقيق', 'View Audit Logs', 'القدرة على عرض سجل التدقيق', 'Ability to view audit logs', 'administration', 130)
ON CONFLICT (key) DO NOTHING;
