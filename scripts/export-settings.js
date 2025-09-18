#!/usr/bin/env node

/**
 * SQLite Settings Export Script
 * Exports settings data from SQLite database for PostgreSQL migration
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');

const SQLITE_DB_PATH = path.join(__dirname, '..', 'db', 'vulnerabilities.db');
const OUTPUT_FILE = path.join(__dirname, '..', 'migrations', 'postgresql', '002-migrate-settings.sql');

async function exportSettings() {
    console.log('🔄 Exporting settings from SQLite database...');

    try {
        // Open SQLite database
        const db = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY);

        // Query all settings
        const settings = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM settings ORDER BY id", (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });

        // Close SQLite database
        db.close();

        console.log(`📊 Found ${settings.length} settings to migrate:`);
        settings.forEach(setting => {
            console.log(`  - ${setting.key}: ${setting.value} (${setting.type})`);
        });

        // Generate PostgreSQL INSERT statements
        let sqlContent = `-- Settings Data Migration from SQLite to PostgreSQL
-- Generated on: ${new Date().toISOString()}
-- Records to migrate: ${settings.length}

-- Clear existing settings (if any)
DELETE FROM settings;

-- Reset sequence
ALTER SEQUENCE settings_id_seq RESTART WITH 1;

-- Insert migrated settings data
`;

        const insertStatements = settings.map(setting => {
            const escapedValue = setting.value ? setting.value.replace(/'/g, "''") : null;
            const escapedDescription = setting.description ? setting.description.replace(/'/g, "''") : null;

            return `INSERT INTO settings (key, value, type, description, created_at, updated_at) VALUES
    ('${setting.key}', ${escapedValue ? `'${escapedValue}'` : 'NULL'}, '${setting.type}', ${escapedDescription ? `'${escapedDescription}'` : 'NULL'}, '${setting.created_at}', '${setting.updated_at}');`;
        });

        sqlContent += insertStatements.join('\n') + '\n\n';

        // Add validation query
        sqlContent += `-- Validation: Verify migration success
SELECT
    COUNT(*) as total_settings,
    COUNT(CASE WHEN type = 'string' THEN 1 END) as string_settings,
    COUNT(CASE WHEN type = 'boolean' THEN 1 END) as boolean_settings,
    COUNT(CASE WHEN type = 'number' THEN 1 END) as number_settings,
    COUNT(CASE WHEN type = 'json' THEN 1 END) as json_settings
FROM settings;

-- Expected results: ${settings.length} total settings
-- Types breakdown:
--   String: ${settings.filter(s => s.type === 'string').length}
--   Boolean: ${settings.filter(s => s.type === 'boolean').length}
--   Number: ${settings.filter(s => s.type === 'number').length}
--   JSON: ${settings.filter(s => s.type === 'json').length}

-- Display all migrated settings
SELECT key, value, type, description FROM settings ORDER BY key;
`;

        // Write to output file
        await fs.writeFile(OUTPUT_FILE, sqlContent, 'utf8');

        console.log(`✅ Settings export completed successfully!`);
        console.log(`📁 Migration script created: ${OUTPUT_FILE}`);
        console.log(`🚀 Ready to run PostgreSQL migration`);

        return {
            success: true,
            recordCount: settings.length,
            outputFile: OUTPUT_FILE,
            settings: settings
        };

    } catch (error) {
        console.error('❌ Error exporting settings:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    exportSettings()
        .then(result => {
            console.log(`\n✨ Export completed: ${result.recordCount} settings exported`);
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Export failed:', error.message);
            process.exit(1);
        });
}

module.exports = { exportSettings };