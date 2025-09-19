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

-- Clear historical_data table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'historical_data') THEN
        DELETE FROM historical_data WHERE 1=1;
        RAISE NOTICE 'Cleared historical_data table';
    ELSE
        RAISE NOTICE 'Table historical_data does not exist';
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

-- Clear vulnerability_resources table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vulnerability_resources') THEN
        DELETE FROM vulnerability_resources WHERE 1=1;
        RAISE NOTICE 'Cleared vulnerability_resources table';
    ELSE
        RAISE NOTICE 'Table vulnerability_resources does not exist';
    END IF;
END $$;

-- Clear vulnerability_packages table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vulnerability_packages') THEN
        DELETE FROM vulnerability_packages WHERE 1=1;
        RAISE NOTICE 'Cleared vulnerability_packages table';
    ELSE
        RAISE NOTICE 'Table vulnerability_packages does not exist';
    END IF;
END $$;

-- Clear vulnerability_references table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vulnerability_references') THEN
        DELETE FROM vulnerability_references WHERE 1=1;
        RAISE NOTICE 'Cleared vulnerability_references table';
    ELSE
        RAISE NOTICE 'Table vulnerability_references does not exist';
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
        ELSE 0
    END as remaining_records
FROM (
    VALUES ('reports'), ('vulnerabilities'), ('historical_data'), ('upload_events')
) t(table_name);

-- Display completion message
SELECT 'Database clear completed - check messages above for details' as status;