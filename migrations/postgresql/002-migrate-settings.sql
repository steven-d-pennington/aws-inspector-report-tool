-- Settings Data Migration from SQLite to PostgreSQL
-- Generated on: 2025-09-18T18:31:21.604Z
-- Records to migrate: 9

-- Clear existing settings (if any)
DELETE FROM settings;

-- Reset sequence
ALTER SEQUENCE settings_id_seq RESTART WITH 1;

-- Insert migrated settings data
INSERT INTO settings (key, value, type, description, created_at, updated_at) VALUES
    ('app_title', 'AWS Security Dashboard', 'string', 'Application title', '2025-09-17 14:47:19', '2025-09-17 14:47:19');
INSERT INTO settings (key, value, type, description, created_at, updated_at) VALUES
    ('theme', 'light', 'string', 'UI theme', '2025-09-17 14:47:19', '2025-09-17 14:47:19');
INSERT INTO settings (key, value, type, description, created_at, updated_at) VALUES
    ('auto_refresh', 'false', 'boolean', 'Auto-refresh dashboard', '2025-09-17 14:47:19', '2025-09-17 14:47:19');
INSERT INTO settings (key, value, type, description, created_at, updated_at) VALUES
    ('refresh_interval', '300', 'number', 'Refresh interval in seconds', '2025-09-17 14:47:19', '2025-09-17 14:47:19');
INSERT INTO settings (key, value, type, description, created_at, updated_at) VALUES
    ('notifications_enabled', 'true', 'boolean', NULL, '2025-09-17 14:47:19', '2025-09-17 14:47:19');
INSERT INTO settings (key, value, type, description, created_at, updated_at) VALUES
    ('export_format', 'pdf', 'string', NULL, '2025-09-17 14:47:19', '2025-09-17 14:47:19');
INSERT INTO settings (key, value, type, description, created_at, updated_at) VALUES
    ('max_concurrent_scans', '5', 'number', NULL, '2025-09-17 14:47:19', '2025-09-17 14:47:19');
INSERT INTO settings (key, value, type, description, created_at, updated_at) VALUES
    ('retention_days', '90', 'number', NULL, '2025-09-17 14:47:19', '2025-09-17 14:47:19');
INSERT INTO settings (key, value, type, description, created_at, updated_at) VALUES
    ('security_settings', '{"session_timeout":3600,"password_policy":{"min_length":8,"require_special":true},"mfa_enabled":false}', 'json', NULL, '2025-09-17 14:47:19', '2025-09-17 14:47:19');

-- Validation: Verify migration success
SELECT
    COUNT(*) as total_settings,
    COUNT(CASE WHEN type = 'string' THEN 1 END) as string_settings,
    COUNT(CASE WHEN type = 'boolean' THEN 1 END) as boolean_settings,
    COUNT(CASE WHEN type = 'number' THEN 1 END) as number_settings,
    COUNT(CASE WHEN type = 'json' THEN 1 END) as json_settings
FROM settings;

-- Expected results: 9 total settings
-- Types breakdown:
--   String: 3
--   Boolean: 2
--   Number: 3
--   JSON: 1

-- Display all migrated settings
SELECT key, value, type, description FROM settings ORDER BY key;
