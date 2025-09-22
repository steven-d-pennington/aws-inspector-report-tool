const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables
require('dotenv').config();

// Get database configuration from environment variables or DATABASE_URL
const databaseUrl = process.env.DATABASE_URL || 'postgresql://report_gen:StarDust@localhost:5432/vulnerability_reports';
const pool = new Pool({
    connectionString: databaseUrl
});

async function runMigration() {
    let client;
    try {
        console.log('🔧 Running database migration to add missing columns...');

        // Get a client from the pool
        client = await pool.connect();

        // Check if schema_migrations table exists
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'schema_migrations'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('📦 Creating schema_migrations table...');
            await client.query(`
                CREATE TABLE schema_migrations (
                    version VARCHAR(255) PRIMARY KEY,
                    applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
            `);
        }

        // Read the migration file
        const migrationPath = path.join(__dirname, 'migrations', 'postgresql', '001-add-missing-columns.sql');
        const migrationSQL = await fs.readFile(migrationPath, 'utf8');

        // Execute the migration
        console.log('🚀 Applying migration 001-add-missing-columns...');
        await client.query(migrationSQL);

        console.log('✅ Migration completed successfully!');
        console.log('📝 The vulnerability_history table now has all required columns.');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Error details:', error);
        process.exit(1);
    } finally {
        // Release the client back to the pool
        if (client) {
            client.release();
        }
        // Close the pool
        await pool.end();
    }
}

// Run the migration
runMigration();