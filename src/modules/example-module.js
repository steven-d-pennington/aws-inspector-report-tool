/**
 * Example Module
 * Demonstrates the module registry and loader system
 */

const moduleDefinition = {
    id: 'example-module',
    name: 'Example Module',
    version: '1.0.0',
    description: 'A demonstration module showing module registry capabilities',

    // Configuration
    config: {
        enabled: true,
        routePrefix: '/example',
        settings: {
            maxRequestsPerMinute: 60,
            enableLogging: true
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
                    message: 'Hello from Example Module',
                    moduleId: 'example-module',
                    timestamp: new Date().toISOString(),
                    context: req.moduleContext
                });
            }
        },
        '/status': {
            method: 'GET',
            handler: (req, res) => {
                res.json({
                    status: 'active',
                    moduleId: 'example-module',
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    requests: req.moduleContext ? 'context-available' : 'no-context'
                });
            }
        },
        '/config': {
            method: 'GET',
            handler: (req, res) => {
                const moduleRegistry = require('./moduleRegistry');
                const module = moduleRegistry.getModule('example-module');

                res.json({
                    config: module ? module.config : null,
                    moduleState: module ? module.state : 'not-found'
                });
            }
        },
        '/test': {
            method: 'POST',
            middleware: [(req, res, next) => {
                req.testData = { processed: true, timestamp: new Date() };
                next();
            }],
            handler: (req, res) => {
                res.json({
                    message: 'POST request processed',
                    body: req.body,
                    testData: req.testData,
                    moduleContext: req.moduleContext
                });
            }
        }
    },

    // Module middleware (applied to all routes)
    middleware: [
        (req, res, next) => {
            // Add custom header
            res.set('X-Module-Id', 'example-module');
            res.set('X-Module-Version', '1.0.0');
            next();
        }
    ],

    // Module API exports (for other modules to use)
    exports: {
        /**
         * Get module information
         * @returns {Object} Module info
         */
        getInfo: () => ({
            id: 'example-module',
            name: moduleDefinition.name,
            version: moduleDefinition.version,
            description: moduleDefinition.description
        }),

        /**
         * Process some data
         * @param {any} data - Data to process
         * @returns {Object} Processed result
         */
        processData: (data) => ({
            originalData: data,
            processedAt: new Date(),
            processedBy: 'example-module',
            result: `Processed: ${JSON.stringify(data)}`
        }),

        /**
         * Get module statistics
         * @returns {Object} Module stats
         */
        getStats: () => {
            const moduleRegistry = require('./moduleRegistry');
            const module = moduleRegistry.getModule('example-module');

            return {
                moduleId: 'example-module',
                state: module ? module.state : 'unknown',
                statistics: module ? module.statistics : null,
                lastAccess: module ? module.statistics.lastAccess : null
            };
        }
    },

    // Lifecycle hooks
    hooks: {
        /**
         * Called when module is loaded and registered
         */
        init: async function() {
            console.log(`🚀 Module ${this.name} (${this.id}) initialized successfully`);

            // Initialize module resources
            this._startTime = new Date();
            this._requestCount = 0;

            // Set up periodic statistics logging
            this._statsInterval = setInterval(() => {
                if (this.config.settings.enableLogging) {
                    console.log(`📊 ${this.name} stats: ${this._requestCount} requests since startup`);
                }
            }, 60000); // Log every minute
        },

        /**
         * Called when module is being unloaded
         */
        cleanup: async function() {
            console.log(`🧹 Module ${this.name} (${this.id}) cleaning up...`);

            // Clean up resources
            if (this._statsInterval) {
                clearInterval(this._statsInterval);
            }

            console.log(`✅ Module ${this.name} cleaned up successfully`);
        }
    },

    // Module metadata
    metadata: {
        author: 'AWS Inspector Report Tool',
        license: 'MIT',
        keywords: ['aws-inspector', 'example', 'demo', 'module'],
        homepage: 'https://github.com/your-repo/aws-inspector-report-tool',
        repository: 'https://github.com/your-repo/aws-inspector-report-tool',
        documentation: 'This is an example module demonstrating the module registry system',
        category: 'example',
        tags: ['demo', 'template']
    }
};

module.exports = moduleDefinition;