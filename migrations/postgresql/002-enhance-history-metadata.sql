-- Migration: Enhance history tables with report metadata
-- Date: 2025-09-22
-- Purpose: Preserve report context on archived vulnerabilities and resources

ALTER TABLE vulnerability_history
ADD COLUMN IF NOT EXISTS source_report_id INTEGER,
ADD COLUMN IF NOT EXISTS source_report_run_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS source_report_filename VARCHAR(255),
ADD COLUMN IF NOT EXISTS source_report_uploaded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by_upload_id UUID;

ALTER TABLE resource_history
ADD COLUMN IF NOT EXISTS source_report_id INTEGER,
ADD COLUMN IF NOT EXISTS archived_by_upload_id UUID;

CREATE INDEX IF NOT EXISTS idx_vulnerability_history_source_report_id ON vulnerability_history(source_report_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_history_archived_upload ON vulnerability_history(archived_by_upload_id);
CREATE INDEX IF NOT EXISTS idx_resource_history_source_report_id ON resource_history(source_report_id);
CREATE INDEX IF NOT EXISTS idx_resource_history_archived_upload ON resource_history(archived_by_upload_id);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('002-enhance-history-metadata', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
