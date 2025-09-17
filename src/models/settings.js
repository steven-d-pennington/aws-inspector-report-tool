const Database = require('./database');

/**
 * Settings model for managing application configuration and preferences
 * Extends the existing Database class to provide settings-specific functionality
 */
class Settings extends Database {
    constructor() {
        super();
    }

    /**
     * Initialize database and create settings table if it doesn't exist
     * @returns {Promise<void>}
     */
    async initialize() {
        await super.initialize();
        await this.createSettingsTable();
        await this.insertDefaultSettings();
    }

    /**
     * Create settings table with proper constraints and triggers
     * @returns {Promise<void>}
     * @private
     */
    async createSettingsTable() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Create settings table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS settings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        key TEXT UNIQUE NOT NULL,
                        value TEXT,
                        type TEXT DEFAULT 'string',
                        description TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Create update trigger for settings
                this.db.run(`
                    CREATE TRIGGER IF NOT EXISTS update_settings_timestamp
                    AFTER UPDATE ON settings
                    BEGIN
                        UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                    END
                `, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    }

    /**
     * Insert default settings if they don't already exist
     * @returns {Promise<void>}
     * @private
     */
    async insertDefaultSettings() {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT OR IGNORE INTO settings (key, value, type, description) VALUES
                ('app_title', 'AWS Security Dashboard', 'string', 'Application title'),
                ('theme', 'light', 'string', 'UI theme'),
                ('auto_refresh', 'false', 'boolean', 'Auto-refresh dashboard'),
                ('refresh_interval', '300', 'number', 'Refresh interval in seconds')
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Retrieve all settings from the database
     * @returns {Promise<Object>} Object with setting keys as properties and their values
     */
    async getAllSettings() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT key, value, type FROM settings ORDER BY key`,
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        const settings = {};
                        rows.forEach(row => {
                            settings[row.key] = this._parseValue(row.value, row.type);
                        });
                        resolve(settings);
                    }
                }
            );
        });
    }

    /**
     * Retrieve all settings with complete information (value, type, description)
     * @returns {Promise<Object>} Object with setting keys mapped to {value, type, description}
     */
    async getAllSettingsDetailed() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT key, value, type, description FROM settings ORDER BY key`,
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        const settings = {};
                        rows.forEach(row => {
                            settings[row.key] = {
                                value: this._parseValue(row.value, row.type),
                                type: row.type,
                                description: row.description || ''
                            };
                        });
                        resolve(settings);
                    }
                }
            );
        });
    }

    /**
     * Retrieve a specific setting by key
     * @param {string} key - The setting key to retrieve
     * @returns {Promise<any>} The parsed setting value or null if not found
     */
    async getSetting(key) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT value, type FROM settings WHERE key = ?`,
                [key],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (row) {
                        resolve(this._parseValue(row.value, row.type));
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    }

    /**
     * Set a new setting or create if it doesn't exist
     * @param {string} key - The setting key
     * @param {any} value - The setting value
     * @param {string} type - The value type (string, boolean, number, json)
     * @param {string} [description] - Optional description for the setting
     * @returns {Promise<void>}
     */
    async setSetting(key, value, type = 'string', description = null) {
        // Validate key format
        if (!this._isValidKey(key)) {
            throw new Error('Setting key must be alphanumeric with underscores only');
        }

        // Validate type
        if (!this._isValidType(type)) {
            throw new Error('Setting type must be one of: string, boolean, number, json');
        }

        // Validate and serialize value
        const serializedValue = this._serializeValue(value, type);

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO settings (key, value, type, description, updated_at)
                 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [key, serializedValue, type, description],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    /**
     * Update an existing setting's value
     * @param {string} key - The setting key to update
     * @param {any} value - The new value
     * @returns {Promise<boolean>} True if setting was updated, false if key doesn't exist
     */
    async updateSetting(key, value) {
        // First get the current setting to determine its type
        const currentSetting = await new Promise((resolve, reject) => {
            this.db.get(
                `SELECT type FROM settings WHERE key = ?`,
                [key],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!currentSetting) {
            return false;
        }

        const serializedValue = this._serializeValue(value, currentSetting.type);

        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?`,
                [serializedValue, key],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes > 0);
                }
            );
        });
    }

    /**
     * Delete a setting by key
     * @param {string} key - The setting key to delete
     * @returns {Promise<boolean>} True if setting was deleted, false if key doesn't exist
     */
    async deleteSetting(key) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `DELETE FROM settings WHERE key = ?`,
                [key],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes > 0);
                }
            );
        });
    }

    /**
     * Set multiple settings in a single transaction
     * @param {Object} settings - Object with key-value pairs to set
     * @param {Object} [types] - Optional object mapping keys to their types
     * @returns {Promise<void>}
     */
    async setMultipleSettings(settings, types = {}) {
        return new Promise((resolve, reject) => {
            const db = this.db; // Preserve reference to db

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                const settingKeys = Object.keys(settings);
                let completed = 0;
                let hasError = false;

                if (settingKeys.length === 0) {
                    db.run('COMMIT');
                    return resolve();
                }

                settingKeys.forEach(key => {
                    if (hasError) return;

                    try {
                        const value = settings[key];
                        const type = types[key] || 'string';

                        // Validate key and type
                        if (!this._isValidKey(key)) {
                            throw new Error(`Invalid key format: ${key}`);
                        }
                        if (!this._isValidType(type)) {
                            throw new Error(`Invalid type: ${type}`);
                        }

                        const serializedValue = this._serializeValue(value, type);

                        db.run(
                            `INSERT OR REPLACE INTO settings (key, value, type, updated_at)
                             VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
                            [key, serializedValue, type],
                            function(err) {
                                if (err && !hasError) {
                                    hasError = true;
                                    db.run('ROLLBACK');
                                    reject(err);
                                } else {
                                    completed++;
                                    if (completed === settingKeys.length && !hasError) {
                                        db.run('COMMIT');
                                        resolve();
                                    }
                                }
                            }
                        );
                    } catch (error) {
                        if (!hasError) {
                            hasError = true;
                            db.run('ROLLBACK');
                            reject(error);
                        }
                    }
                });
            });
        });
    }

    /**
     * Parse a setting value based on its type
     * @param {string} value - The raw value from database
     * @param {string} type - The value type
     * @returns {any} The parsed value
     * @private
     */
    _parseValue(value, type) {
        if (value === null || value === undefined) {
            return null;
        }

        switch (type) {
            case 'boolean':
                return value === 'true' || value === '1' || value === 1 || value === true;
            case 'number':
                const num = Number(value);
                return isNaN(num) ? 0 : num;
            case 'json':
                try {
                    return JSON.parse(value);
                } catch (e) {
                    return null;
                }
            case 'string':
            default:
                return String(value);
        }
    }

    /**
     * Serialize a value for storage based on its type
     * @param {any} value - The value to serialize
     * @param {string} type - The target type
     * @returns {string} The serialized value
     * @private
     */
    _serializeValue(value, type) {
        switch (type) {
            case 'boolean':
                return Boolean(value) ? 'true' : 'false';
            case 'number':
                const num = Number(value);
                if (isNaN(num)) {
                    throw new Error(`Invalid number value: ${value}`);
                }
                return String(num);
            case 'json':
                if (value === undefined) {
                    throw new Error('Invalid JSON value: undefined cannot be serialized');
                }
                try {
                    return JSON.stringify(value);
                } catch (e) {
                    throw new Error(`Invalid JSON value: ${e.message}`);
                }
            case 'string':
            default:
                return String(value);
        }
    }

    /**
     * Validate setting key format
     * @param {string} key - The key to validate
     * @returns {boolean} True if valid
     * @private
     */
    _isValidKey(key) {
        return /^[a-zA-Z0-9_]+$/.test(key);
    }

    /**
     * Validate setting type
     * @param {string} type - The type to validate
     * @returns {boolean} True if valid
     * @private
     */
    _isValidType(type) {
        return ['string', 'boolean', 'number', 'json'].includes(type);
    }

}

module.exports = Settings;