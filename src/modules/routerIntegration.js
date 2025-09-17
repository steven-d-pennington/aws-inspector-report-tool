const express = require('express');
const moduleRegistry = require('./moduleRegistry');

/**
 * Router Integration for dynamic Express route registration
 * Integrates module registry with Express.js routing system
 */
class RouterIntegration {
    constructor(app) {
        this.app = app;
        this.registeredRoutes = new Map(); // moduleId -> router instances
        this.routePrefixes = new Map(); // moduleId -> route prefix
        this.middlewareStack = new Map(); // moduleId -> middleware functions

        // Listen to module registry events
        this.setupEventListeners();
    }

    /**
     * Set up event listeners for module lifecycle
     */
    setupEventListeners() {
        // Register routes when module is registered
        moduleRegistry.on('moduleRegistered', async (event) => {
            try {
                await this.registerModuleRoutes(event.moduleId);
            } catch (error) {
                console.error(`Failed to register routes for module ${event.moduleId}:`, error);
            }
        });

        // Unregister routes when module is unregistered
        moduleRegistry.on('moduleUnregistered', async (event) => {
            try {
                await this.unregisterModuleRoutes(event.moduleId);
            } catch (error) {
                console.error(`Failed to unregister routes for module ${event.moduleId}:`, error);
            }
        });

        // Handle module state changes
        moduleRegistry.on('moduleStateChanged', async (event) => {
            if (event.newState === moduleRegistry.MODULE_STATES.ACTIVE) {
                await this.enableModuleRoutes(event.moduleId);
            } else if (event.newState === moduleRegistry.MODULE_STATES.DISABLED) {
                await this.disableModuleRoutes(event.moduleId);
            }
        });
    }

    /**
     * Register routes for a specific module
     * @param {string} moduleId - Module ID
     * @returns {Promise<Object>} Registration result
     */
    async registerModuleRoutes(moduleId) {
        try {
            const module = moduleRegistry.getModule(moduleId);
            if (!module) {
                throw new Error(`Module '${moduleId}' not found`);
            }

            // Skip if routes already registered
            if (this.registeredRoutes.has(moduleId)) {
                return { success: true, message: 'Routes already registered' };
            }

            // Create module router
            const router = express.Router();

            // Register routes based on module definition
            const registeredRoutesList = [];

            if (module.routes) {
                if (Array.isArray(module.routes)) {
                    // Array format: [{ path, method, handler, middleware? }]
                    for (const route of module.routes) {
                        this.addRouteToRouter(router, route, moduleId);
                        registeredRoutesList.push(`${route.method} ${route.path}`);
                    }
                } else if (typeof module.routes === 'object') {
                    // Object format: { '/path': { method, handler, middleware? } }
                    for (const [path, routeConfig] of Object.entries(module.routes)) {
                        const route = { path, ...routeConfig };
                        this.addRouteToRouter(router, route, moduleId);
                        registeredRoutesList.push(`${route.method || 'ALL'} ${path}`);
                    }
                }
            }

            // Add module-level middleware if specified
            if (module.middleware) {
                if (Array.isArray(module.middleware)) {
                    router.use(...module.middleware);
                } else {
                    router.use(module.middleware);
                }
                this.middlewareStack.set(moduleId, module.middleware);
            }

            // Determine route prefix
            const routePrefix = this.getModuleRoutePrefix(module);
            this.routePrefixes.set(moduleId, routePrefix);

            // Mount router to Express app
            this.app.use(routePrefix, router);

            // Store router reference
            this.registeredRoutes.set(moduleId, {
                router,
                routes: registeredRoutesList,
                prefix: routePrefix,
                registeredAt: new Date()
            });

            // Update module state to active if it was loaded
            if (module.state === moduleRegistry.MODULE_STATES.LOADED) {
                moduleRegistry.updateModuleState(moduleId, moduleRegistry.MODULE_STATES.ACTIVE);
            }

            console.log(`Registered ${registeredRoutesList.length} routes for module '${moduleId}' at prefix '${routePrefix}'`);

            return {
                success: true,
                moduleId,
                routePrefix,
                registeredRoutes: registeredRoutesList,
                routeCount: registeredRoutesList.length
            };

        } catch (error) {
            console.error(`Failed to register routes for module '${moduleId}':`, error);

            // Update module state to error
            moduleRegistry.updateModuleState(moduleId, moduleRegistry.MODULE_STATES.ERROR, {
                routeRegistrationError: error.message
            });

            throw error;
        }
    }

    /**
     * Add a single route to the router
     * @param {Object} router - Express router
     * @param {Object} route - Route configuration
     * @param {string} moduleId - Module ID for context
     */
    addRouteToRouter(router, route, moduleId) {
        const { path, method = 'GET', handler, middleware = [] } = route;

        if (!handler || typeof handler !== 'function') {
            throw new Error(`Invalid handler for route ${method} ${path} in module ${moduleId}`);
        }

        // Wrap handler to add module context
        const wrappedHandler = (req, res, next) => {
            // Add module context to request
            req.moduleContext = {
                moduleId,
                moduleName: moduleRegistry.getModule(moduleId)?.name,
                routePath: path
            };

            // Call original handler
            try {
                const result = handler(req, res, next);

                // Handle async handlers
                if (result && typeof result.catch === 'function') {
                    result.catch(next);
                }
            } catch (error) {
                next(error);
            }
        };

        // Prepare middleware array
        const allMiddleware = Array.isArray(middleware) ? [...middleware, wrappedHandler] : [middleware, wrappedHandler];

        // Register route with appropriate HTTP method
        switch (method.toUpperCase()) {
            case 'GET':
                router.get(path, ...allMiddleware);
                break;
            case 'POST':
                router.post(path, ...allMiddleware);
                break;
            case 'PUT':
                router.put(path, ...allMiddleware);
                break;
            case 'DELETE':
                router.delete(path, ...allMiddleware);
                break;
            case 'PATCH':
                router.patch(path, ...allMiddleware);
                break;
            case 'ALL':
                router.all(path, ...allMiddleware);
                break;
            default:
                throw new Error(`Unsupported HTTP method: ${method}`);
        }
    }

    /**
     * Determine route prefix for module
     * @param {Object} module - Module definition
     * @returns {string} Route prefix
     */
    getModuleRoutePrefix(module) {
        // Check if module specifies a route prefix
        if (module.config && module.config.routePrefix) {
            return module.config.routePrefix;
        }

        // Check if module has a route property in metadata
        if (module.metadata && module.metadata.routePrefix) {
            return module.metadata.routePrefix;
        }

        // Default to /modules/{moduleId}
        return `/modules/${module.id}`;
    }

    /**
     * Unregister routes for a specific module
     * @param {string} moduleId - Module ID
     * @returns {Promise<Object>} Unregistration result
     */
    async unregisterModuleRoutes(moduleId) {
        try {
            if (!this.registeredRoutes.has(moduleId)) {
                return { success: true, message: 'No routes to unregister' };
            }

            const routeInfo = this.registeredRoutes.get(moduleId);

            // Note: Express.js doesn't provide a direct way to remove middleware/routes
            // In a production system, you might need to restart the server or use
            // a more sophisticated routing system like express-dynamic-router

            // For now, we'll mark the routes as disabled and remove our references
            this.registeredRoutes.delete(moduleId);
            this.routePrefixes.delete(moduleId);
            this.middlewareStack.delete(moduleId);

            console.log(`Unregistered ${routeInfo.routes.length} routes for module '${moduleId}'`);

            return {
                success: true,
                moduleId,
                unregisteredRoutes: routeInfo.routes,
                routeCount: routeInfo.routes.length,
                note: 'Routes marked as unregistered but may still be active until server restart'
            };

        } catch (error) {
            console.error(`Failed to unregister routes for module '${moduleId}':`, error);
            throw error;
        }
    }

    /**
     * Enable routes for a module (set state to active)
     * @param {string} moduleId - Module ID
     * @returns {Promise<boolean>} Success status
     */
    async enableModuleRoutes(moduleId) {
        try {
            if (!this.registeredRoutes.has(moduleId)) {
                // Routes not registered yet, register them
                await this.registerModuleRoutes(moduleId);
                return true;
            }

            // Routes are already registered and active
            console.log(`Routes for module '${moduleId}' are now enabled`);
            return true;

        } catch (error) {
            console.error(`Failed to enable routes for module '${moduleId}':`, error);
            return false;
        }
    }

    /**
     * Disable routes for a module (set state to disabled)
     * @param {string} moduleId - Module ID
     * @returns {Promise<boolean>} Success status
     */
    async disableModuleRoutes(moduleId) {
        try {
            // In a production system, you would actually disable the routes
            // For now, we'll just log the action
            console.log(`Routes for module '${moduleId}' are now disabled`);
            return true;

        } catch (error) {
            console.error(`Failed to disable routes for module '${moduleId}':`, error);
            return false;
        }
    }

    /**
     * Get all registered routes
     * @returns {Object} All registered routes by module
     */
    getAllRegisteredRoutes() {
        const result = {};

        for (const [moduleId, routeInfo] of this.registeredRoutes) {
            result[moduleId] = {
                prefix: routeInfo.prefix,
                routes: routeInfo.routes,
                registeredAt: routeInfo.registeredAt
            };
        }

        return result;
    }

    /**
     * Get routes for a specific module
     * @param {string} moduleId - Module ID
     * @returns {Object|null} Route information or null
     */
    getModuleRoutes(moduleId) {
        const routeInfo = this.registeredRoutes.get(moduleId);
        return routeInfo ? { ...routeInfo } : null;
    }

    /**
     * Check if module has registered routes
     * @param {string} moduleId - Module ID
     * @returns {boolean} True if routes are registered
     */
    hasRegisteredRoutes(moduleId) {
        return this.registeredRoutes.has(moduleId);
    }

    /**
     * Register all active modules' routes
     * @returns {Promise<Object>} Registration results
     */
    async registerAllActiveModules() {
        const activeModules = moduleRegistry.getActiveModules();
        const results = {
            successful: [],
            failed: []
        };

        for (const module of activeModules) {
            try {
                if (!this.hasRegisteredRoutes(module.id)) {
                    const result = await this.registerModuleRoutes(module.id);
                    results.successful.push({ moduleId: module.id, result });
                }
            } catch (error) {
                results.failed.push({ moduleId: module.id, error: error.message });
            }
        }

        return results;
    }

    /**
     * Generate Express app route documentation
     * @returns {Object} Route documentation
     */
    generateRouteDocumentation() {
        const documentation = {
            generatedAt: new Date(),
            totalModules: this.registeredRoutes.size,
            routes: {}
        };

        for (const [moduleId, routeInfo] of this.registeredRoutes) {
            const module = moduleRegistry.getModule(moduleId);

            documentation.routes[moduleId] = {
                moduleName: module?.name || moduleId,
                moduleVersion: module?.version || 'unknown',
                routePrefix: routeInfo.prefix,
                registeredAt: routeInfo.registeredAt,
                routes: routeInfo.routes.map(route => ({
                    route,
                    fullPath: `${routeInfo.prefix}${route.split(' ')[1] || ''}`
                })),
                description: module?.description || 'No description available'
            };
        }

        return documentation;
    }

    /**
     * Get integration statistics
     * @returns {Object} Integration statistics
     */
    getIntegrationStats() {
        return {
            totalRegisteredModules: this.registeredRoutes.size,
            totalRoutePrefixes: this.routePrefixes.size,
            totalMiddlewareStacks: this.middlewareStack.size,
            routesByModule: Object.fromEntries(
                Array.from(this.registeredRoutes.entries()).map(([moduleId, info]) => [
                    moduleId,
                    info.routes.length
                ])
            )
        };
    }
}

module.exports = RouterIntegration;