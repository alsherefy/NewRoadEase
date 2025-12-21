/*
  # Drop Unused Technician Reports Table

  1. Changes
    - Drop the `technician_reports` table which is not being used in the application
    - This table was created but never implemented in the frontend or backend
    - Removing it simplifies the database schema and reduces maintenance overhead

  2. Notes
    - This is a safe operation as the table is not being used anywhere
    - No data loss concerns as the table is unused
*/

DROP TABLE IF EXISTS technician_reports CASCADE;
