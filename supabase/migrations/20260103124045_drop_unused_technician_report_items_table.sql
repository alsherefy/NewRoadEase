/*
  # Drop unused technician_report_items table

  ## Purpose
  This migration removes the `technician_report_items` table which was created but never used in the application.
  
  ## Changes Made
  1. Drop all RLS policies for technician_report_items table
  2. Drop all indexes for technician_report_items table
  3. Drop the technician_report_items table itself
  
  ## Safety Notes
  - This table was never populated with data
  - No application code references this table
  - This is a safe cleanup operation with no data loss risk
  
  ## Related Migration
  - Originally created in: 20251219191853_add_technician_reports.sql
*/

-- Drop RLS policies first
DROP POLICY IF EXISTS "Technicians and admins can view report items" ON technician_report_items;
DROP POLICY IF EXISTS "Technicians can add items to their reports" ON technician_report_items;
DROP POLICY IF EXISTS "Technicians can delete their report items" ON technician_report_items;

-- Drop indexes
DROP INDEX IF EXISTS idx_technician_report_items_report_id;
DROP INDEX IF EXISTS idx_technician_report_items_invoice_id;

-- Finally, drop the table
DROP TABLE IF EXISTS technician_report_items;