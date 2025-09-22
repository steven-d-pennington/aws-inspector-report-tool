-- Migration: Add missing columns to vulnerability_history table
-- Date: 2025-09-22
-- Purpose: Fix column reference errors in fixed vulnerabilities query

-- Add missing columns to vulnerability_history table
ALTER TABLE vulnerability_history
ADD COLUMN IF NOT EXISTS finding_arn TEXT,
ADD COLUMN IF NOT EXISTS aws_account_id TEXT,
ADD COLUMN IF NOT EXISTS status VARCHAR(20),
ADD COLUMN IF NOT EXISTS fix_available VARCHAR(10),
ADD COLUMN IF NOT EXISTS inspector_score NUMERIC(3,1),
ADD COLUMN IF NOT EXISTS epss_score NUMERIC(5,4),
ADD COLUMN IF NOT EXISTS exploit_available VARCHAR(10),
ADD COLUMN IF NOT EXISTS first_observed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_observed_at TIMESTAMPTZ;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vulnerability_history_finding_arn ON vulnerability_history(finding_arn);
CREATE INDEX IF NOT EXISTS idx_vulnerability_history_aws_account ON vulnerability_history(aws_account_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_history_severity ON vulnerability_history(severity);
CREATE INDEX IF NOT EXISTS idx_vulnerability_history_archived_date ON vulnerability_history(archived_date);

-- Update migration tracking
INSERT INTO schema_migrations (version, applied_at)
VALUES ('001-add-missing-columns', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;