/*
  # إصلاح نهائي - إضافة UPDATE و DELETE policies لجدول الفواتير
  # Final Fix - Add UPDATE and DELETE policies for invoices table

  ## المشكلة | Problem
  - جدول invoices يحتوي فقط على SELECT و INSERT policies
  - لا توجد UPDATE policy → لذلك التحديث يفشل دائماً
  - لا توجد DELETE policy → الحذف محظور
  - هذا يسبب خطأ "البيانات المطلوبة غير موجودة"
  
  The invoices table only has SELECT and INSERT policies
  - No UPDATE policy → updates always fail
  - No DELETE policy → deletion blocked
  - This causes "Requested data not found" error

  ## الحل | Solution
  إضافة policies للتحديث والحذف مع نفس شروط الأمان
  Add UPDATE and DELETE policies with same security conditions

  ## الأمان | Security
  - المستخدمون يمكنهم فقط تحديث فواتير مؤسستهم
  - Users can only update invoices from their organization
  - organization_id محمي في RLS
  - organization_id protected by RLS
*/

-- إضافة UPDATE policy لجدول invoices
-- Add UPDATE policy for invoices table
CREATE POLICY "Users can update own organization invoices"
  ON invoices
  FOR UPDATE
  TO authenticated
  USING (organization_id = current_user_organization_id())
  WITH CHECK (organization_id = current_user_organization_id());

-- إضافة DELETE policy لجدول invoices
-- Add DELETE policy for invoices table
CREATE POLICY "Users can delete own organization invoices"
  ON invoices
  FOR DELETE
  TO authenticated
  USING (organization_id = current_user_organization_id());

-- إضافة UPDATE policy لجدول invoice_items
-- Add UPDATE policy for invoice_items table
CREATE POLICY "Users can update own organization invoice items"
  ON invoice_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.organization_id = current_user_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.organization_id = current_user_organization_id()
    )
  );

-- إضافة DELETE policy لجدول invoice_items
-- Add DELETE policy for invoice_items table
CREATE POLICY "Users can delete own organization invoice items"
  ON invoice_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.organization_id = current_user_organization_id()
    )
  );
