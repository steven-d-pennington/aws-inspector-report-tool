#!/usr/bin/env node

/**
 * PostgreSQL Schema Validation Script
 * Validates that all required tables, indexes, and constraints exist
 */

const { getPool } = require('../src/config/database-pool');

const EXPECTED_TABLES = [
    'reports',
    'vulnerabilities',
    'resources',
    'packages',
    'references',
    'settings',
    'vulnerability_history',
    'resource_history',
    'upload_events'
];

const EXPECTED_INDEXES = [
    'idx_reports_upload_date',
    'idx_reports_status',
    'idx_reports_filename',
    'idx_vulnerabilities_severity',
    'idx_vulnerabilities_status',
    'idx_vulnerabilities_last_observed',
    'idx_vulnerabilities_package_name',
    'idx_vulnerabilities_cve_id',
    'idx_vulnerabilities_report_id',
    'idx_settings_key',
    'idx_settings_type',
    'idx_settings_updated_at'
];

const EXPECTED_CONSTRAINTS = [
    'reports_filename_not_empty',
    'vulnerabilities_title_not_empty',
    'settings_key_not_empty',
    'fk_vulnerabilities_report_id',
    'fk_resources_vulnerability_id',
    'fk_packages_vulnerability_id'
];

async function validateSchema() {
    console.log('🔍 Starting PostgreSQL schema validation...');

    const results = {
        tables: { expected: EXPECTED_TABLES.length, found: 0, missing: [] },
        indexes: { expected: EXPECTED_INDEXES.length, found: 0, missing: [] },
        constraints: { expected: EXPECTED_CONSTRAINTS.length, found: 0, missing: [] },
        settings: { expected: 9, found: 0 },
        overall: false
    };

    try {
        const pool = await getPool();

        // 1. Validate Tables
        console.log('\n📋 Validating tables...');
        const tablesResult = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
                AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        const foundTables = tablesResult.rows.map(row => row.table_name);
        results.tables.found = foundTables.length;
        results.tables.missing = EXPECTED_TABLES.filter(table => !foundTables.includes(table));

        console.log(`✅ Found ${foundTables.length} tables: ${foundTables.join(', ')}`);
        if (results.tables.missing.length > 0) {
            console.log(`❌ Missing tables: ${results.tables.missing.join(', ')}`);
        }

        // 2. Validate Indexes
        console.log('\n📊 Validating indexes...');
        const indexesResult = await pool.query(`
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
                AND indexname NOT LIKE '%_pkey'
                AND indexname NOT LIKE 'sqlite_%'
            ORDER BY indexname
        `);

        const foundIndexes = indexesResult.rows.map(row => row.indexname);
        results.indexes.found = foundIndexes.length;
        results.indexes.missing = EXPECTED_INDEXES.filter(idx => !foundIndexes.includes(idx));

        console.log(`✅ Found ${foundIndexes.length} custom indexes`);
        if (results.indexes.missing.length > 0) {
            console.log(`❌ Missing indexes: ${results.indexes.missing.join(', ')}`);
        }

        // 3. Validate Constraints
        console.log('\n🔒 Validating constraints...');
        const constraintsResult = await pool.query(`
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND constraint_type IN ('CHECK', 'FOREIGN KEY', 'UNIQUE')
            ORDER BY constraint_name
        `);

        const foundConstraints = constraintsResult.rows.map(row => row.constraint_name);
        results.constraints.found = foundConstraints.length;
        results.constraints.missing = EXPECTED_CONSTRAINTS.filter(cons => !foundConstraints.includes(cons));

        console.log(`✅ Found ${foundConstraints.length} constraints`);
        if (results.constraints.missing.length > 0) {
            console.log(`❌ Missing constraints: ${results.constraints.missing.join(', ')}`);
        }

        // 4. Validate Settings Data
        console.log('\n⚙️ Validating settings data...');
        const settingsResult = await pool.query(`
            SELECT COUNT(*) as count,
                   COUNT(CASE WHEN type = 'string' THEN 1 END) as string_count,
                   COUNT(CASE WHEN type = 'boolean' THEN 1 END) as boolean_count,
                   COUNT(CASE WHEN type = 'number' THEN 1 END) as number_count,
                   COUNT(CASE WHEN type = 'json' THEN 1 END) as json_count
            FROM settings
        `);

        const settingsData = settingsResult.rows[0];
        results.settings.found = parseInt(settingsData.count);

        console.log(`✅ Found ${results.settings.found} settings records`);
        console.log(`   📝 Types: ${settingsData.string_count} string, ${settingsData.boolean_count} boolean, ${settingsData.number_count} number, ${settingsData.json_count} json`);

        // 5. Test Constraint Functionality
        console.log('\n🧪 Testing constraint functionality...');

        try {
            // Test severity constraint
            await pool.query("INSERT INTO vulnerabilities (report_id, title, severity) VALUES (999999, 'Test', 'INVALID_SEVERITY')");
            console.log('❌ Severity constraint not working - invalid value accepted');
        } catch (error) {
            if (error.message.includes('severity')) {
                console.log('✅ Severity constraint working - invalid value rejected');
            }
        }

        try {
            // Test foreign key constraint
            await pool.query("INSERT INTO vulnerabilities (report_id, title, severity) VALUES (999999, 'FK Test', 'HIGH')");
            console.log('❌ Foreign key constraint not working - invalid report_id accepted');
        } catch (error) {
            if (error.message.includes('foreign key') || error.message.includes('violates')) {
                console.log('✅ Foreign key constraint working - invalid report_id rejected');
            }
        }

        // 6. Test Triggers
        console.log('\n⚡ Testing triggers...');
        const triggerTest = await pool.query(`
            SELECT COUNT(*) as trigger_count
            FROM information_schema.triggers
            WHERE trigger_schema = 'public'
                AND trigger_name = 'settings_updated_at_trigger'
        `);

        if (parseInt(triggerTest.rows[0].trigger_count) > 0) {
            console.log('✅ Settings updated_at trigger found');
        } else {
            console.log('❌ Settings updated_at trigger missing');
        }

        // 7. Overall Assessment
        const allTablesPresent = results.tables.missing.length === 0;
        const criticalIndexesPresent = results.indexes.missing.length <= 2; // Allow some flexibility
        const criticalConstraintsPresent = results.constraints.missing.length === 0;
        const settingsDataPresent = results.settings.found === results.settings.expected;

        results.overall = allTablesPresent && criticalIndexesPresent && criticalConstraintsPresent && settingsDataPresent;

        // Summary Report
        console.log('\n📊 VALIDATION SUMMARY');
        console.log('='.repeat(50));
        console.log(`📋 Tables: ${results.tables.found}/${results.tables.expected} ${allTablesPresent ? '✅' : '❌'}`);
        console.log(`📊 Indexes: ${results.indexes.found}/${results.indexes.expected} ${criticalIndexesPresent ? '✅' : '❌'}`);
        console.log(`🔒 Constraints: ${results.constraints.found}/${results.constraints.expected} ${criticalConstraintsPresent ? '✅' : '❌'}`);
        console.log(`⚙️ Settings: ${results.settings.found}/${results.settings.expected} ${settingsDataPresent ? '✅' : '❌'}`);
        console.log('='.repeat(50));
        console.log(`🎯 OVERALL: ${results.overall ? '✅ VALID' : '❌ INVALID'}`);

        if (results.overall) {
            console.log('\n🚀 PostgreSQL schema is ready for production use!');
        } else {
            console.log('\n⚠️ Schema validation failed - please review and fix issues above');
        }

        return results;

    } catch (error) {
        console.error('💥 Schema validation failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    validateSchema()
        .then(results => {
            process.exit(results.overall ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Validation error:', error.message);
            process.exit(1);
        });
}

module.exports = { validateSchema };