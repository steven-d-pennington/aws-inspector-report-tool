const Database = require('../../src/models/database');
const path = require('path');
const fs = require('fs').promises;

class TestDatabase extends Database {
    constructor() {
        super();
        // Use a unique test database path to avoid conflicts
        this.dbPath = path.join(__dirname, '../../db/test-vulnerabilities.db');
    }

    async setupTestDatabase() {
        // Ensure db directory exists
        const dbDir = path.dirname(this.dbPath);
        await fs.mkdir(dbDir, { recursive: true });

        // Remove existing test database if it exists
        try {
            await fs.unlink(this.dbPath);
        } catch (err) {
            // File doesn't exist, that's fine
        }

        // Initialize new test database
        await this.initialize();
    }

    async resetDatabase() {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Clear all data but keep the schema
                this.db.run('DELETE FROM "references"');
                this.db.run('DELETE FROM packages');
                this.db.run('DELETE FROM resources');
                this.db.run('DELETE FROM vulnerabilities');
                this.db.run('DELETE FROM reports');
                this.db.run('DELETE FROM settings');
                this.db.run('DELETE FROM module_settings');

                // Re-insert default settings
                this.db.run(`
                    INSERT INTO settings (key, value, type, description) VALUES
                    ('app_title', 'AWS Security Dashboard', 'string', 'Application title'),
                    ('theme', 'light', 'string', 'UI theme'),
                    ('auto_refresh', 'false', 'boolean', 'Auto-refresh dashboard'),
                    ('refresh_interval', '300', 'number', 'Refresh interval in seconds')
                `);

                // Re-insert default module settings
                this.db.run(`
                    INSERT INTO module_settings (module_id, name, enabled, is_default, display_order, route) VALUES
                    ('aws-inspector', 'AWS Inspector', 1, 1, 1, '/'),
                    ('sbom', 'SBOM Reports', 0, 0, 2, '/sbom')
                `, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    }

    async teardownTestDatabase() {
        if (this.db) {
            this.db.close();
        }
        // Clean up test database file
        try {
            await fs.unlink(this.dbPath);
        } catch (err) {
            // File doesn't exist or can't be deleted, that's fine
        }
    }

    // Methods for accessing settings (not implemented in base Database class)
    async getSettings() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT key, value, type, description FROM settings',
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        const settings = {};
                        rows.forEach(row => {
                            settings[row.key] = {
                                value: this.parseSettingValue(row.value, row.type),
                                type: row.type,
                                description: row.description
                            };
                        });
                        resolve({ settings });
                    }
                }
            );
        });
    }

    async updateSettings(settingsData) {
        return new Promise((resolve, reject) => {
            const settingsToUpdate = Object.keys(settingsData);
            let completed = 0;
            const errors = [];
            const updated = [];

            if (settingsToUpdate.length === 0) {
                return resolve({ success: true, message: 'No settings to update', updated: [] });
            }

            settingsToUpdate.forEach(key => {
                const value = settingsData[key];
                const type = this.getValueType(value);
                const stringValue = this.stringifySettingValue(value, type);

                this.db.run(
                    'UPDATE settings SET value = ?, type = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
                    [stringValue, type, key],
                    function(err) {
                        completed++;

                        if (err) {
                            errors.push(`Failed to update ${key}: ${err.message}`);
                        } else if (this.changes > 0) {
                            updated.push(key);
                        } else {
                            errors.push(`Setting '${key}' not found`);
                        }

                        if (completed === settingsToUpdate.length) {
                            if (errors.length > 0) {
                                reject(new Error(errors.join('; ')));
                            } else {
                                resolve({
                                    success: true,
                                    message: `Successfully updated ${updated.length} settings`,
                                    updated: updated
                                });
                            }
                        }
                    }
                );
            });
        });
    }

    parseSettingValue(value, type) {
        switch (type) {
            case 'boolean':
                return value === 'true' || value === true;
            case 'number':
                return parseFloat(value);
            case 'json':
                try {
                    return JSON.parse(value);
                } catch {
                    return value;
                }
            case 'string':
            default:
                return value;
        }
    }

    stringifySettingValue(value, type) {
        switch (type) {
            case 'boolean':
                return value ? 'true' : 'false';
            case 'number':
                return value.toString();
            case 'json':
                return JSON.stringify(value);
            case 'string':
            default:
                return value.toString();
        }
    }

    getValueType(value) {
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'object' && value !== null) return 'json';
        return 'string';
    }
}

module.exports = TestDatabase;