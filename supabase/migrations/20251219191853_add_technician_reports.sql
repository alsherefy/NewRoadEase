/*
  # Add Technician Reports System

  1. New Tables
    - `technician_reports`
      - `id` (uuid, primary key)
      - `technician_id` (uuid, foreign key to technicians)
      - `start_date` (date, nullable)
      - `end_date` (date, nullable)
      - `total_invoices` (integer)
      - `total_paid_amount` (numeric)
      - `jobs_completed` (integer)
      - `created_at` (timestamptz)
      - `created_by` (uuid, foreign key to auth.users)

    - `technician_report_items`
      - `id` (uuid, primary key)
      - `report_id` (uuid, foreign key to technician_reports)
      - `invoice_id` (uuid, foreign key to invoices)
      - `invoice_number` (text)
      - `work_order_number` (text)
      - `invoice_amount` (numeric)
      - `completed_date` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage reports
*/

-- Create technician_reports table
CREATE TABLE IF NOT EXISTS technician_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid REFERENCES technicians(id) ON DELETE CASCADE NOT NULL,
  start_date date,
  end_date date,
  total_invoices integer DEFAULT 0,
  total_paid_amount numeric(10,2) DEFAULT 0,
  jobs_completed integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create technician_report_items table
CREATE TABLE IF NOT EXISTS technician_report_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES technician_reports(id) ON DELETE CASCADE NOT NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  invoice_number text NOT NULL,
  work_order_number text NOT NULL,
  invoice_amount numeric(10,2) DEFAULT 0,
  completed_date timestamptz
);

-- Enable RLS
ALTER TABLE technician_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE technician_report_items ENABLE ROW LEVEL SECURITY;

-- Policies for technician_reports
CREATE POLICY "Users can view technician reports"
  ON technician_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create technician reports"
  ON technician_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own technician reports"
  ON technician_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own technician reports"
  ON technician_reports FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Policies for technician_report_items
CREATE POLICY "Users can view technician report items"
  ON technician_report_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create technician report items"
  ON technician_report_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM technician_reports
      WHERE id = report_id
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete technician report items"
  ON technician_report_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM technician_reports
      WHERE id = report_id
      AND created_by = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_technician_reports_technician_id ON technician_reports(technician_id);
CREATE INDEX IF NOT EXISTS idx_technician_reports_created_at ON technician_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_technician_report_items_report_id ON technician_report_items(report_id);
CREATE INDEX IF NOT EXISTS idx_technician_report_items_invoice_id ON technician_report_items(invoice_id);