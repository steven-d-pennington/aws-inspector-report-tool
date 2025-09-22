-- ============================================================================
-- AWS Inspector Vulnerability Dashboard
-- Initial PostgreSQL schema & seed data
--
-- This consolidated script replaces incremental migrations by provisioning the
-- full schema and seeding the configuration settings that drive the admin UI.
-- Only the settings metadata/values are preserved so a fresh install can
-- bootstrap all required application tabs without pulling historical findings.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    upload_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    report_run_date TIMESTAMPTZ,
    file_size BIGINT,
    vulnerability_count INTEGER DEFAULT 0,
    aws_account_id VARCHAR(32),
    status VARCHAR(32) DEFAULT 'PROCESSED',
    error_message TEXT,
    CONSTRAINT reports_filename_not_empty CHECK (length(filename) > 0)
);

CREATE INDEX IF NOT EXISTS idx_reports_upload_date
    ON reports(upload_date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_account
    ON reports(aws_account_id);
CREATE INDEX IF NOT EXISTS idx_reports_account_date
    ON reports(aws_account_id, upload_date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status
    ON reports(status);

-- ---------------------------------------------------------------------------
-- Vulnerabilities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vulnerabilities (
    id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL,
    aws_account_id VARCHAR(32),
    finding_arn TEXT,
    vulnerability_id TEXT,
    title TEXT,
    description TEXT,
    severity VARCHAR(20),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    fix_available VARCHAR(10),
    inspector_score NUMERIC,
    epss_score NUMERIC,
    exploit_available VARCHAR(10),
    first_observed_at TIMESTAMPTZ,
    last_observed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    cvss_score NUMERIC,
    cve_id VARCHAR(50),
    package_name TEXT,
    package_version TEXT,
    fix_version TEXT,
    resource_id TEXT,
    CONSTRAINT vulnerabilities_report_id_fkey
        FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    CONSTRAINT vulnerabilities_severity_check
        CHECK (severity IN ('CRITICAL','HIGH','MEDIUM','LOW','INFORMATIONAL','UNTRIAGED'))
);

CREATE INDEX IF NOT EXISTS idx_vulnerabilities_report_id
    ON vulnerabilities(report_id);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_status
    ON vulnerabilities(status);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_severity
    ON vulnerabilities(severity);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_status_severity
    ON vulnerabilities(status, severity, report_id);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_account
    ON vulnerabilities(aws_account_id);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_account_status
    ON vulnerabilities(aws_account_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_fix_available
    ON vulnerabilities(fix_available);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_last_observed
    ON vulnerabilities(last_observed_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_cve
    ON vulnerabilities(cve_id);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_title_trgm
    ON vulnerabilities USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_description_trgm
    ON vulnerabilities USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_vuln_id_trgm
    ON vulnerabilities USING gin (vulnerability_id gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Resources
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resources (
    id SERIAL PRIMARY KEY,
    vulnerability_id INTEGER NOT NULL,
    resource_id TEXT,
    resource_type TEXT,
    resource_arn TEXT,
    platform TEXT,
    region TEXT,
    details JSONB,
    tags JSONB,
    account_id VARCHAR(32),
    CONSTRAINT resources_vulnerability_id_fkey
        FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_resources_vulnerability_id
    ON resources(vulnerability_id);
CREATE INDEX IF NOT EXISTS idx_resources_type
    ON resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_platform
    ON resources(platform);
CREATE INDEX IF NOT EXISTS idx_resources_account
    ON resources(account_id);
CREATE INDEX IF NOT EXISTS idx_resources_resource_id_trgm
    ON resources USING gin (resource_id gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Packages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS packages (
    id SERIAL PRIMARY KEY,
    vulnerability_id INTEGER NOT NULL,
    name TEXT,
    version TEXT,
    ecosystem TEXT,
    installed_version TEXT,
    fix_available BOOLEAN,
    fix_version TEXT,
    dependency_path TEXT,
    package_manager TEXT,
    file_path TEXT,
    CONSTRAINT packages_vulnerability_id_fkey
        FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_packages_vulnerability_id
    ON packages(vulnerability_id);
CREATE INDEX IF NOT EXISTS idx_packages_name_version
    ON packages(name, version);

-- ---------------------------------------------------------------------------
-- References
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "references" (
    id SERIAL PRIMARY KEY,
    vulnerability_id INTEGER NOT NULL REFERENCES vulnerabilities(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    reference_type TEXT,
    source TEXT,
    title TEXT,
    description TEXT
);

CREATE INDEX IF NOT EXISTS idx_references_vulnerability_id
    ON "references"(vulnerability_id);
CREATE INDEX IF NOT EXISTS idx_references_url
    ON "references"(url);

-- ---------------------------------------------------------------------------
-- Settings (preserved configuration tabs & values)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT,
    type VARCHAR(20) DEFAULT 'string',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settings_type
    ON settings(type);

-- Seed the default settings tabs/values required by the UI
INSERT INTO settings (key, value, type, description) VALUES
    ('app_title', 'AWS Security Dashboard', 'string', 'Application title displayed in the header'),
    ('theme', 'light', 'string', 'Default UI theme'),
    ('export_format', 'pdf', 'string', 'Preferred export format'),
    ('auto_refresh', 'false', 'boolean', 'Automatically refresh dashboard metrics'),
    ('notifications_enabled', 'true', 'boolean', 'Enable system notifications'),
    ('refresh_interval', '300', 'number', 'Dashboard auto-refresh interval in seconds'),
    ('max_concurrent_scans', '5', 'number', 'Maximum concurrent report processing jobs'),
    ('retention_days', '90', 'number', 'Data retention period for reports and findings'),
    (
        'security_settings',
        '{"session_timeout":3600,"password_policy":{"min_length":8,"require_special":true},"mfa_enabled":false}',
        'json',
        'Security configuration for admin features'
    )
ON CONFLICT (key) DO UPDATE
SET
    value = EXCLUDED.value,
    type = EXCLUDED.type,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- ---------------------------------------------------------------------------
-- Upload Events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS upload_events (
    id SERIAL PRIMARY KEY,
    upload_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    report_id INTEGER,
    filename VARCHAR(255),
    status VARCHAR(32) NOT NULL,
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    records_archived INTEGER,
    records_imported INTEGER,
    error_message TEXT,
    CONSTRAINT fk_upload_events_report_id
        FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_upload_events_upload_id
    ON upload_events(upload_id);
CREATE INDEX IF NOT EXISTS idx_upload_events_started_at
    ON upload_events(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_events_status
    ON upload_events(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_events_report_id
    ON upload_events(report_id);

-- ---------------------------------------------------------------------------
-- Vulnerability History
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vulnerability_history (
    id SERIAL PRIMARY KEY,
    original_vulnerability_id INTEGER,
    vulnerability_id TEXT,
    finding_arn TEXT,
    aws_account_id TEXT,
    title TEXT,
    severity VARCHAR(20),
    status VARCHAR(20),
    fix_available VARCHAR(10),
    inspector_score NUMERIC(3,1),
    epss_score NUMERIC(5,4),
    exploit_available VARCHAR(10),
    package_name TEXT,
    package_version TEXT,
    fix_version TEXT,
    first_observed_at TIMESTAMPTZ,
    last_observed_at TIMESTAMPTZ,
    source_report_id INTEGER,
    source_report_run_date TIMESTAMPTZ,
    source_report_filename VARCHAR(255),
    source_report_uploaded_at TIMESTAMPTZ,
    archived_by_upload_id UUID,
    archived_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolution_type VARCHAR(20) DEFAULT 'FIXED',
    CONSTRAINT fk_vulnerability_history_original
        FOREIGN KEY (original_vulnerability_id) REFERENCES vulnerabilities(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_vulnerability_history_original
    ON vulnerability_history(original_vulnerability_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_history_vuln_id
    ON vulnerability_history(vulnerability_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_history_archived
    ON vulnerability_history(archived_date DESC);
CREATE INDEX IF NOT EXISTS idx_vulnerability_history_source_report_id
    ON vulnerability_history(source_report_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_history_archived_upload
    ON vulnerability_history(archived_by_upload_id);

-- ---------------------------------------------------------------------------
-- Resource History
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resource_history (
    id SERIAL PRIMARY KEY,
    original_resource_id INTEGER,
    vulnerability_history_id INTEGER,
    resource_type TEXT,
    resource_identifier TEXT,
    region TEXT,
    source_report_id INTEGER,
    archived_by_upload_id UUID,
    archived_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_resource_history_original
        FOREIGN KEY (original_resource_id) REFERENCES resources(id) ON DELETE SET NULL,
    CONSTRAINT fk_resource_history_vuln_history
        FOREIGN KEY (vulnerability_history_id) REFERENCES vulnerability_history(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_resource_history_original
    ON resource_history(original_resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_history_vuln_history
    ON resource_history(vulnerability_history_id);
CREATE INDEX IF NOT EXISTS idx_resource_history_archived
    ON resource_history(archived_date DESC);
CREATE INDEX IF NOT EXISTS idx_resource_history_source_report_id
    ON resource_history(source_report_id);
CREATE INDEX IF NOT EXISTS idx_resource_history_archived_upload
    ON resource_history(archived_by_upload_id);

-- ============================================================================
-- End of initial seed script
-- ============================================================================
