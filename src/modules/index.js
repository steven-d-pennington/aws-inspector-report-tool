/**
 * Module System Index
 * Exports all module system components for easy import
 */

const moduleRegistry = require('./moduleRegistry');
const moduleLoader = require('./moduleLoader');
const RouterIntegration = require('./routerIntegration');

/**
 * Initialize the module system with Express app
 * @param {Object} expressApp - Express application instance
 * @returns {Object} Initialized module system components
 */
function initializeModuleSystem(expressApp) {
    // Create router integration instance
    const routerIntegration = new RouterIntegration(expressApp);

    // Set up error handling for module system
    moduleRegistry.on('error', (error) => {
        console.error('Module Registry Error:', error);
    });

    moduleLoader.on('error', (error) => {
        console.error('Module Loader Error:', error);
    });

    // Register cleanup on process exit
    process.on('SIGINT', async () => {
        console.log('Shutting down module system...');

        try {
            // Stop all file watchers
            const stoppedWatchers = moduleLoader.stopAllWatching();
            console.log(`Stopped ${stoppedWatchers} file watchers`);

            // Clear registry (this will trigger cleanup hooks)
            const clearResult = await moduleRegistry.clearRegistry(true);
            console.log(`Cleared ${clearResult.cleared.length} modules from registry`);

        } catch (error) {
            console.error('Error during module system shutdown:', error);
        }
    });

    return {
        registry: moduleRegistry,
        loader: moduleLoader,
        router: routerIntegration
    };
}

/**
 * Quick start helper for loading modules from directory
 * @param {Object} expressApp - Express application instance
 * @param {string} modulesDirectory - Directory containing modules
 * @param {Object} options - Loading options
 * @returns {Promise<Object>} Load results
 */
async function quickStartModules(expressApp, modulesDirectory, options = {}) {
    // Initialize module system
    const moduleSystem = initializeModuleSystem(expressApp);

    try {
        // Load modules from directory
        const loadResults = await moduleSystem.loader.loadFromDirectory(modulesDirectory, {
            watch: options.watch || false,
            reload: options.reload || false,
            ...options
        });

        // Register routes for all loaded modules
        const routeResults = await moduleSystem.router.registerAllActiveModules();

        return {
            moduleSystem,
            loadResults,
            routeResults,
            stats: {
                totalModules: moduleSystem.registry.getRegistryStats().totalModules,
                totalRoutes: Object.keys(moduleSystem.router.getAllRegisteredRoutes()).length
            }
        };

    } catch (error) {
        console.error('Failed to quick start modules:', error);
        throw error;
    }
}

/**
 * Create a simple module definition helper
 * @param {Object} moduleConfig - Basic module configuration
 * @returns {Object} Complete module definition
 */
function createModule(moduleConfig) {
    const {
        id,
        name,
        version = '1.0.0',
        description = '',
        routes = {},
        config = {},
        dependencies = [],
        middleware = [],
        hooks = {},
        exports: moduleExports = {},
        metadata = {}
    } = moduleConfig;

    // Validate required fields
    if (!id || !name) {
        throw new Error('Module must have id and name');
    }

    return {
        id,
        name,
        version,
        description,
        config: {
            enabled: true,
            ...config
        },
        dependencies,
        routes,
        middleware,
        exports: moduleExports,
        hooks: {
            init: async function() {
                console.log(`Module ${this.name} (${this.id}) initialized`);
            },
            cleanup: async function() {
                console.log(`Module ${this.name} (${this.id}) cleaned up`);
            },
            ...hooks
        },
        metadata: {
            author: 'Unknown',
            license: 'MIT',
            keywords: [],
            ...metadata,
            createdAt: new Date()
        }
    };
}

/**
 * Module system utilities
 */
const moduleUtils = {
    /**
     * Validate module definition
     * @param {Object} module - Module to validate
     * @returns {Object} Validation result
     */
    validateModule: (module) => {
        const errors = [];
        const warnings = [];

        if (!module.id) errors.push('Missing module ID');
        if (!module.name) errors.push('Missing module name');
        if (typeof module.routes !== 'object') warnings.push('Routes should be an object');
        if (module.dependencies && !Array.isArray(module.dependencies)) {
            warnings.push('Dependencies should be an array');
        }

        return { isValid: errors.length === 0, errors, warnings };
    },

    /**
     * Generate module template files
     * @param {string} moduleId - Module ID
     * @param {string} outputDir - Output directory
     * @returns {Promise<Object>} Generation result
     */
    generateModuleTemplate: async (moduleId, outputDir) => {
        const fs = require('fs').promises;
        const path = require('path');

        const template = `/**
 * ${moduleId} Module
 * Generated module template
 */

const moduleDefinition = {
    id: '${moduleId}',
    name: '${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)} Module',
    version: '1.0.0',
    description: 'A dynamically loaded module',

    // Configuration
    config: {
        enabled: true,
        settings: {
            // Module-specific settings
        }
    },

    // Dependencies on other modules
    dependencies: [],

    // Express routes
    routes: {
        '/': {
            method: 'GET',
            handler: (req, res) => {
                res.json({
                    message: 'Hello from ${moduleId} module',
                    moduleId: '${moduleId}',
                    timestamp: new Date().toISOString()
                });
            }
        },
        '/status': {
            method: 'GET',
            handler: (req, res) => {
                res.json({
                    status: 'active',
                    moduleId: '${moduleId}',
                    uptime: process.uptime()
                });
            }
        }
    },

    // Module API exports
    exports: {
        // Public methods that other modules can use
        getInfo: () => ({
            id: '${moduleId}',
            name: moduleDefinition.name,
            version: moduleDefinition.version
        })
    },

    // Lifecycle hooks
    hooks: {
        init: async function() {
            console.log(\`Module \${this.name} initialized\`);
            // Initialize module resources
        },

        cleanup: async function() {
            console.log(\`Module \${this.name} cleaned up\`);
            // Clean up module resources
        }
    },

    // Module metadata
    metadata: {
        author: 'Module Developer',
        license: 'MIT',
        keywords: ['aws-inspector', 'module', '${moduleId}'],
        homepage: '',
        repository: ''
    }
};

module.exports = moduleDefinition;
`;

        const filePath = path.join(outputDir, `${moduleId}.js`);
        await fs.writeFile(filePath, template, 'utf8');

        return {
            success: true,
            filePath,
            moduleId
        };
    },

    /**
     * Get module system health check
     * @param {Object} moduleSystem - Module system instance
     * @returns {Object} Health check result
     */
    healthCheck: (moduleSystem) => {
        const registryStats = moduleSystem.registry.getRegistryStats();
        const loaderStats = moduleSystem.loader.getLoaderStats();
        const routerStats = moduleSystem.router.getIntegrationStats();

        return {
            healthy: true,
            timestamp: new Date(),
            registry: {
                totalModules: registryStats.totalModules,
                modulesByState: registryStats.modulesByState,
                uptime: registryStats.uptime
            },
            loader: {
                loadedPaths: loaderStats.totalLoaded,
                activeWatchers: loaderStats.activeWatchers
            },
            router: {
                registeredModules: routerStats.totalRegisteredModules,
                totalRoutes: Object.values(routerStats.routesByModule).reduce((sum, count) => sum + count, 0)
            }
        };
    }
};

module.exports = {
    // Core components
    moduleRegistry,
    moduleLoader,
    RouterIntegration,

    // Helper functions
    initializeModuleSystem,
    quickStartModules,
    createModule,

    // Utilities
    moduleUtils
};