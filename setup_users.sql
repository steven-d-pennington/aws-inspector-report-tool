-- User Management Script for vulnerability_reports database
-- Execute this after connecting to the vulnerability_reports database

-- Create application user with limited permissions
CREATE USER app_user WITH PASSWORD 'SecureAppPassword123!';

-- Create read-only user for reporting
CREATE USER report_reader WITH PASSWORD 'ReadOnlyPassword123!';

-- Create backup user
CREATE USER backup_user WITH PASSWORD 'BackupPassword123!';

-- Grant appropriate permissions
-- Application user - read/write access to tables
GRANT CONNECT ON DATABASE vulnerability_reports TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT SELECT, USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Report reader - read-only access
GRANT CONNECT ON DATABASE vulnerability_reports TO report_reader;
GRANT USAGE ON SCHEMA public TO report_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO report_reader;

-- Backup user - full access for backup operations
GRANT CONNECT ON DATABASE vulnerability_reports TO backup_user;
GRANT USAGE ON SCHEMA public TO backup_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO report_reader;