const Settings = require('../models/settings');
const EventEmitter = require('events');

/**
 * Settings Service - Business logic layer for application settings management
 * Provides caching, validation, audit logging, backup/restore, and migration features
 */
class SettingsService extends EventEmitter {
    constructor() {
        super();
        this.settingsModel = new Settings();
        this.cache = new Map();
        this.cacheTimestamps = new Map();
        this.CACHE_TTL = 60 * 1000; // 60 seconds as specified
        this.auditLog = [];
        this.isInitialized = false;

        // Default settings schema for validation and migration
        this.defaultSchema = {
            app_title: { type: 'string', default: 'AWS Security Dashboard', description: 'Application title' },
            theme: { type: 'string', default: 'light', description: 'UI theme', enum: ['light', 'dark'] },
            auto_refresh: { type: 'boolean', default: false, description: 'Auto-refresh dashboard' },
            refresh_interval: { type: 'number', default: 300, description: 'Refresh interval in seconds', min: 30, max: 3600 },
            notifications_enabled: { type: 'boolean', default: true, description: 'Enable system notifications' },
            export_format: { type: 'string', default: 'pdf', description: 'Default export format', enum: ['pdf', 'csv', 'json'] },
            max_concurrent_scans: { type: 'number', default: 5, description: 'Maximum concurrent vulnerability scans', min: 1, max: 20 },
            retention_days: { type: 'number', default: 90, description: 'Data retention period in days', min: 1, max: 365 },
            security_settings: {
                type: 'json',
                default: {
                    session_timeout: 3600,
                    password_policy: { min_length: 8, require_special: true },
                    mfa_enabled: false
                },
                description: 'Security configuration settings'
            }
        };
    }

    /**
     * Initialize the settings service and underlying model
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            if (this.isInitialized) {
                return;
            }

            await this.settingsModel.initialize();
            await this.performMigrations();
            this.isInitialized = true;

            this._log('info', 'Settings service initialized successfully');
        } catch (error) {
            this._log('error', 'Failed to initialize settings service', { error: error.message });
            throw new Error(`Settings service initialization failed: ${error.message}`);
        }
    }

    /**
     * Get all settings with caching support
     * @returns {Promise<Object>} All settings as key-value pairs
     */
    async getSettings() {
        try {
            await this._ensureInitialized();

            // Check cache first
            const cachedSettings = this._getCachedSettings();
            if (cachedSettings) {
                return cachedSettings;
            }

            // Fetch from database
            const settings = await this.settingsModel.getAllSettings();

            // Cache the results
            this._setCachedSettings(settings);

            this._log('info', 'Settings retrieved successfully', { count: Object.keys(settings).length });
            return settings;
        } catch (error) {
            this._log('error', 'Failed to get settings', { error: error.message });
            throw new Error(`Failed to retrieve settings: ${error.message}`);
        }
    }

    /**
     * Get all settings with detailed information (value, type, description) for API responses
     * @returns {Promise<Object>} All settings with {value, type, description} structure
     */
    async getSettingsDetailed() {
        try {
            await this._ensureInitialized();

            // Check cache first (using a different cache key for detailed format)
            const cachedSettings = this._getCachedDetailedSettings();
            if (cachedSettings) {
                return cachedSettings;
            }

            // Fetch from database with detailed information
            const settings = await this.settingsModel.getAllSettingsDetailed();

            // Cache the results
            this._setCachedDetailedSettings(settings);

            this._log('info', 'Detailed settings retrieved successfully', { count: Object.keys(settings).length });
            return settings;
        } catch (error) {
            this._log('error', 'Failed to get detailed settings', { error: error.message });
            throw new Error(`Failed to retrieve detailed settings: ${error.message}`);
        }
    }

    /**
     * Get a specific setting by key
     * @param {string} key - Setting key to retrieve
     * @returns {Promise<any>} Setting value or null if not found
     */
    async getSetting(key) {
        try {
            await this._ensureInitialized();
            this._validateKey(key);

            const settings = await this.getSettings();
            const value = settings[key] !== undefined ? settings[key] : null;

            this._log('info', 'Setting retrieved', { key, found: value !== null });
            return value;
        } catch (error) {
            this._log('error', 'Failed to get setting', { key, error: error.message });
            throw error;
        }
    }

    /**
     * Update multiple settings with validation and transaction support
     * @param {Object} settingsToUpdate - Object with key-value pairs to update
     * @param {Object} options - Additional options for the update
     * @param {boolean} options.skipValidation - Skip validation (default: false)
     * @param {string} options.auditUser - User making the change for audit log
     * @returns {Promise<Object>} Updated settings object
     */
    async updateSettings(settingsToUpdate, options = {}) {
        try {
            await this._ensureInitialized();

            if (!settingsToUpdate || typeof settingsToUpdate !== 'object') {
                throw new Error('Settings must be provided as an object');
            }

            const { skipValidation = false, auditUser = 'system' } = options;
            const keys = Object.keys(settingsToUpdate);

            if (keys.length === 0) {
                return await this.getSettings();
            }

            // Validate all settings before any updates
            if (!skipValidation) {
                for (const [key, value] of Object.entries(settingsToUpdate)) {
                    await this._validateSetting(key, value);
                }
            }

            // Get current settings for audit log
            const currentSettings = await this.getSettings();
            const changes = [];

            // Prepare type information for batch update
            const types = {};
            for (const key of keys) {
                const schema = this.defaultSchema[key];
                types[key] = schema ? schema.type : 'string';
            }

            // Perform bulk update with transaction
            await this.settingsModel.setMultipleSettings(settingsToUpdate, types);

            // Clear cache after successful update
            this._clearCache();

            // Create audit log entries
            for (const [key, newValue] of Object.entries(settingsToUpdate)) {
                const oldValue = currentSettings[key];
                if (oldValue !== newValue) {
                    changes.push({
                        key,
                        oldValue,
                        newValue,
                        user: auditUser,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            // Add to audit log
            this._addToAuditLog('bulk_update', changes, auditUser);

            // Emit change events
            this.emit('settingsChanged', {
                changes: changes,
                user: auditUser,
                timestamp: new Date().toISOString()
            });

            // Get updated settings to return
            const updatedSettings = await this.getSettings();

            this._log('info', 'Settings updated successfully', {
                changedKeys: changes.map(c => c.key),
                user: auditUser
            });

            return updatedSettings;
        } catch (error) {
            this._log('error', 'Failed to update settings', {
                keys: Object.keys(settingsToUpdate || {}),
                error: error.message
            });
            throw new Error(`Failed to update settings: ${error.message}`);
        }
    }

    /**
     * Update a single setting
     * @param {string} key - Setting key to update
     * @param {any} value - New value for the setting
     * @param {Object} options - Update options
     * @returns {Promise<any>} Updated setting value
     */
    async updateSetting(key, value, options = {}) {
        const settingsToUpdate = { [key]: value };
        await this.updateSettings(settingsToUpdate, options);
        return value;
    }

    /**
     * Reset all settings to their default values
     * @param {Object} options - Reset options
     * @param {string} options.auditUser - User performing the reset
     * @returns {Promise<Object>} Default settings object
     */
    async resetToDefaults(options = {}) {
        try {
            await this._ensureInitialized();

            const { auditUser = 'system' } = options;

            // Get current settings for audit
            const currentSettings = await this.getSettings();

            // Prepare default settings
            const defaultSettings = {};
            for (const [key, schema] of Object.entries(this.defaultSchema)) {
                defaultSettings[key] = schema.default;
            }

            // Update to defaults
            await this.updateSettings(defaultSettings, {
                skipValidation: true,
                auditUser
            });

            // Add specific audit log entry for reset operation
            this._addToAuditLog('reset_to_defaults', {
                previousSettings: currentSettings,
                newSettings: defaultSettings
            }, auditUser);

            this._log('info', 'Settings reset to defaults', { user: auditUser });

            return defaultSettings;
        } catch (error) {
            this._log('error', 'Failed to reset settings to defaults', { error: error.message });
            throw new Error(`Failed to reset settings: ${error.message}`);
        }
    }

    /**
     * Create a backup of current settings
     * @param {string} backupName - Optional name for the backup
     * @returns {Promise<Object>} Backup object with metadata
     */
    async createBackup(backupName = null) {
        try {
            await this._ensureInitialized();

            const settings = await this.getSettings();
            const timestamp = new Date().toISOString();
            const name = backupName || `backup_${timestamp.replace(/[:.]/g, '_')}`;

            const backup = {
                name,
                timestamp,
                version: '1.0',
                settings,
                metadata: {
                    settingCount: Object.keys(settings).length,
                    createdBy: 'settingsService'
                }
            };

            // Store backup in audit log for persistence
            this._addToAuditLog('backup_created', { backupName: name, settingCount: Object.keys(settings).length });

            this.emit('backupCreated', backup);
            this._log('info', 'Settings backup created', { backupName: name });

            return backup;
        } catch (error) {
            this._log('error', 'Failed to create backup', { error: error.message });
            throw new Error(`Failed to create backup: ${error.message}`);
        }
    }

    /**
     * Restore settings from a backup
     * @param {Object} backup - Backup object to restore from
     * @param {Object} options - Restore options
     * @param {string} options.auditUser - User performing the restore
     * @returns {Promise<Object>} Restored settings
     */
    async restoreFromBackup(backup, options = {}) {
        try {
            await this._ensureInitialized();

            if (!backup || !backup.settings) {
                throw new Error('Invalid backup format: missing settings data');
            }

            const { auditUser = 'system' } = options;

            // Validate backup structure
            if (!backup.timestamp || !backup.version) {
                throw new Error('Invalid backup format: missing metadata');
            }

            // Get current settings for audit
            const currentSettings = await this.getSettings();

            // Restore settings
            await this.updateSettings(backup.settings, {
                skipValidation: false,
                auditUser
            });

            // Add audit log entry
            this._addToAuditLog('restore_from_backup', {
                backupName: backup.name,
                backupTimestamp: backup.timestamp,
                previousSettings: currentSettings,
                restoredSettings: backup.settings
            }, auditUser);

            this.emit('settingsRestored', {
                backup: backup.name,
                user: auditUser,
                timestamp: new Date().toISOString()
            });

            this._log('info', 'Settings restored from backup', {
                backupName: backup.name,
                user: auditUser
            });

            return backup.settings;
        } catch (error) {
            this._log('error', 'Failed to restore from backup', { error: error.message });
            throw new Error(`Failed to restore from backup: ${error.message}`);
        }
    }

    /**
     * Get audit log entries
     * @param {Object} filters - Optional filters for audit log
     * @param {number} filters.limit - Maximum number of entries to return
     * @param {string} filters.action - Filter by action type
     * @param {string} filters.user - Filter by user
     * @returns {Array} Audit log entries
     */
    getAuditLog(filters = {}) {
        const { limit = 100, action, user } = filters;

        let entries = [...this.auditLog];

        if (action) {
            entries = entries.filter(entry => entry.action === action);
        }

        if (user) {
            entries = entries.filter(entry => entry.user === user);
        }

        // Sort by timestamp descending (most recent first)
        entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return entries.slice(0, limit);
    }

    /**
     * Clear the settings cache
     */
    clearCache() {
        this._clearCache();
        this.emit('cacheCleared');
        this._log('info', 'Settings cache cleared');
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            timestamps: this.cacheTimestamps.size,
            ttl: this.CACHE_TTL
        };
    }

    // Private methods

    /**
     * Ensure the service is initialized
     * @private
     */
    async _ensureInitialized() {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    /**
     * Get cached settings if still valid
     * @private
     */
    _getCachedSettings() {
        const now = Date.now();
        const cacheKey = 'all_settings';

        if (this.cache.has(cacheKey) && this.cacheTimestamps.has(cacheKey)) {
            const timestamp = this.cacheTimestamps.get(cacheKey);
            if (now - timestamp < this.CACHE_TTL) {
                return this.cache.get(cacheKey);
            } else {
                // Cache expired, remove it
                this.cache.delete(cacheKey);
                this.cacheTimestamps.delete(cacheKey);
            }
        }

        return null;
    }

    /**
     * Set cached settings
     * @private
     */
    _setCachedSettings(settings) {
        const now = Date.now();
        const cacheKey = 'all_settings';

        this.cache.set(cacheKey, { ...settings });
        this.cacheTimestamps.set(cacheKey, now);
    }

    /**
     * Get cached detailed settings if still valid
     * @private
     */
    _getCachedDetailedSettings() {
        const now = Date.now();
        const cacheKey = 'detailed_settings';

        if (this.cache.has(cacheKey) && this.cacheTimestamps.has(cacheKey)) {
            const timestamp = this.cacheTimestamps.get(cacheKey);
            if (now - timestamp < this.CACHE_TTL) {
                return this.cache.get(cacheKey);
            } else {
                // Cache expired, remove it
                this.cache.delete(cacheKey);
                this.cacheTimestamps.delete(cacheKey);
            }
        }

        return null;
    }

    /**
     * Set cached detailed settings
     * @private
     */
    _setCachedDetailedSettings(settings) {
        const now = Date.now();
        const cacheKey = 'detailed_settings';

        this.cache.set(cacheKey, { ...settings });
        this.cacheTimestamps.set(cacheKey, now);
    }

    /**
     * Clear all cache
     * @private
     */
    _clearCache() {
        this.cache.clear();
        this.cacheTimestamps.clear();
    }

    /**
     * Validate setting key format
     * @private
     */
    _validateKey(key) {
        if (!key || typeof key !== 'string') {
            throw new Error('Setting key must be a non-empty string');
        }

        if (!/^[a-zA-Z0-9_]+$/.test(key)) {
            throw new Error('Setting key must contain only alphanumeric characters and underscores');
        }
    }

    /**
     * Validate setting value against schema
     * @private
     */
    async _validateSetting(key, value) {
        this._validateKey(key);

        const schema = this.defaultSchema[key];
        if (!schema) {
            // Allow custom settings, but validate basic types
            return this._validateBasicType(value);
        }

        // Type validation
        if (!this._isValidType(value, schema.type)) {
            throw new Error(`Setting '${key}' must be of type ${schema.type}, got ${typeof value}`);
        }

        // Enum validation
        if (schema.enum && !schema.enum.includes(value)) {
            throw new Error(`Setting '${key}' must be one of: ${schema.enum.join(', ')}`);
        }

        // Range validation for numbers
        if (schema.type === 'number') {
            if (schema.min !== undefined && value < schema.min) {
                throw new Error(`Setting '${key}' must be at least ${schema.min}`);
            }
            if (schema.max !== undefined && value > schema.max) {
                throw new Error(`Setting '${key}' must be at most ${schema.max}`);
            }
        }

        // String length validation
        if (schema.type === 'string') {
            if (schema.minLength !== undefined && value.length < schema.minLength) {
                throw new Error(`Setting '${key}' must be at least ${schema.minLength} characters long`);
            }
            if (schema.maxLength !== undefined && value.length > schema.maxLength) {
                throw new Error(`Setting '${key}' must be at most ${schema.maxLength} characters long`);
            }
        }
    }

    /**
     * Validate basic JavaScript types
     * @private
     */
    _validateBasicType(value) {
        const allowedTypes = ['string', 'number', 'boolean', 'object'];
        const valueType = typeof value;

        if (value === null || value === undefined) {
            return true; // Allow null/undefined values
        }

        if (!allowedTypes.includes(valueType)) {
            throw new Error(`Invalid value type: ${valueType}. Allowed types: ${allowedTypes.join(', ')}`);
        }

        return true;
    }

    /**
     * Check if value matches expected type
     * @private
     */
    _isValidType(value, expectedType) {
        if (value === null || value === undefined) {
            return true;
        }

        switch (expectedType) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'boolean':
                return typeof value === 'boolean';
            case 'json':
                return true; // Any value can be JSON serialized
            default:
                return false;
        }
    }

    /**
     * Add entry to audit log
     * @private
     */
    _addToAuditLog(action, data, user = 'system') {
        const entry = {
            id: Date.now() + Math.random(), // Simple unique ID
            action,
            data,
            user,
            timestamp: new Date().toISOString()
        };

        this.auditLog.unshift(entry);

        // Keep only last 1000 entries to prevent memory issues
        if (this.auditLog.length > 1000) {
            this.auditLog = this.auditLog.slice(0, 1000);
        }
    }

    /**
     * Perform settings migrations for version updates
     * @private
     */
    async performMigrations() {
        try {
            // Get current settings to check what migrations are needed
            const currentSettings = await this.settingsModel.getAllSettings();
            const currentKeys = Object.keys(currentSettings);
            const schemaKeys = Object.keys(this.defaultSchema);

            // Add missing settings with defaults
            const missingKeys = schemaKeys.filter(key => !currentKeys.includes(key));

            if (missingKeys.length > 0) {
                const newSettings = {};
                const types = {};

                for (const key of missingKeys) {
                    const schema = this.defaultSchema[key];
                    newSettings[key] = schema.default;
                    types[key] = schema.type;
                }

                await this.settingsModel.setMultipleSettings(newSettings, types);

                this._addToAuditLog('migration', {
                    addedSettings: missingKeys,
                    version: '1.0'
                });

                this._log('info', 'Settings migration completed', { addedKeys: missingKeys });
            }
        } catch (error) {
            this._log('error', 'Settings migration failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Internal logging method
     * @private
     */
    _log(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            service: 'SettingsService',
            message,
            ...data
        };

        // In a production environment, this would integrate with a proper logging system
        console.log(`[${timestamp}] ${level.toUpperCase()} - SettingsService: ${message}`, data);

        // Emit log event for potential external logging systems
        this.emit('log', logEntry);
    }
}

// Export singleton instance
module.exports = new SettingsService();