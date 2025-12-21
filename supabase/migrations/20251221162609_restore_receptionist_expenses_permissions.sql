/*
  # إرجاع صلاحيات المصروفات لموظف الاستقبال
  
  1. التغييرات
    - منح موظف الاستقبال (receptionist) صلاحيات كاملة على المصروفات
    - إضافة receptionist إلى سياسات الإضافة، التعديل، والحذف للمصروفات
    - إضافة receptionist إلى سياسات تحديث أقساط المصروفات
  
  2. الصلاحيات الممنوحة
    - Admin, customer_service, receptionist: عرض المصروفات
    - Admin, receptionist: إضافة، تعديل، وحذف المصروفات
    - Admin, receptionist: تحديث أقساط المصروفات
  
  3. الأمان
    - جميع السياسات تتحقق من organization_id لعزل البيانات بشكل صحيح
    - موظف خدمة العملاء (customer_service) يبقى بصلاحية القراءة فقط
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admin can create expenses" ON expenses;
DROP POLICY IF EXISTS "Admin can update expenses" ON expenses;
DROP POLICY IF EXISTS "Admin can delete expenses" ON expenses;
DROP POLICY IF EXISTS "Admin can update expense installments" ON expense_installments;

-- Create new policies that include receptionist
CREATE POLICY "Admin and receptionist can create expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'receptionist')
    )
  );

CREATE POLICY "Admin and receptionist can update expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'receptionist')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'receptionist')
    )
  );

CREATE POLICY "Admin and receptionist can delete expenses"
  ON expenses FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'receptionist')
    )
  );

CREATE POLICY "Admin and receptionist can update expense installments"
  ON expense_installments FOR UPDATE
  TO authenticated
  USING (
    expense_id IN (
      SELECT id FROM expenses WHERE organization_id IN (
        SELECT organization_id FROM users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'receptionist')
      )
    )
  )
  WITH CHECK (
    expense_id IN (
      SELECT id FROM expenses WHERE organization_id IN (
        SELECT organization_id FROM users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'receptionist')
      )
    )
  );
