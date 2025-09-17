const express = require('express');

/**
 * Example Module - Demonstrates the module interface contract
 * This module serves as a template for creating new modules
 */

// Module configuration
const moduleConfig = {
    id: 'example-module',
    name: 'Example Module',
    description: 'A sample module demonstrating the module interface',
    version: '1.0.0',
};

/**
 * Initialize the module
 * This function is called when the module is loaded
 * @returns {Promise<Object>} Module initialization result
 */
async function initialize() {
    console.log(`[${moduleConfig.name}] Initializing module`);

    // Create Express router for this module
    const router = express.Router();

    // Define module routes
    router.get('/', (req, res) => {
        res.json({
            message: `Welcome to ${moduleConfig.name}`,
            version: moduleConfig.version,
            timestamp: new Date().toISOString()
        });
    });

    router.get('/status', (req, res) => {
        res.json({
            status: 'healthy',
            module: moduleConfig.name,
            uptime: process.uptime()
        });
    });

    // Simulate some async initialization work
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log(`[${moduleConfig.name}] Module initialized successfully`);

    return {
        router,
        status: 'initialized'
    };
}

/**
 * Get tab content for the module (used in tabbed interface)
 * @param {Object} context - Context object with request information
 * @returns {Promise<Object>} Tab content data
 */
async function getTabContent(context = {}) {
    return {
        title: moduleConfig.name,
        content: `<div class="module-content">
            <h2>${moduleConfig.name}</h2>
            <p>${moduleConfig.description}</p>
            <p>Version: ${moduleConfig.version}</p>
            <p>Status: Active</p>
            <div class="module-actions">
                <button onclick="refreshModule()" class="btn btn-primary">Refresh</button>
            </div>
        </div>`,
        scripts: [
            'function refreshModule() { console.log("Refreshing example module"); }'
        ]
    };
}

/**
 * Get module configuration schema and current values
 * @returns {Promise<Object>} Configuration schema and values
 */
async function getConfig() {
    return {
        schema: {
            enableNotifications: {
                type: 'boolean',
                default: true,
                description: 'Enable notifications for this module'
            },
            refreshInterval: {
                type: 'number',
                default: 30,
                min: 10,
                max: 300,
                description: 'Auto-refresh interval in seconds'
            },
            displayMode: {
                type: 'string',
                enum: ['compact', 'detailed'],
                default: 'detailed',
                description: 'Display mode for module content'
            }
        },
        current: {
            enableNotifications: true,
            refreshInterval: 30,
            displayMode: 'detailed'
        }
    };
}

/**
 * Validate module configuration
 * @param {Object} config - Configuration to validate
 * @returns {Promise<Object>} Validation result
 */
async function validateConfig(config) {
    const errors = [];
    const warnings = [];

    if (config.refreshInterval && (config.refreshInterval < 10 || config.refreshInterval > 300)) {
        errors.push('refreshInterval must be between 10 and 300 seconds');
    }

    if (config.displayMode && !['compact', 'detailed'].includes(config.displayMode)) {
        errors.push('displayMode must be either "compact" or "detailed"');
    }

    if (config.enableNotifications && typeof config.enableNotifications !== 'boolean') {
        warnings.push('enableNotifications should be a boolean value');
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Cleanup function called when module is unloaded
 * @returns {Promise<void>}
 */
async function cleanup() {
    console.log(`[${moduleConfig.name}] Cleaning up module resources`);
    // Perform any necessary cleanup (close connections, clear timers, etc.)
    // This is important for hot reloading in development
}

// Export the module interface
module.exports = {
    // Required properties
    id: moduleConfig.id,
    name: moduleConfig.name,
    initialize,

    // Optional properties
    description: moduleConfig.description,
    version: moduleConfig.version,
    getTabContent,
    getConfig,
    validateConfig,
    cleanup
};