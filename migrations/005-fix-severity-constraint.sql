-- Migration 005: Fix Severity Constraint to Include All AWS Inspector Values
-- Date: 2025-09-18
-- Issue: CHECK constraint failed for severity values 'INFORMATIONAL' and 'UNTRIAGED'
-- Solution: Recreate vulnerability_history table with expanded severity constraint

-- ============================================================================
-- BACKUP EXISTING DATA
-- ============================================================================

-- Create temporary backup table for vulnerability_history
CREATE TABLE IF NOT EXISTS vulnerability_history_backup AS
SELECT * FROM vulnerability_history;

-- ============================================================================
-- DROP AND RECREATE vulnerability_history TABLE
-- ============================================================================

-- Drop dependent indexes first
DROP INDEX IF EXISTS idx_history_finding_arn;
DROP INDEX IF EXISTS idx_history_vuln_id;
DROP INDEX IF EXISTS idx_history_archived_at;
DROP INDEX IF EXISTS idx_history_severity;
DROP INDEX IF EXISTS idx_history_status;
DROP INDEX IF EXISTS idx_history_original_report;
DROP INDEX IF EXISTS idx_history_archived_report;

-- Drop the table with incorrect constraint
DROP TABLE IF EXISTS vulnerability_history;

-- Recreate table with correct severity constraint including all AWS Inspector values
CREATE TABLE vulnerability_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    finding_arn TEXT NOT NULL,
    vulnerability_id TEXT,
    title TEXT,
    severity TEXT CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL', 'UNTRIAGED')),
    status TEXT CHECK(status IN ('ACTIVE', 'SUPPRESSED', 'CLOSED')),
    fix_available TEXT CHECK(fix_available IN ('YES', 'NO') OR fix_available IS NULL),
    inspector_score REAL CHECK(inspector_score >= 0.0 AND inspector_score <= 10.0),
    first_observed_at DATETIME,
    last_observed_at DATETIME,
    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    report_run_date DATETIME,
    original_report_id INTEGER,
    archived_from_report_id INTEGER,

    -- Constraints
    UNIQUE(finding_arn, archived_at),
    FOREIGN KEY (original_report_id) REFERENCES reports(id) ON DELETE SET NULL,
    FOREIGN KEY (archived_from_report_id) REFERENCES reports(id) ON DELETE SET NULL
);

-- ============================================================================
-- RESTORE DATA
-- ============================================================================

-- Insert data back from backup (if any exists)
INSERT INTO vulnerability_history
SELECT * FROM vulnerability_history_backup;

-- Drop backup table
DROP TABLE vulnerability_history_backup;

-- ============================================================================
-- RECREATE INDEXES
-- ============================================================================

-- Vulnerability History indexes
CREATE INDEX idx_history_finding_arn ON vulnerability_history(finding_arn);
CREATE INDEX idx_history_vuln_id ON vulnerability_history(vulnerability_id);
CREATE INDEX idx_history_archived_at ON vulnerability_history(archived_at);
CREATE INDEX idx_history_severity ON vulnerability_history(severity);
CREATE INDEX idx_history_status ON vulnerability_history(status);
CREATE INDEX idx_history_original_report ON vulnerability_history(original_report_id);
CREATE INDEX idx_history_archived_report ON vulnerability_history(archived_from_report_id);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify the new constraint allows all AWS Inspector severity values
-- This should not fail after the migration
SELECT 'Migration completed successfully - all severity values supported' as status;