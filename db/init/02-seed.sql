-- ============================================================================
-- AWS Inspector Vulnerability Dashboard
-- Development Seed Data for Docker
-- ============================================================================

-- Seed the default settings required by the UI
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

-- Development-only: Add sample report for testing
DO $$
BEGIN
    -- Only insert sample data if no reports exist
    IF NOT EXISTS (SELECT 1 FROM reports LIMIT 1) THEN
        -- Insert sample report
        INSERT INTO reports (
            filename,
            report_run_date,
            file_size,
            vulnerability_count,
            aws_account_id,
            status
        ) VALUES (
            'sample-inspector-report.json',
            CURRENT_TIMESTAMP - INTERVAL '1 day',
            102400,
            3,
            '123456789012',
            'PROCESSED'
        );

        -- Insert sample vulnerabilities
        INSERT INTO vulnerabilities (
            report_id,
            aws_account_id,
            vulnerability_id,
            title,
            description,
            severity,
            status,
            fix_available,
            inspector_score,
            first_observed_at,
            last_observed_at,
            cve_id,
            package_name,
            package_version,
            fix_version
        ) VALUES
        (
            1,
            '123456789012',
            'CVE-2023-0001',
            'Sample Critical Vulnerability',
            'This is a sample critical vulnerability for testing purposes',
            'CRITICAL',
            'ACTIVE',
            'YES',
            9.8,
            CURRENT_TIMESTAMP - INTERVAL '7 days',
            CURRENT_TIMESTAMP - INTERVAL '1 hour',
            'CVE-2023-0001',
            'sample-package',
            '1.0.0',
            '1.0.1'
        ),
        (
            1,
            '123456789012',
            'CVE-2023-0002',
            'Sample High Vulnerability',
            'This is a sample high severity vulnerability for testing',
            'HIGH',
            'ACTIVE',
            'YES',
            7.5,
            CURRENT_TIMESTAMP - INTERVAL '5 days',
            CURRENT_TIMESTAMP - INTERVAL '2 hours',
            'CVE-2023-0002',
            'another-package',
            '2.1.0',
            '2.1.1'
        ),
        (
            1,
            '123456789012',
            'CVE-2023-0003',
            'Sample Medium Vulnerability',
            'This is a sample medium severity vulnerability for testing',
            'MEDIUM',
            'ACTIVE',
            'NO',
            5.3,
            CURRENT_TIMESTAMP - INTERVAL '3 days',
            CURRENT_TIMESTAMP - INTERVAL '3 hours',
            'CVE-2023-0003',
            'third-package',
            '3.2.1',
            NULL
        );

        -- Insert sample resources
        INSERT INTO resources (
            vulnerability_id,
            resource_id,
            resource_type,
            resource_arn,
            platform,
            region,
            account_id
        ) VALUES
        (
            1,
            'i-0123456789abcdef0',
            'EC2_INSTANCE',
            'arn:aws:ec2:us-east-1:123456789012:instance/i-0123456789abcdef0',
            'LINUX',
            'us-east-1',
            '123456789012'
        ),
        (
            2,
            'i-0123456789abcdef1',
            'EC2_INSTANCE',
            'arn:aws:ec2:us-west-2:123456789012:instance/i-0123456789abcdef1',
            'LINUX',
            'us-west-2',
            '123456789012'
        ),
        (
            3,
            'repo-sample-app',
            'ECR_REPOSITORY',
            'arn:aws:ecr:us-east-1:123456789012:repository/sample-app',
            'DOCKER',
            'us-east-1',
            '123456789012'
        );

        RAISE NOTICE 'Development seed data inserted successfully';
    END IF;
END $$;