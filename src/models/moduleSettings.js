const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * ModuleSettings class for managing module configuration and state
 * Provides methods for enabling/disabling modules, updating configurations,
 * and maintaining data integrity rules
 */
class ModuleSettings {
    constructor() {
        this.dbPath = path.join(__dirname, '../../db/vulnerabilities.db');
        this.db = null;
    }

    /**
     * Initialize database connection and create tables if needed
     * @returns {Promise<void>}
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    /**
     * Create module_settings table with proper schema and triggers
     * @returns {Promise<void>}
     */
    async createTables() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Create module_settings table
                this.db.run(`
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
                `);

                // Create update trigger for module_settings
                this.db.run(`
                    CREATE TRIGGER IF NOT EXISTS update_module_settings_timestamp
                    AFTER UPDATE ON module_settings
                    BEGIN
                        UPDATE module_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                    END
                `);

                // Insert default module settings if they don't exist
                this.db.run(`
                    INSERT OR IGNORE INTO module_settings (module_id, name, enabled, is_default, display_order, route) VALUES
                    ('aws-inspector', 'AWS Inspector', 1, 1, 1, '/'),
                    ('sbom', 'SBOM Reports', 0, 0, 2, '/sbom')
                `, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    }

    /**
     * Get all modules in the system
     * @returns {Promise<Array>} Array of all module configurations
     */
    async getAllModules() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM module_settings ORDER BY display_order, name`,
                (err, rows) => {
                    if (err) reject(err);
                    else {
                        const processedRows = rows.map(row => ({
                            ...row,
                            enabled: Boolean(row.enabled),
                            is_default: Boolean(row.is_default),
                            config: row.config ? JSON.parse(row.config) : null
                        }));
                        resolve(processedRows);
                    }
                }
            );
        });
    }

    /**
     * Get a specific module by its module_id
     * @param {string} moduleId - The module identifier
     * @returns {Promise<Object|null>} Module configuration or null if not found
     */
    async getModule(moduleId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT * FROM module_settings WHERE module_id = ?`,
                [moduleId],
                (err, row) => {
                    if (err) reject(err);
                    else if (!row) resolve(null);
                    else {
                        const processedRow = {
                            ...row,
                            enabled: Boolean(row.enabled),
                            is_default: Boolean(row.is_default),
                            config: row.config ? JSON.parse(row.config) : null
                        };
                        resolve(processedRow);
                    }
                }
            );
        });
    }

    /**
     * Enable a module by module_id
     * @param {string} moduleId - The module identifier
     * @returns {Promise<void>}
     * @throws {Error} If module not found
     */
    async enableModule(moduleId) {
        return new Promise((resolve, reject) => {
            // First check if module exists
            this.db.get(
                `SELECT id FROM module_settings WHERE module_id = ?`,
                [moduleId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return reject(new Error(`Module '${moduleId}' not found`));

                    // Enable the module
                    this.db.run(
                        `UPDATE module_settings SET enabled = 1 WHERE module_id = ?`,
                        [moduleId],
                        function(err) {
                            if (err) reject(err);
                            else if (this.changes === 0) reject(new Error(`Module '${moduleId}' not found`));
                            else resolve();
                        }
                    );
                }
            );
        });
    }

    /**
     * Disable a module by module_id
     * Validates that at least one module remains enabled and default modules cannot be disabled
     * @param {string} moduleId - The module identifier
     * @returns {Promise<void>}
     * @throws {Error} If module is default, would leave no enabled modules, or not found
     */
    async disableModule(moduleId) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Check if module exists and is not default
                this.db.get(
                    `SELECT id, is_default FROM module_settings WHERE module_id = ?`,
                    [moduleId],
                    (err, row) => {
                        if (err) return reject(err);
                        if (!row) return reject(new Error(`Module '${moduleId}' not found`));
                        if (row.is_default) return reject(new Error(`Cannot disable default module '${moduleId}'`));

                        // Check if this would leave at least one enabled module
                        this.db.get(
                            `SELECT COUNT(*) as enabled_count FROM module_settings WHERE enabled = 1`,
                            (err, countRow) => {
                                if (err) return reject(err);
                                if (countRow.enabled_count <= 1) {
                                    return reject(new Error('Cannot disable module - at least one module must remain enabled'));
                                }

                                // Disable the module
                                this.db.run(
                                    `UPDATE module_settings SET enabled = 0 WHERE module_id = ?`,
                                    [moduleId],
                                    function(err) {
                                        if (err) reject(err);
                                        else if (this.changes === 0) reject(new Error(`Module '${moduleId}' not found`));
                                        else resolve();
                                    }
                                );
                            }
                        );
                    }
                );
            });
        });
    }

    /**
     * Update module configuration
     * @param {string} moduleId - The module identifier
     * @param {Object} config - The new configuration object
     * @returns {Promise<void>}
     * @throws {Error} If module not found or config is invalid JSON
     */
    async updateModuleConfig(moduleId, config) {
        return new Promise((resolve, reject) => {
            let configJson;
            try {
                configJson = config ? JSON.stringify(config) : null;
            } catch (err) {
                return reject(new Error(`Invalid configuration: ${err.message}`));
            }

            // First check if module exists
            this.db.get(
                `SELECT id FROM module_settings WHERE module_id = ?`,
                [moduleId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return reject(new Error(`Module '${moduleId}' not found`));

                    // Update the configuration
                    this.db.run(
                        `UPDATE module_settings SET config = ? WHERE module_id = ?`,
                        [configJson, moduleId],
                        function(err) {
                            if (err) reject(err);
                            else if (this.changes === 0) reject(new Error(`Module '${moduleId}' not found`));
                            else resolve();
                        }
                    );
                }
            );
        });
    }

    /**
     * Reorder modules by updating display_order for each module
     * @param {Array<string>} orderArray - Array of module_ids in desired order
     * @returns {Promise<void>}
     * @throws {Error} If any module_id not found or array contains duplicates
     */
    async reorderModules(orderArray) {
        return new Promise((resolve, reject) => {
            if (!Array.isArray(orderArray)) {
                return reject(new Error('Order array must be an array'));
            }

            // Check for duplicates
            const uniqueIds = new Set(orderArray);
            if (uniqueIds.size !== orderArray.length) {
                return reject(new Error('Order array cannot contain duplicate module IDs'));
            }

            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                // Validate all module IDs exist
                const placeholders = orderArray.map(() => '?').join(',');
                this.db.get(
                    `SELECT COUNT(*) as count FROM module_settings WHERE module_id IN (${placeholders})`,
                    orderArray,
                    (err, row) => {
                        if (err) {
                            this.db.run('ROLLBACK');
                            return reject(err);
                        }
                        if (row.count !== orderArray.length) {
                            this.db.run('ROLLBACK');
                            return reject(new Error('One or more module IDs not found'));
                        }

                        // Update display_order for each module
                        let completed = 0;
                        let hasError = false;

                        orderArray.forEach((moduleId, index) => {
                            if (hasError) return;

                            this.db.run(
                                `UPDATE module_settings SET display_order = ? WHERE module_id = ?`,
                                [index + 1, moduleId],
                                function(err) {
                                    if (err || hasError) {
                                        hasError = true;
                                        this.db.run('ROLLBACK');
                                        return reject(err || new Error('Transaction failed'));
                                    }

                                    completed++;
                                    if (completed === orderArray.length) {
                                        this.db.run('COMMIT', (err) => {
                                            if (err) reject(err);
                                            else resolve();
                                        });
                                    }
                                }
                            );
                        });
                    }
                );
            });
        });
    }

    /**
     * Get only enabled modules ordered by display_order
     * @returns {Promise<Array>} Array of enabled module configurations
     */
    async getEnabledModules() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM module_settings WHERE enabled = 1 ORDER BY display_order, name`,
                (err, rows) => {
                    if (err) reject(err);
                    else {
                        const processedRows = rows.map(row => ({
                            ...row,
                            enabled: Boolean(row.enabled),
                            is_default: Boolean(row.is_default),
                            config: row.config ? JSON.parse(row.config) : null
                        }));
                        resolve(processedRows);
                    }
                }
            );
        });
    }

    /**
     * Get modules ordered by display_order (includes both enabled and disabled)
     * @returns {Promise<Array>} Array of all module configurations ordered by display_order
     */
    async getModulesByOrder() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM module_settings ORDER BY display_order, name`,
                (err, rows) => {
                    if (err) reject(err);
                    else {
                        const processedRows = rows.map(row => ({
                            ...row,
                            enabled: Boolean(row.enabled),
                            is_default: Boolean(row.is_default),
                            config: row.config ? JSON.parse(row.config) : null
                        }));
                        resolve(processedRows);
                    }
                }
            );
        });
    }

    /**
     * Check if at least one module is enabled (validation helper)
     * @returns {Promise<boolean>} True if at least one module is enabled
     */
    async hasEnabledModules() {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT COUNT(*) as count FROM module_settings WHERE enabled = 1`,
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row.count > 0);
                }
            );
        });
    }

    /**
     * Get the default module
     * @returns {Promise<Object|null>} Default module configuration or null if not found
     */
    async getDefaultModule() {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT * FROM module_settings WHERE is_default = 1`,
                (err, row) => {
                    if (err) reject(err);
                    else if (!row) resolve(null);
                    else {
                        const processedRow = {
                            ...row,
                            enabled: Boolean(row.enabled),
                            is_default: Boolean(row.is_default),
                            config: row.config ? JSON.parse(row.config) : null
                        };
                        resolve(processedRow);
                    }
                }
            );
        });
    }
}

module.exports = ModuleSettings;