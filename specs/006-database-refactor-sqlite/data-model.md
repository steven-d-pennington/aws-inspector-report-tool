# Data Model Design: PostgreSQL Migration

**Phase 1 Output**: Complete PostgreSQL schema definitions and data architecture
**Date**: 2025-09-18

## Schema Design Overview

**Migration Type**: Selective PostgreSQL migration with settings preservation
**Source**: SQLite database with 9 tables (8 vulnerability + 1 settings)
**Target**: Optimized PostgreSQL schema with performance enhancements
**Data Policy**: Migrate settings table data, fresh start for vulnerability tables

## 1. Core Table Definitions

### Reports Table
**Purpose**: Track uploaded vulnerability reports and metadata
**Performance**: Indexed for date-based queries and file lookups

```sql
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    file_size BIGINT,
    vulnerabilities_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PROCESSED' CHECK(status IN ('UPLOADING', 'PROCESSING', 'PROCESSED', 'ERROR')),
    error_message TEXT,

    -- Constraints
    CONSTRAINT reports_filename_not_empty CHECK(LENGTH(filename) > 0),
    CONSTRAINT reports_file_size_positive CHECK(file_size IS NULL OR file_size >= 0),
    CONSTRAINT reports_vuln_count_positive CHECK(vulnerabilities_count >= 0)
);

-- Performance indexes
CREATE INDEX idx_reports_upload_date ON reports(upload_date DESC);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_filename ON reports(filename);
```

### Vulnerabilities Table
**Purpose**: Store individual vulnerability findings with enhanced metadata
**Performance**: Optimized for severity filtering and temporal queries

```sql
CREATE TABLE vulnerabilities (
    id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL,
    vulnerability_id VARCHAR(100),
    title TEXT,
    description TEXT,
    severity VARCHAR(20) NOT NULL CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL', 'UNTRIAGED')),
    cvss_score DECIMAL(3,1) CHECK(cvss_score IS NULL OR (cvss_score >= 0.0 AND cvss_score <= 10.0)),
    cve_id VARCHAR(20),
    package_name VARCHAR(255),
    package_version VARCHAR(100),
    fix_available VARCHAR(10) CHECK(fix_available IN ('YES', 'NO') OR fix_available IS NULL),
    fix_version VARCHAR(100),
    resource_id VARCHAR(255),
    first_observed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_observed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'FIXED', 'IGNORED', 'FALSE_POSITIVE')),

    -- Foreign key constraints
    CONSTRAINT fk_vulnerabilities_report_id
        FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,

    -- Data quality constraints
    CONSTRAINT vulnerabilities_title_not_empty CHECK(LENGTH(title) > 0),
    CONSTRAINT vulnerabilities_valid_dates CHECK(last_observed >= first_observed)
);

-- Critical performance indexes
CREATE INDEX idx_vulnerabilities_severity ON vulnerabilities(severity);
CREATE INDEX idx_vulnerabilities_status ON vulnerabilities(status);
CREATE INDEX idx_vulnerabilities_last_observed ON vulnerabilities(last_observed DESC);
CREATE INDEX idx_vulnerabilities_package_name ON vulnerabilities(package_name);
CREATE INDEX idx_vulnerabilities_cve_id ON vulnerabilities(cve_id) WHERE cve_id IS NOT NULL;
CREATE INDEX idx_vulnerabilities_report_id ON vulnerabilities(report_id);

-- Composite indexes for common query patterns
CREATE INDEX idx_vulnerabilities_severity_status ON vulnerabilities(severity, status);
CREATE INDEX idx_vulnerabilities_package_version ON vulnerabilities(package_name, package_version);
```

### Resources Table
**Purpose**: Track AWS resources associated with vulnerabilities
**Performance**: Optimized for resource type and identifier lookups

```sql
CREATE TABLE resources (
    id SERIAL PRIMARY KEY,
    vulnerability_id INTEGER NOT NULL,
    resource_type VARCHAR(50),
    resource_identifier VARCHAR(255),
    region VARCHAR(20),
    account_id VARCHAR(20),
    tags JSONB,
    last_scanned TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraints
    CONSTRAINT fk_resources_vulnerability_id
        FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities(id) ON DELETE CASCADE,

    -- Data quality constraints
    CONSTRAINT resources_type_not_empty CHECK(LENGTH(resource_type) > 0),
    CONSTRAINT resources_identifier_not_empty CHECK(LENGTH(resource_identifier) > 0)
);

-- Performance indexes
CREATE INDEX idx_resources_vulnerability_id ON resources(vulnerability_id);
CREATE INDEX idx_resources_type ON resources(resource_type);
CREATE INDEX idx_resources_identifier ON resources(resource_identifier);
CREATE INDEX idx_resources_region ON resources(region);
CREATE INDEX idx_resources_account_id ON resources(account_id);

-- JSONB index for tag queries
CREATE INDEX idx_resources_tags ON resources USING GIN(tags);
```

### Packages Table
**Purpose**: Detailed package information and vulnerability associations
**Performance**: Optimized for package ecosystem queries

```sql
CREATE TABLE packages (
    id SERIAL PRIMARY KEY,
    vulnerability_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(100),
    ecosystem VARCHAR(50),
    installed_version VARCHAR(100),
    fix_available BOOLEAN,
    fix_version VARCHAR(100),
    dependency_path TEXT,
    package_manager VARCHAR(50),

    -- Foreign key constraints
    CONSTRAINT fk_packages_vulnerability_id
        FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities(id) ON DELETE CASCADE,

    -- Data quality constraints
    CONSTRAINT packages_name_not_empty CHECK(LENGTH(name) > 0)
);

-- Performance indexes
CREATE INDEX idx_packages_vulnerability_id ON packages(vulnerability_id);
CREATE INDEX idx_packages_name ON packages(name);
CREATE INDEX idx_packages_ecosystem ON packages(ecosystem);
CREATE INDEX idx_packages_fix_available ON packages(fix_available);

-- Composite indexes for package management queries
CREATE INDEX idx_packages_name_version ON packages(name, version);
CREATE INDEX idx_packages_ecosystem_name ON packages(ecosystem, name);
```

### References Table
**Purpose**: External reference URLs and advisory information
**Performance**: Optimized for reference type and source queries

```sql
CREATE TABLE references (
    id SERIAL PRIMARY KEY,
    vulnerability_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    reference_type VARCHAR(50),
    source VARCHAR(100),
    title TEXT,
    description TEXT,

    -- Foreign key constraints
    CONSTRAINT fk_references_vulnerability_id
        FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities(id) ON DELETE CASCADE,

    -- Data quality constraints
    CONSTRAINT references_url_not_empty CHECK(LENGTH(url) > 0),
    CONSTRAINT references_valid_url CHECK(url ~* '^https?://')
);

-- Performance indexes
CREATE INDEX idx_references_vulnerability_id ON references(vulnerability_id);
CREATE INDEX idx_references_type ON references(reference_type);
CREATE INDEX idx_references_source ON references(source);
```

### Settings Table
**Purpose**: Application configuration and user preferences (MIGRATED FROM SQLite)
**Performance**: Unique key index for fast configuration lookups

```sql
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT,
    type VARCHAR(20) DEFAULT 'string' CHECK(type IN ('string', 'boolean', 'number', 'json')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Data quality constraints
    CONSTRAINT settings_key_not_empty CHECK(LENGTH(key) > 0),
    CONSTRAINT settings_type_valid CHECK(type IN ('string', 'boolean', 'number', 'json'))
);

-- Performance indexes
CREATE UNIQUE INDEX idx_settings_key ON settings(key);
CREATE INDEX idx_settings_type ON settings(type);
CREATE INDEX idx_settings_updated_at ON settings(updated_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER settings_updated_at_trigger
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_settings_updated_at();
```

## 2. Historical Data Tables

### Vulnerability History Table
**Purpose**: Archive resolved vulnerabilities for trend analysis
**Performance**: Optimized for temporal queries and reporting

```sql
CREATE TABLE vulnerability_history (
    id SERIAL PRIMARY KEY,
    original_vulnerability_id INTEGER,
    vulnerability_id VARCHAR(100),
    title TEXT,
    severity VARCHAR(20) CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL', 'UNTRIAGED')),
    package_name VARCHAR(255),
    package_version VARCHAR(100),
    fix_version VARCHAR(100),
    archived_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolution_type VARCHAR(20) DEFAULT 'FIXED' CHECK(resolution_type IN ('FIXED', 'IGNORED', 'FALSE_POSITIVE', 'EXPIRED')),

    -- Data quality constraints
    CONSTRAINT vulnerability_history_title_not_empty CHECK(LENGTH(title) > 0)
);

-- Performance indexes for historical analysis
CREATE INDEX idx_vulnerability_history_archived_date ON vulnerability_history(archived_date DESC);
CREATE INDEX idx_vulnerability_history_severity ON vulnerability_history(severity);
CREATE INDEX idx_vulnerability_history_package_name ON vulnerability_history(package_name);
CREATE INDEX idx_vulnerability_history_resolution_type ON vulnerability_history(resolution_type);
```

### Resource History Table
**Purpose**: Track resource associations over time
**Performance**: Optimized for resource tracking and audit queries

```sql
CREATE TABLE resource_history (
    id SERIAL PRIMARY KEY,
    original_resource_id INTEGER,
    vulnerability_history_id INTEGER,
    resource_type VARCHAR(50),
    resource_identifier VARCHAR(255),
    region VARCHAR(20),
    archived_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraints
    CONSTRAINT fk_resource_history_vulnerability_history_id
        FOREIGN KEY (vulnerability_history_id) REFERENCES vulnerability_history(id) ON DELETE CASCADE
);

-- Performance indexes
CREATE INDEX idx_resource_history_vulnerability_history_id ON resource_history(vulnerability_history_id);
CREATE INDEX idx_resource_history_archived_date ON resource_history(archived_date DESC);
CREATE INDEX idx_resource_history_resource_type ON resource_history(resource_type);
```

### Upload Events Table
**Purpose**: Track upload workflow and processing events
**Performance**: Optimized for event chronology and debugging

```sql
CREATE TABLE upload_events (
    id SERIAL PRIMARY KEY,
    report_id INTEGER,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processing_duration_ms INTEGER,
    error_message TEXT,

    -- Foreign key constraints (optional - allows orphaned events for debugging)
    CONSTRAINT fk_upload_events_report_id
        FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE SET NULL,

    -- Data quality constraints
    CONSTRAINT upload_events_type_not_empty CHECK(LENGTH(event_type) > 0),
    CONSTRAINT upload_events_duration_positive CHECK(processing_duration_ms IS NULL OR processing_duration_ms >= 0)
);

-- Performance indexes
CREATE INDEX idx_upload_events_report_id ON upload_events(report_id);
CREATE INDEX idx_upload_events_timestamp ON upload_events(timestamp DESC);
CREATE INDEX idx_upload_events_type ON upload_events(event_type);

-- JSONB index for event data queries
CREATE INDEX idx_upload_events_data ON upload_events USING GIN(event_data);
```

## 3. Data Type Optimizations

### PostgreSQL-Specific Enhancements

**JSONB Usage**:
- `resources.tags`: Flexible tag storage with GIN indexing
- `upload_events.event_data`: Structured event metadata

**Timestamp with Time Zone**:
- All date/time fields use `TIMESTAMP WITH TIME ZONE`
- Ensures proper timezone handling across deployments

**DECIMAL for Precision**:
- `vulnerabilities.cvss_score`: Precise scoring with range validation

**CHECK Constraints**:
- Comprehensive data validation at database level
- Enum-like constraints for controlled vocabularies

### Performance Optimizations

**Serial Primary Keys**:
- Efficient auto-incrementing integers
- Better performance than UUIDs for this use case

**Selective Indexing**:
- Indexes only on frequently queried columns
- Composite indexes for common query patterns
- Partial indexes with WHERE clauses for sparse data

**JSONB Indexing**:
- GIN indexes for JSON field queries
- Supports complex tag and metadata searches

## 4. Constraint and Validation Strategy

### Foreign Key Constraints
**Cascade Behavior**:
- `ON DELETE CASCADE`: Child records deleted when parent removed
- `ON DELETE SET NULL`: Maintain history records with null references

### Check Constraints
**Data Quality**:
- Non-empty string validation
- Numeric range validation (CVSS scores, file sizes)
- Date logic validation (last_observed >= first_observed)
- URL format validation for references

### Unique Constraints
**Business Logic**:
- No duplicate vulnerabilities per report (composite unique indexes where needed)
- Prevent duplicate references per vulnerability

## 5. Settings Data Migration Strategy

### Migration Requirements
**Source Data**: 9 configuration records from SQLite settings table
**Target**: PostgreSQL settings table with enhanced schema
**Migration Type**: Direct data transfer with type preservation

### Current Settings Data (from SQLite)
```sql
-- Data to be migrated:
-- app_title: "AWS Security Dashboard" (string)
-- theme: "light" (string)
-- auto_refresh: "false" (boolean)
-- refresh_interval: "300" (number)
-- notifications_enabled: "true" (boolean)
-- export_format: "pdf" (string)
-- max_concurrent_scans: "5" (number)
-- retention_days: "90" (number)
-- security_settings: JSON object (json)
```

### Migration Script
```sql
-- Settings data migration from SQLite to PostgreSQL
INSERT INTO settings (key, value, type, description) VALUES
('app_title', 'AWS Security Dashboard', 'string', 'Application title'),
('theme', 'light', 'string', 'UI theme'),
('auto_refresh', 'false', 'boolean', 'Auto-refresh dashboard'),
('refresh_interval', '300', 'number', 'Refresh interval in seconds'),
('notifications_enabled', 'true', 'boolean', 'Enable notifications'),
('export_format', 'pdf', 'string', 'Default export format'),
('max_concurrent_scans', '5', 'number', 'Maximum concurrent scans'),
('retention_days', '90', 'number', 'Data retention period in days'),
('security_settings', '{"session_timeout":3600,"password_policy":{"min_length":8,"require_special":true},"mfa_enabled":false}', 'json', 'Security configuration');
```

### Migration Validation
```sql
-- Verify migration success
SELECT
    COUNT(*) as total_settings,
    COUNT(CASE WHEN type = 'string' THEN 1 END) as string_settings,
    COUNT(CASE WHEN type = 'boolean' THEN 1 END) as boolean_settings,
    COUNT(CASE WHEN type = 'number' THEN 1 END) as number_settings,
    COUNT(CASE WHEN type = 'json' THEN 1 END) as json_settings
FROM settings;

-- Expected: 9 total (4 string, 2 boolean, 2 number, 1 json)
```

## 6. Migration Schema Script

### Complete Schema Creation
```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schema in dependency order
\i create_reports_table.sql
\i create_vulnerabilities_table.sql
\i create_resources_table.sql
\i create_packages_table.sql
\i create_references_table.sql
\i create_settings_table.sql
\i create_vulnerability_history_table.sql
\i create_resource_history_table.sql
\i create_upload_events_table.sql

-- Migrate settings data
\i migrate_settings_data.sql

-- Create additional indexes for performance
\i create_performance_indexes.sql

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO report_gen;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO report_gen;
```

## 7. Performance Characteristics

### Expected Query Performance
**Typical Operations** (target <2 seconds):
- Vulnerability listing with filters (severity, package)
- Report upload and processing
- Dashboard statistics and counts
- Historical trend queries

**Large Dataset Operations** (target 50% improvement over SQLite):
- Bulk vulnerability insertion (>1000 records)
- Complex filtering across multiple tables
- Aggregate queries for reporting

### Concurrent Access Support
**Connection Pool**: 20 connections
**Target Users**: 10+ concurrent users
**Isolation Level**: READ COMMITTED (PostgreSQL default)

## 7. Data Architecture Decisions

### Clean Slate Benefits
**No Legacy Issues**:
- Fresh schema with optimized structure
- No data migration complexity
- Immediate performance benefits

### Extensibility Design
**Future Enhancements**:
- JSONB fields for flexible metadata
- Partial indexes for performance tuning
- Foreign key structure supports additional tables

### Maintenance Considerations
**Index Management**:
- Regular ANALYZE for query planner optimization
- Monitor index usage and add/remove as needed
- Vacuum strategy for optimal performance

## 8. Validation Requirements

### Schema Validation
- All tables created successfully
- Foreign key constraints properly established
- Check constraints enforce data quality
- Indexes created and functioning

### Performance Validation
- Connection pool initialization
- Basic CRUD operations functional
- Query performance meets targets
- Concurrent access handling

### Data Integrity Validation
- Constraint enforcement working
- Cascade behavior correct
- Transaction handling proper
- Error handling comprehensive

**Phase 1 Data Model Design Complete** ✅