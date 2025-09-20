-- ============================================================================
-- AWS Inspector Vulnerability Dashboard
-- PostgreSQL Schema Initialization for Docker
-- ============================================================================

-- Copy the existing migration schema for Docker initialization
-- This file is executed when the PostgreSQL container is first created

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
-- Settings
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
    title TEXT,
    severity VARCHAR(20),
    package_name TEXT,
    package_version TEXT,
    fix_version TEXT,
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

-- Grant permissions to application user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO appuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO appuser;