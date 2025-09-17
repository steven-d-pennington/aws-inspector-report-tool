const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Read the migration SQL
const migrationPath = path.join(__dirname, '..', 'specs', '002-history-collection-i', 'contracts', 'database-migration.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Connect to database
const dbPath = path.join(__dirname, '..', 'db', 'vulnerabilities.db');
const db = new sqlite3.Database(dbPath);

console.log('Starting database migration...');

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Execute migration
db.exec(migrationSQL, (err) => {
    if (err) {
        console.error('✗ Migration failed:', err.message);
        db.close();
        process.exit(1);
    }

    console.log('✓ Migration SQL executed successfully');

    // Verify tables were created
    db.all(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name IN (
            'vulnerability_history',
            'resource_history',
            'upload_events'
        )
    `, [], (err, tables) => {
        if (err) {
            console.error('✗ Failed to verify tables:', err.message);
            db.close();
            process.exit(1);
        }

        console.log('✓ Tables created:', tables.map(t => t.name).join(', '));

        // Verify indexes
        db.all(`
            SELECT name FROM sqlite_master
            WHERE type='index' AND (
                name LIKE 'idx_history_%' OR
                name LIKE 'idx_resource_history_%' OR
                name LIKE 'idx_upload_events_%'
            )
        `, [], (err, indexes) => {
            if (err) {
                console.error('✗ Failed to verify indexes:', err.message);
                db.close();
                process.exit(1);
            }

            console.log('✓ Indexes created:', indexes.map(i => i.name).join(', '));

            // Test foreign key constraints
            db.get('PRAGMA foreign_keys', [], (err, row) => {
                if (err) {
                    console.error('✗ Failed to check foreign keys:', err.message);
                } else {
                    console.log('✓ Foreign keys status:', row.foreign_keys ? 'ENABLED' : 'DISABLED');
                }

                console.log('✓ Migration completed successfully');
                db.close();
            });
        });
    });
});

console.log('Migration script completed.');