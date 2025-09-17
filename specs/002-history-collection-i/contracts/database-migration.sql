-- Database Migration Contract: Vulnerability History Tracking
-- Version: 1.2.0
-- Description: Add history tracking tables and upload event logging
-- Backward Compatible: YES (additive changes only)

-- Migration Script: Creates new tables for vulnerability history tracking
-- This script can be run safely on existing databases

-- ============================================================================
-- VULNERABILITY HISTORY TABLE
-- ============================================================================

-- Create vulnerability_history table to store archived vulnerability data
CREATE TABLE IF NOT EXISTS vulnerability_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    finding_arn TEXT NOT NULL,
    vulnerability_id TEXT,
    title TEXT,
    severity TEXT CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    status TEXT CHECK(status IN ('ACTIVE', 'SUPPRESSED', 'CLOSED')),
    fix_available TEXT CHECK(fix_available IN ('YES', 'NO')),
    inspector_score REAL CHECK(inspector_score >= 0.0 AND inspector_score <= 10.0),
    first_observed_at DATETIME,
    last_observed_at DATETIME,
    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    original_report_id INTEGER,
    archived_from_report_id INTEGER,

    -- Constraints
    UNIQUE(finding_arn, archived_at),
    FOREIGN KEY (original_report_id) REFERENCES reports(id) ON DELETE SET NULL,
    FOREIGN KEY (archived_from_report_id) REFERENCES reports(id) ON DELETE SET NULL
);

-- ============================================================================
-- RESOURCE HISTORY TABLE
-- ============================================================================

-- Create resource_history table to store archived resource associations
CREATE TABLE IF NOT EXISTS resource_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    history_id INTEGER NOT NULL,
    resource_id TEXT,
    resource_type TEXT,
    platform TEXT,
    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    FOREIGN KEY (history_id) REFERENCES vulnerability_history(id) ON DELETE CASCADE
);

-- ============================================================================
-- UPLOAD EVENTS TABLE
-- ============================================================================

-- Create upload_events table to track upload workflow state
CREATE TABLE IF NOT EXISTS upload_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id TEXT UNIQUE NOT NULL,
    filename TEXT,
    status TEXT CHECK(status IN ('STARTED', 'ARCHIVING', 'CLEARING', 'IMPORTING', 'COMPLETED', 'FAILED')) DEFAULT 'STARTED',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    error_message TEXT,
    records_archived INTEGER DEFAULT 0,
    records_imported INTEGER DEFAULT 0
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Vulnerability History indexes
CREATE INDEX IF NOT EXISTS idx_history_finding_arn ON vulnerability_history(finding_arn);
CREATE INDEX IF NOT EXISTS idx_history_vuln_id ON vulnerability_history(vulnerability_id);
CREATE INDEX IF NOT EXISTS idx_history_archived_at ON vulnerability_history(archived_at);
CREATE INDEX IF NOT EXISTS idx_history_severity ON vulnerability_history(severity);
CREATE INDEX IF NOT EXISTS idx_history_status ON vulnerability_history(status);
CREATE INDEX IF NOT EXISTS idx_history_original_report ON vulnerability_history(original_report_id);
CREATE INDEX IF NOT EXISTS idx_history_archived_report ON vulnerability_history(archived_from_report_id);

-- Resource History indexes
CREATE INDEX IF NOT EXISTS idx_resource_history_id ON resource_history(history_id);
CREATE INDEX IF NOT EXISTS idx_resource_history_resource_id ON resource_history(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_history_type ON resource_history(resource_type);

-- Upload Events indexes
CREATE INDEX IF NOT EXISTS idx_upload_events_upload_id ON upload_events(upload_id);
CREATE INDEX IF NOT EXISTS idx_upload_events_status ON upload_events(status);
CREATE INDEX IF NOT EXISTS idx_upload_events_started_at ON upload_events(started_at);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify tables were created successfully
SELECT name FROM sqlite_master WHERE type='table' AND name IN (
    'vulnerability_history',
    'resource_history',
    'upload_events'
);

-- Verify indexes were created successfully
SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_history_%'
    OR name LIKE 'idx_resource_history_%'
    OR name LIKE 'idx_upload_events_%';

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================

-- CAUTION: Only run if you need to completely remove history tracking
-- This will permanently delete all historical data!

/*
-- Drop indexes first
DROP INDEX IF EXISTS idx_upload_events_started_at;
DROP INDEX IF EXISTS idx_upload_events_status;
DROP INDEX IF EXISTS idx_upload_events_upload_id;
DROP INDEX IF EXISTS idx_resource_history_type;
DROP INDEX IF EXISTS idx_resource_history_resource_id;
DROP INDEX IF EXISTS idx_resource_history_id;
DROP INDEX IF EXISTS idx_history_archived_report;
DROP INDEX IF EXISTS idx_history_original_report;
DROP INDEX IF EXISTS idx_history_status;
DROP INDEX IF EXISTS idx_history_severity;
DROP INDEX IF EXISTS idx_history_archived_at;
DROP INDEX IF EXISTS idx_history_vuln_id;
DROP INDEX IF EXISTS idx_history_finding_arn;

-- Drop tables (order matters due to foreign keys)
DROP TABLE IF EXISTS resource_history;
DROP TABLE IF EXISTS upload_events;
DROP TABLE IF EXISTS vulnerability_history;
*/

-- ============================================================================
-- SAMPLE QUERIES FOR VALIDATION
-- ============================================================================

-- Query to find all fixed vulnerabilities (should return empty initially)
/*
SELECT h.finding_arn, h.vulnerability_id, h.title, h.severity, h.archived_at as fixed_date
FROM vulnerability_history h
WHERE NOT EXISTS (
    SELECT 1 FROM vulnerabilities v
    WHERE v.finding_arn = h.finding_arn
)
ORDER BY h.archived_at DESC;
*/

-- Query to get upload event history
/*
SELECT upload_id, filename, status, started_at, completed_at,
       records_archived, records_imported
FROM upload_events
ORDER BY started_at DESC;
*/

-- Query to get vulnerability timeline for a specific finding
/*
SELECT vulnerability_id, title, severity, status,
       first_observed_at, last_observed_at, archived_at
FROM vulnerability_history
WHERE finding_arn = 'arn:aws:inspector2:...'
ORDER BY archived_at DESC;
*/