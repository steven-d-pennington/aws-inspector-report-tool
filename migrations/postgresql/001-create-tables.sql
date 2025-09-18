-- PostgreSQL Schema for Vulnerability Dashboard (SQLite compatibility)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Reports table
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

CREATE INDEX IF NOT EXISTS idx_reports_upload_date ON reports(upload_date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_account ON reports(aws_account_id);

-- Vulnerabilities table
CREATE TABLE IF NOT EXISTS vulnerabilities (
    id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    aws_account_id VARCHAR(32),
    finding_arn TEXT,
    vulnerability_id TEXT,
    title TEXT,
    description TEXT,
    severity VARCHAR(20) CHECK (severity IN ('CRITICAL','HIGH','MEDIUM','LOW','INFORMATIONAL','UNTRIAGED')),
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
    resource_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_vulnerabilities_severity ON vulnerabilities(severity);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_status ON vulnerabilities(status);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_account ON vulnerabilities(aws_account_id);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_last_observed ON vulnerabilities(last_observed_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_cve ON vulnerabilities(cve_id);

-- Resources table
CREATE TABLE IF NOT EXISTS resources (
    id SERIAL PRIMARY KEY,
    vulnerability_id INTEGER NOT NULL REFERENCES vulnerabilities(id) ON DELETE CASCADE,
    resource_id TEXT,
    resource_type TEXT,
    resource_arn TEXT,
    platform TEXT,
    region TEXT,
    details JSONB,
    tags JSONB,
    account_id VARCHAR(32)
);

CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_platform ON resources(platform);
CREATE INDEX IF NOT EXISTS idx_resources_account ON resources(account_id);

-- Packages table
CREATE TABLE IF NOT EXISTS packages (
    id SERIAL PRIMARY KEY,
    vulnerability_id INTEGER NOT NULL REFERENCES vulnerabilities(id) ON DELETE CASCADE,
    name TEXT,
    version TEXT,
    ecosystem TEXT,
    installed_version TEXT,
    fix_available BOOLEAN,
    fix_version TEXT,
    dependency_path TEXT,
    package_manager TEXT,
    file_path TEXT
);

-- References table
CREATE TABLE IF NOT EXISTS "references" (
    id SERIAL PRIMARY KEY,
    vulnerability_id INTEGER NOT NULL REFERENCES vulnerabilities(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    reference_type TEXT,
    source TEXT,
    title TEXT,
    description TEXT
);

CREATE INDEX IF NOT EXISTS idx_references_url ON "references"(url);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT,
    type VARCHAR(20) DEFAULT 'string',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settings_type ON settings(type);

-- Upload events table
CREATE TABLE IF NOT EXISTS upload_events (
    id SERIAL PRIMARY KEY,
    upload_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    report_id INTEGER REFERENCES reports(id) ON DELETE SET NULL,
    filename VARCHAR(255),
    status VARCHAR(32) NOT NULL,
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    records_archived INTEGER,
    records_imported INTEGER,
    error_message TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_upload_events_upload_id ON upload_events(upload_id);
CREATE INDEX IF NOT EXISTS idx_upload_events_started_at ON upload_events(started_at DESC);

-- Vulnerability history tables (placeholders for future implementation)
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
    resolution_type VARCHAR(20) DEFAULT 'FIXED'
);

CREATE TABLE IF NOT EXISTS resource_history (
    id SERIAL PRIMARY KEY,
    original_resource_id INTEGER,
    vulnerability_history_id INTEGER REFERENCES vulnerability_history(id) ON DELETE CASCADE,
    resource_type TEXT,
    resource_identifier TEXT,
    region TEXT,
    archived_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

