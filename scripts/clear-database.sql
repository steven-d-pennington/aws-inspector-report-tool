-- Clear Database Script
-- This script will remove all data from the vulnerability dashboard tables
-- while preserving the table structure and any settings

-- Start transaction to ensure atomicity
BEGIN;

-- First, let's see what tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Clear data from tables that exist (check each one individually)

-- Clear vulnerabilities table (main table)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vulnerabilities') THEN
        DELETE FROM vulnerabilities WHERE 1=1;
        RAISE NOTICE 'Cleared vulnerabilities table';
    ELSE
        RAISE NOTICE 'Table vulnerabilities does not exist';
    END IF;
END $$;

-- Clear reports table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reports') THEN
        DELETE FROM reports WHERE 1=1;
        RAISE NOTICE 'Cleared reports table';
    ELSE
        RAISE NOTICE 'Table reports does not exist';
    END IF;
END $$;

-- Clear resources table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resources') THEN
        DELETE FROM resources WHERE 1=1;
        RAISE NOTICE 'Cleared resources table';
    ELSE
        RAISE NOTICE 'Table resources does not exist';
    END IF;
END $$;

-- Clear packages table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'packages') THEN
        DELETE FROM packages WHERE 1=1;
        RAISE NOTICE 'Cleared packages table';
    ELSE
        RAISE NOTICE 'Table packages does not exist';
    END IF;
END $$;

-- Clear references table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'references') THEN
        DELETE FROM "references" WHERE 1=1;
        RAISE NOTICE 'Cleared references table';
    ELSE
        RAISE NOTICE 'Table references does not exist';
    END IF;
END $$;

-- Clear upload_events table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upload_events') THEN
        DELETE FROM upload_events WHERE 1=1;
        RAISE NOTICE 'Cleared upload_events table';
    ELSE
        RAISE NOTICE 'Table upload_events does not exist';
    END IF;
END $$;

-- Clear vulnerability_history table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vulnerability_history') THEN
        DELETE FROM vulnerability_history WHERE 1=1;
        RAISE NOTICE 'Cleared vulnerability_history table';
    ELSE
        RAISE NOTICE 'Table vulnerability_history does not exist';
    END IF;
END $$;

-- Clear resource_history table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resource_history') THEN
        DELETE FROM resource_history WHERE 1=1;
        RAISE NOTICE 'Cleared resource_history table';
    ELSE
        RAISE NOTICE 'Table resource_history does not exist';
    END IF;
END $$;

-- Reset sequences for existing tables only
DO $$
BEGIN
    -- Reset reports sequence if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reports') THEN
        IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'reports_id_seq') THEN
            PERFORM setval('reports_id_seq', 1, false);
            RAISE NOTICE 'Reset reports_id_seq';
        END IF;
    END IF;

    -- Reset vulnerabilities sequence if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vulnerabilities') THEN
        IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'vulnerabilities_id_seq') THEN
            PERFORM setval('vulnerabilities_id_seq', 1, false);
            RAISE NOTICE 'Reset vulnerabilities_id_seq';
        END IF;
    END IF;

    -- Reset resources sequence if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resources') THEN
        IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'resources_id_seq') THEN
            PERFORM setval('resources_id_seq', 1, false);
            RAISE NOTICE 'Reset resources_id_seq';
        END IF;
    END IF;

    -- Reset packages sequence if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'packages') THEN
        IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'packages_id_seq') THEN
            PERFORM setval('packages_id_seq', 1, false);
            RAISE NOTICE 'Reset packages_id_seq';
        END IF;
    END IF;

    -- Reset references sequence if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'references') THEN
        IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'references_id_seq') THEN
            PERFORM setval('references_id_seq', 1, false);
            RAISE NOTICE 'Reset references_id_seq';
        END IF;
    END IF;

    -- Reset upload_events sequence if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upload_events') THEN
        IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'upload_events_id_seq') THEN
            PERFORM setval('upload_events_id_seq', 1, false);
            RAISE NOTICE 'Reset upload_events_id_seq';
        END IF;
    END IF;

    -- Reset vulnerability_history sequence if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vulnerability_history') THEN
        IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'vulnerability_history_id_seq') THEN
            PERFORM setval('vulnerability_history_id_seq', 1, false);
            RAISE NOTICE 'Reset vulnerability_history_id_seq';
        END IF;
    END IF;

    -- Reset resource_history sequence if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resource_history') THEN
        IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'resource_history_id_seq') THEN
            PERFORM setval('resource_history_id_seq', 1, false);
            RAISE NOTICE 'Reset resource_history_id_seq';
        END IF;
    END IF;
END $$;

-- Commit the transaction
COMMIT;

-- Show final summary of what tables exist and their record counts
SELECT
    t.table_name,
    COALESCE(
        (SELECT COUNT(*) FROM information_schema.tables
         WHERE table_name = t.table_name), 0
    ) as table_exists,
    CASE
        WHEN t.table_name = 'reports' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reports')
            THEN (SELECT COUNT(*) FROM reports)
        WHEN t.table_name = 'vulnerabilities' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vulnerabilities')
            THEN (SELECT COUNT(*) FROM vulnerabilities)
        WHEN t.table_name = 'resources' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resources')
            THEN (SELECT COUNT(*) FROM resources)
        WHEN t.table_name = 'packages' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'packages')
            THEN (SELECT COUNT(*) FROM packages)
        WHEN t.table_name = 'references' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'references')
            THEN (SELECT COUNT(*) FROM "references")
        WHEN t.table_name = 'upload_events' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upload_events')
            THEN (SELECT COUNT(*) FROM upload_events)
        WHEN t.table_name = 'vulnerability_history' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vulnerability_history')
            THEN (SELECT COUNT(*) FROM vulnerability_history)
        WHEN t.table_name = 'resource_history' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resource_history')
            THEN (SELECT COUNT(*) FROM resource_history)
        ELSE 0
    END as remaining_records
FROM (
    VALUES 
        ('reports'),
        ('vulnerabilities'),
        ('resources'),
        ('packages'),
        ('references'),
        ('upload_events'),
        ('vulnerability_history'),
        ('resource_history')
) t(table_name);

-- Display completion message
SELECT 'Database clear completed - check messages above for details' as status;