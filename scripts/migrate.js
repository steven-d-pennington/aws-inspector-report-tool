const path = require('path');
const Database = require('../src/models/database');

class MigrationRunner {
    constructor() {
        this.database = new Database();
    }

    async run() {
        try {
            console.log('Starting database migration...');

            // Initialize the database connection
            await this.database.initialize();
            console.log('✓ Database connection established');

            // Run migrations
            await this.createSettingsTable();
            await this.createModuleSettingsTable();
            await this.createUpdateTriggers();
            await this.insertDefaultSettings();
            await this.insertDefaultModuleSettings();

            console.log('✓ Database migration completed successfully');
            process.exit(0);
        } catch (error) {
            console.error('✗ Migration failed:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }

    async createSettingsTable() {
        return new Promise((resolve, reject) => {
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT UNIQUE NOT NULL,
                    value TEXT,
                    type TEXT DEFAULT 'string',
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            this.database.db.run(createTableQuery, (err) => {
                if (err) {
                    reject(new Error(`Failed to create settings table: ${err.message}`));
                } else {
                    console.log('✓ Settings table created/verified');
                    resolve();
                }
            });
        });
    }

    async createModuleSettingsTable() {
        return new Promise((resolve, reject) => {
            const createTableQuery = `
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
            `;

            this.database.db.run(createTableQuery, (err) => {
                if (err) {
                    reject(new Error(`Failed to create module_settings table: ${err.message}`));
                } else {
                    console.log('✓ Module settings table created/verified');
                    resolve();
                }
            });
        });
    }

    async createUpdateTriggers() {
        return new Promise((resolve, reject) => {
            this.database.db.serialize(() => {
                // Create trigger for settings table
                this.database.db.run(`
                    CREATE TRIGGER IF NOT EXISTS update_settings_timestamp
                    AFTER UPDATE ON settings
                    BEGIN
                        UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                    END
                `, (err) => {
                    if (err) {
                        reject(new Error(`Failed to create settings trigger: ${err.message}`));
                        return;
                    }
                });

                // Create trigger for module_settings table
                this.database.db.run(`
                    CREATE TRIGGER IF NOT EXISTS update_module_settings_timestamp
                    AFTER UPDATE ON module_settings
                    BEGIN
                        UPDATE module_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                    END
                `, (err) => {
                    if (err) {
                        reject(new Error(`Failed to create module_settings trigger: ${err.message}`));
                    } else {
                        console.log('✓ Update triggers created/verified');
                        resolve();
                    }
                });
            });
        });
    }

    async insertDefaultSettings() {
        return new Promise((resolve, reject) => {
            const defaultSettings = [
                {
                    key: 'app_title',
                    value: 'AWS Security Dashboard',
                    type: 'string',
                    description: 'Application title'
                },
                {
                    key: 'theme',
                    value: 'light',
                    type: 'string',
                    description: 'UI theme (light/dark)'
                },
                {
                    key: 'auto_refresh',
                    value: 'false',
                    type: 'boolean',
                    description: 'Auto-refresh dashboard'
                },
                {
                    key: 'refresh_interval',
                    value: '300',
                    type: 'number',
                    description: 'Refresh interval in seconds'
                }
            ];

            let completed = 0;
            let hasError = false;

            if (defaultSettings.length === 0) {
                console.log('✓ No default settings to insert');
                resolve();
                return;
            }

            defaultSettings.forEach((setting, index) => {
                this.database.db.run(
                    `INSERT OR IGNORE INTO settings (key, value, type, description) VALUES (?, ?, ?, ?)`,
                    [setting.key, setting.value, setting.type, setting.description],
                    function(err) {
                        if (err && !hasError) {
                            hasError = true;
                            reject(new Error(`Failed to insert default setting '${setting.key}': ${err.message}`));
                            return;
                        }

                        completed++;
                        if (completed === defaultSettings.length && !hasError) {
                            console.log('✓ Default settings inserted/verified');
                            resolve();
                        }
                    }
                );
            });
        });
    }

    async insertDefaultModuleSettings() {
        return new Promise((resolve, reject) => {
            const defaultModules = [
                {
                    module_id: 'aws-inspector',
                    name: 'AWS Inspector',
                    description: 'AWS Inspector vulnerability reports',
                    enabled: 1,
                    is_default: 1,
                    display_order: 1,
                    icon: 'shield-check',
                    route: '/'
                },
                {
                    module_id: 'sbom',
                    name: 'SBOM Reports',
                    description: 'Software Bill of Materials analysis',
                    enabled: 0,
                    is_default: 0,
                    display_order: 2,
                    icon: 'list-check',
                    route: '/sbom'
                }
            ];

            let completed = 0;
            let hasError = false;

            if (defaultModules.length === 0) {
                console.log('✓ No default module settings to insert');
                resolve();
                return;
            }

            defaultModules.forEach((module, index) => {
                this.database.db.run(
                    `INSERT OR IGNORE INTO module_settings
                     (module_id, name, description, enabled, is_default, display_order, icon, route)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        module.module_id,
                        module.name,
                        module.description,
                        module.enabled,
                        module.is_default,
                        module.display_order,
                        module.icon,
                        module.route
                    ],
                    function(err) {
                        if (err && !hasError) {
                            hasError = true;
                            reject(new Error(`Failed to insert default module '${module.module_id}': ${err.message}`));
                            return;
                        }

                        completed++;
                        if (completed === defaultModules.length && !hasError) {
                            console.log('✓ Default module settings inserted/verified');
                            resolve();
                        }
                    }
                );
            });
        });
    }
}

// Run migration if this script is executed directly
if (require.main === module) {
    const migration = new MigrationRunner();
    migration.run();
}

module.exports = MigrationRunner;