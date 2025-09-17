#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function seedModules() {
    console.log('Seeding modules...');

    const dbPath = path.join(__dirname, 'db/vulnerabilities.db');
    const db = new sqlite3.Database(dbPath);

    try {
        // Create module_settings table if it doesn't exist
        await new Promise((resolve, reject) => {
            db.run(`
                CREATE TABLE IF NOT EXISTS module_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    module_id TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    enabled BOOLEAN DEFAULT 0,
                    is_default BOOLEAN DEFAULT 0,
                    display_order INTEGER,
                    config JSON,
                    icon TEXT,
                    route TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => err ? reject(err) : resolve());
        });

        // Insert AWS Inspector module
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT OR REPLACE INTO module_settings
                (module_id, name, description, enabled, is_default, display_order, config, icon, route)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                'aws-inspector',
                'AWS Inspector',
                'AWS Inspector vulnerability reporting and management',
                1, // enabled
                1, // is_default
                1, // display_order
                JSON.stringify({
                    autoRefresh: false,
                    refreshInterval: 300,
                    severityFilter: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
                }),
                '🔍',
                '/'
            ], (err) => err ? reject(err) : resolve());
        });

        // Insert SBOM module
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT OR REPLACE INTO module_settings
                (module_id, name, description, enabled, is_default, display_order, config, icon, route)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                'sbom',
                'SBOM Analysis',
                'Software Bill of Materials analysis and vulnerability correlation',
                1, // enabled
                0, // is_default
                2, // display_order
                JSON.stringify({
                    autoCorrelate: true,
                    supportedFormats: ['SPDX', 'CycloneDX', 'SWID'],
                    maxComponents: 10000,
                    correlationDepth: 3
                }),
                '📋',
                '/sbom'
            ], (err) => err ? reject(err) : resolve());
        });

        console.log('✅ Modules seeded successfully!');

        // Verify modules were added
        await new Promise((resolve, reject) => {
            db.all('SELECT * FROM module_settings ORDER BY display_order', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('📋 Available modules:');
                    rows.forEach(module => {
                        console.log(`  - ${module.name} (${module.module_id}) - ${module.enabled ? 'enabled' : 'disabled'}`);
                    });
                    resolve();
                }
            });
        });

    } catch (error) {
        console.error('❌ Error seeding modules:', error);
    } finally {
        db.close();
        process.exit(0);
    }
}

seedModules();