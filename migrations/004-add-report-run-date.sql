-- Database Migration: Add Report Run Date Tracking
-- Version: 004-add-report-run-date
-- Feature: Inspector Report Generation Date Tracking
-- Description: Add report_run_date fields to reports and vulnerability_history tables
-- Backward Compatible: YES (additive changes only)

-- ============================================================================
-- REPORTS TABLE MODIFICATION
-- ============================================================================

-- Add report_run_date column to reports table
-- This field stores when the AWS Inspector report was actually generated
-- (separate from upload_date which tracks when it was uploaded to our system)
ALTER TABLE reports ADD COLUMN report_run_date DATETIME;

-- ============================================================================
-- VULNERABILITY HISTORY TABLE MODIFICATION
-- ============================================================================

-- Add report_run_date column to vulnerability_history table
-- This preserves the report generation date context when vulnerabilities are archived
ALTER TABLE vulnerability_history ADD COLUMN report_run_date DATETIME;

-- ============================================================================
-- INDEXES FOR PERFORMANCE (Optional)
-- ============================================================================

-- Index for date-range filtering and timeline queries on reports
CREATE INDEX IF NOT EXISTS idx_reports_run_date ON reports(report_run_date);

-- Composite index for timeline views (report_run_date, upload_date)
CREATE INDEX IF NOT EXISTS idx_reports_timeline ON reports(report_run_date, upload_date);

-- Index for history archiving queries
CREATE INDEX IF NOT EXISTS idx_vuln_history_run_date ON vulnerability_history(report_run_date);

-- ============================================================================
-- VALIDATION QUERIES
-- ============================================================================

-- Verify reports table has new column
PRAGMA table_info(reports);

-- Verify vulnerability_history table has new column
PRAGMA table_info(vulnerability_history);

-- Verify indexes were created
SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_reports_%' OR name LIKE 'idx_vuln_history_%';

-- ============================================================================
-- SAMPLE QUERIES FOR TESTING
-- ============================================================================

-- Test query: Get reports with both dates
/*
SELECT id, filename, upload_date, report_run_date,
       CASE
           WHEN report_run_date IS NULL THEN 'Legacy Report'
           ELSE 'Date Tracked'
       END as tracking_status
FROM reports
ORDER BY upload_date DESC
LIMIT 5;
*/

-- Test query: Timeline view with both dates
/*
SELECT filename,
       report_run_date as generated_on,
       upload_date as uploaded_on,
       (julianday(upload_date) - julianday(report_run_date)) as days_delay
FROM reports
WHERE report_run_date IS NOT NULL
ORDER BY report_run_date DESC;
*/

-- ============================================================================
-- ROLLBACK SCRIPT (Emergency use only)
-- ============================================================================

-- CAUTION: Only run if migration needs to be rolled back
-- This will permanently delete the report_run_date data!

/*
-- Drop indexes first
DROP INDEX IF EXISTS idx_vuln_history_run_date;
DROP INDEX IF EXISTS idx_reports_timeline;
DROP INDEX IF EXISTS idx_reports_run_date;

-- Note: SQLite doesn't support DROP COLUMN in older versions
-- If rollback is needed, backup data and recreate tables without the column
*/

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. Existing reports will have NULL report_run_date (backward compatible)
-- 2. New uploads will require report_run_date (enforced at application level)
-- 3. Indexes improve performance for date-based queries and timeline views
-- 4. Migration is safe and reversible (though rollback requires table recreation)
-- 5. No data loss - existing functionality remains unchanged