/**
 * @fileoverview Module Interface Definition for AWS Inspector Report Tool
 *
 * Defines the standard contract that all modules must implement to ensure
 * consistency, interoperability, and proper lifecycle management across
 * the application's modular architecture.
 *
 * @author AWS Inspector Report Tool
 * @version 1.0.0
 */

/**
 * @typedef {Object} ModuleConfig
 * @property {string} id - Unique module identifier
 * @property {string} name - Human-readable module name
 * @property {string} description - Module description
 * @property {string} version - Module version (semver format)
 * @property {boolean} [enabled=true] - Whether module is enabled by default
 * @property {Object} [settings={}] - Module-specific settings
 */

/**
 * @typedef {Object} ModuleMetadata
 * @property {string} id - Unique module identifier (required)
 * @property {string} name - Human-readable module name (required)
 * @property {string} description - Module description (required)
 * @property {string} version - Module version in semver format (required)
 * @property {string} [icon] - Font Awesome icon class or path to icon
 * @property {boolean} [defaultEnabled=true] - Whether module is enabled by default
 * @property {string[]} [dependencies=[]] - Array of module IDs this module depends on
 * @property {string[]} [tags=[]] - Tags for categorization and filtering
 * @property {string} [author] - Module author information
 * @property {string} [license] - Module license
 * @property {Object} [urls] - Related URLs (homepage, repository, issues)
 */

/**
 * @typedef {Object} ModuleLifecycleHooks
 * @property {Function} onInit - Called during module initialization
 * @property {Function} onStart - Called when module is started/enabled
 * @property {Function} onStop - Called when module is stopped/disabled
 * @property {Function} onDestroy - Called during module cleanup/unload
 * @property {Function} onConfigChange - Called when module configuration changes
 */

/**
 * @typedef {Object} TabContent
 * @property {string} title - Tab title
 * @property {string} content - HTML content for the tab
 * @property {Object} [data] - Additional data for the tab
 * @property {boolean} [active=false] - Whether this tab should be active by default
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string[]} errors - Array of validation error messages
 * @property {string[]} warnings - Array of validation warning messages
 */

/**
 * Standard Module Interface
 *
 * All modules must implement this interface to be compatible with the
 * AWS Inspector Report Tool module system.
 */
class ModuleInterface {
    /**
     * Create a new module instance
     * @param {ModuleConfig} config - Module configuration
     */
    constructor(config) {
        if (new.target === ModuleInterface) {
            throw new Error('ModuleInterface is an abstract class and cannot be instantiated directly');
        }

        this.validateConfig(config);
        this._config = { ...config };
        this._initialized = false;
        this._started = false;
        this._database = null;
        this._router = null;
        this._hooks = {};
    }

    // ================================
    // REQUIRED PROPERTIES
    // ================================

    /**
     * Module metadata (required)
     * @type {ModuleMetadata}
     */
    get metadata() {
        throw new Error('metadata getter must be implemented by subclass');
    }

    /**
     * Express router instance (required)
     * @type {import('express').Router}
     */
    get router() {
        if (!this._router) {
            throw new Error('Router not initialized. Call initialize() first.');
        }
        return this._router;
    }

    // ================================
    // REQUIRED METHODS
    // ================================

    /**
     * Initialize the module with database connection
     * @param {Database} database - Database instance
     * @returns {Promise<void>}
     */
    async initialize(database) {
        if (this._initialized) {
            throw new Error(`Module ${this.metadata.id} is already initialized`);
        }

        try {
            this._database = database;
            await this._createRouter();
            await this._runHook('onInit', { database });
            this._initialized = true;
        } catch (error) {
            throw new Error(`Failed to initialize module ${this.metadata.id}: ${error.message}`);
        }
    }

    /**
     * Get tab content for the dashboard
     * @param {Object} [context={}] - Additional context data
     * @returns {Promise<TabContent>}
     */
    async getTabContent(context = {}) {
        throw new Error('getTabContent method must be implemented by subclass');
    }

    /**
     * Get current module configuration
     * @returns {ModuleConfig}
     */
    getConfig() {
        return { ...this._config };
    }

    /**
     * Validate module configuration
     * @param {ModuleConfig} config - Configuration to validate
     * @returns {ValidationResult}
     */
    validateConfig(config) {
        const errors = [];
        const warnings = [];

        // Required fields validation
        if (!config || typeof config !== 'object') {
            errors.push('Config must be a valid object');
            return { valid: false, errors, warnings };
        }

        const requiredFields = ['id', 'name', 'description', 'version'];
        for (const field of requiredFields) {
            if (!config[field] || typeof config[field] !== 'string') {
                errors.push(`Missing or invalid required field: ${field}`);
            }
        }

        // Version format validation (basic semver check)
        if (config.version && !/^\d+\.\d+\.\d+/.test(config.version)) {
            warnings.push('Version should follow semver format (x.y.z)');
        }

        // ID format validation
        if (config.id && !/^[a-z0-9-_]+$/.test(config.id)) {
            errors.push('Module ID must contain only lowercase letters, numbers, hyphens, and underscores');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    // ================================
    // LIFECYCLE METHODS
    // ================================

    /**
     * Start the module (enable functionality)
     * @returns {Promise<void>}
     */
    async start() {
        if (!this._initialized) {
            throw new Error(`Module ${this.metadata.id} must be initialized before starting`);
        }
        if (this._started) {
            return; // Already started
        }

        try {
            await this._runHook('onStart');
            this._started = true;
        } catch (error) {
            throw new Error(`Failed to start module ${this.metadata.id}: ${error.message}`);
        }
    }

    /**
     * Stop the module (disable functionality)
     * @returns {Promise<void>}
     */
    async stop() {
        if (!this._started) {
            return; // Already stopped
        }

        try {
            await this._runHook('onStop');
            this._started = false;
        } catch (error) {
            throw new Error(`Failed to stop module ${this.metadata.id}: ${error.message}`);
        }
    }

    /**
     * Destroy the module and cleanup resources
     * @returns {Promise<void>}
     */
    async destroy() {
        try {
            if (this._started) {
                await this.stop();
            }
            await this._runHook('onDestroy');
            this._database = null;
            this._router = null;
            this._initialized = false;
        } catch (error) {
            throw new Error(`Failed to destroy module ${this.metadata.id}: ${error.message}`);
        }
    }

    // ================================
    // OPTIONAL METHODS
    // ================================

    /**
     * Update module configuration
     * @param {Partial<ModuleConfig>} newConfig - New configuration values
     * @returns {Promise<void>}
     */
    async updateConfig(newConfig) {
        const mergedConfig = { ...this._config, ...newConfig };
        const validation = this.validateConfig(mergedConfig);

        if (!validation.valid) {
            throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
        }

        const oldConfig = { ...this._config };
        this._config = mergedConfig;

        try {
            await this._runHook('onConfigChange', { oldConfig, newConfig: this._config });
        } catch (error) {
            // Rollback on error
            this._config = oldConfig;
            throw error;
        }
    }

    /**
     * Get module health status
     * @returns {Promise<Object>}
     */
    async getHealthStatus() {
        return {
            id: this.metadata.id,
            initialized: this._initialized,
            started: this._started,
            status: this._started ? 'running' : 'stopped',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get module metrics/statistics
     * @returns {Promise<Object>}
     */
    async getMetrics() {
        return {
            id: this.metadata.id,
            uptime: this._started ? Date.now() - this._startTime : 0,
            requests: 0, // Override in subclass if tracking requests
            errors: 0    // Override in subclass if tracking errors
        };
    }

    // ================================
    // PROTECTED METHODS
    // ================================

    /**
     * Create Express router for the module
     * @protected
     * @returns {Promise<void>}
     */
    async _createRouter() {
        const express = require('express');
        this._router = express.Router();

        // Default health check endpoint
        this._router.get('/health', async (req, res) => {
            try {
                const health = await this.getHealthStatus();
                res.json(health);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    /**
     * Register a lifecycle hook
     * @protected
     * @param {string} hookName - Name of the hook
     * @param {Function} hookFunction - Function to execute
     */
    _registerHook(hookName, hookFunction) {
        if (typeof hookFunction !== 'function') {
            throw new Error(`Hook ${hookName} must be a function`);
        }
        this._hooks[hookName] = hookFunction;
    }

    /**
     * Run a lifecycle hook if it exists
     * @protected
     * @param {string} hookName - Name of the hook to run
     * @param {Object} [data={}] - Data to pass to the hook
     * @returns {Promise<any>}
     */
    async _runHook(hookName, data = {}) {
        if (this._hooks[hookName]) {
            return await this._hooks[hookName].call(this, data);
        }
    }

    // ================================
    // GETTERS
    // ================================

    /**
     * Check if module is initialized
     * @returns {boolean}
     */
    get isInitialized() {
        return this._initialized;
    }

    /**
     * Check if module is started
     * @returns {boolean}
     */
    get isStarted() {
        return this._started;
    }

    /**
     * Get database instance
     * @returns {Database|null}
     */
    get database() {
        return this._database;
    }
}

// ================================
// VALIDATION FUNCTIONS
// ================================

/**
 * Validate that an object implements the ModuleInterface
 * @param {Object} moduleInstance - Module instance to validate
 * @returns {ValidationResult}
 */
function validateModuleInterface(moduleInstance) {
    const errors = [];
    const warnings = [];

    if (!moduleInstance || typeof moduleInstance !== 'object') {
        errors.push('Module must be a valid object');
        return { valid: false, errors, warnings };
    }

    // Check required properties
    const requiredProperties = ['metadata'];
    for (const prop of requiredProperties) {
        if (!(prop in moduleInstance)) {
            errors.push(`Missing required property: ${prop}`);
        }
    }

    // Check required methods
    const requiredMethods = [
        'initialize', 'getTabContent', 'getConfig', 'validateConfig',
        'start', 'stop', 'destroy'
    ];
    for (const method of requiredMethods) {
        if (typeof moduleInstance[method] !== 'function') {
            errors.push(`Missing or invalid required method: ${method}`);
        }
    }

    // Check metadata structure
    if (moduleInstance.metadata) {
        const metadataValidation = validateModuleMetadata(moduleInstance.metadata);
        errors.push(...metadataValidation.errors);
        warnings.push(...metadataValidation.warnings);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Validate module metadata
 * @param {ModuleMetadata} metadata - Metadata to validate
 * @returns {ValidationResult}
 */
function validateModuleMetadata(metadata) {
    const errors = [];
    const warnings = [];

    if (!metadata || typeof metadata !== 'object') {
        errors.push('Metadata must be a valid object');
        return { valid: false, errors, warnings };
    }

    const requiredFields = ['id', 'name', 'description', 'version'];
    for (const field of requiredFields) {
        if (!metadata[field] || typeof metadata[field] !== 'string') {
            errors.push(`Missing or invalid metadata field: ${field}`);
        }
    }

    // Validate optional arrays
    const arrayFields = ['dependencies', 'tags'];
    for (const field of arrayFields) {
        if (metadata[field] && !Array.isArray(metadata[field])) {
            errors.push(`Metadata field ${field} must be an array`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Create a basic module template
 * @param {ModuleMetadata} metadata - Module metadata
 * @returns {string} Module template code
 */
function createModuleTemplate(metadata) {
    return `/**
 * ${metadata.name} Module
 * ${metadata.description}
 *
 * @version ${metadata.version}
 * @author ${metadata.author || 'Unknown'}
 */

const { ModuleInterface } = require('./ModuleInterface');

class ${metadata.name.replace(/[^a-zA-Z0-9]/g, '')}Module extends ModuleInterface {
    constructor(config = {}) {
        super({
            id: '${metadata.id}',
            name: '${metadata.name}',
            description: '${metadata.description}',
            version: '${metadata.version}',
            ...config
        });
    }

    get metadata() {
        return {
            id: '${metadata.id}',
            name: '${metadata.name}',
            description: '${metadata.description}',
            version: '${metadata.version}',
            defaultEnabled: true,
            dependencies: [],
            tags: []
        };
    }

    async getTabContent(context = {}) {
        return {
            title: '${metadata.name}',
            content: '<div class="module-content"><h3>${metadata.name}</h3><p>${metadata.description}</p></div>',
            data: {},
            active: false
        };
    }

    async _createRouter() {
        await super._createRouter();

        // Add module-specific routes here
        this._router.get('/', (req, res) => {
            res.json({ message: '${metadata.name} module is running' });
        });
    }
}

module.exports = ${metadata.name.replace(/[^a-zA-Z0-9]/g, '')}Module;
`;
}

// ================================
// EXPORTS
// ================================

module.exports = {
    ModuleInterface,
    validateModuleInterface,
    validateModuleMetadata,
    createModuleTemplate
};