const EventEmitter = require('events');

/**
 * Module Registry for runtime module registration and management
 * Provides centralized module state management with thread-safe operations
 * and lifecycle event handling
 */
class ModuleRegistry extends EventEmitter {
    constructor() {
        super();

        // In-memory registry for loaded modules
        this.modules = new Map();

        // Mutex-like flag for thread safety
        this.operationInProgress = false;
        this.operationQueue = [];

        // Module state constants
        this.MODULE_STATES = {
            LOADED: 'loaded',
            ACTIVE: 'active',
            ERROR: 'error',
            UNLOADING: 'unloading',
            DISABLED: 'disabled'
        };

        // Registry metadata
        this.registryMetadata = {
            created: new Date(),
            totalRegistrations: 0,
            totalUnregistrations: 0
        };

        this.setMaxListeners(50); // Increase listener limit for module events
    }

    /**
     * Execute operations in a thread-safe manner
     * @param {Function} operation - Operation to execute
     * @returns {Promise<any>} Operation result
     */
    async _executeThreadSafe(operation) {
        return new Promise((resolve, reject) => {
            const executeOperation = async () => {
                if (this.operationInProgress) {
                    this.operationQueue.push(executeOperation);
                    return;
                }

                this.operationInProgress = true;

                try {
                    const result = await operation();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    this.operationInProgress = false;

                    // Process next operation in queue
                    if (this.operationQueue.length > 0) {
                        const nextOperation = this.operationQueue.shift();
                        setImmediate(nextOperation);
                    }
                }
            };

            executeOperation();
        });
    }

    /**
     * Validate module structure and metadata
     * @param {Object} module - Module to validate
     * @returns {Object} Validation result
     */
    _validateModule(module) {
        const errors = [];
        const warnings = [];

        // Required fields validation
        if (!module.id || typeof module.id !== 'string') {
            errors.push('Module must have a valid string ID');
        }

        if (!module.name || typeof module.name !== 'string') {
            errors.push('Module must have a valid string name');
        }

        if (!module.version) {
            warnings.push('Module version not specified');
        }

        // Check for duplicate ID
        if (this.modules.has(module.id)) {
            errors.push(`Module with ID '${module.id}' is already registered`);
        }

        // Validate metadata structure
        if (module.metadata && typeof module.metadata !== 'object') {
            errors.push('Module metadata must be an object');
        }

        // Validate routes if present
        if (module.routes) {
            if (!Array.isArray(module.routes) && typeof module.routes !== 'object') {
                errors.push('Module routes must be an array or object');
            }
        }

        // Validate dependencies if present
        if (module.dependencies) {
            if (!Array.isArray(module.dependencies)) {
                errors.push('Module dependencies must be an array');
            } else {
                // Check if dependencies are satisfied
                for (const dep of module.dependencies) {
                    if (!this.modules.has(dep)) {
                        warnings.push(`Dependency '${dep}' is not registered`);
                    }
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Check for module conflicts
     * @param {Object} module - Module to check
     * @returns {Array} Array of conflicts found
     */
    _checkConflicts(module) {
        const conflicts = [];

        // Check route conflicts
        if (module.routes) {
            const moduleRoutes = Array.isArray(module.routes) ? module.routes : Object.keys(module.routes);

            for (const [existingId, existingModule] of this.modules) {
                if (existingModule.routes) {
                    const existingRoutes = Array.isArray(existingModule.routes)
                        ? existingModule.routes
                        : Object.keys(existingModule.routes);

                    const routeConflicts = moduleRoutes.filter(route =>
                        existingRoutes.some(existingRoute =>
                            this._routesConflict(route, existingRoute)
                        )
                    );

                    if (routeConflicts.length > 0) {
                        conflicts.push({
                            type: 'route',
                            conflictingModule: existingId,
                            conflictingRoutes: routeConflicts
                        });
                    }
                }
            }
        }

        // Check name conflicts (case-insensitive)
        for (const [existingId, existingModule] of this.modules) {
            if (existingModule.name.toLowerCase() === module.name.toLowerCase() && existingId !== module.id) {
                conflicts.push({
                    type: 'name',
                    conflictingModule: existingId,
                    conflictingName: existingModule.name
                });
            }
        }

        return conflicts;
    }

    /**
     * Check if two routes conflict
     * @param {string} route1 - First route
     * @param {string} route2 - Second route
     * @returns {boolean} True if routes conflict
     */
    _routesConflict(route1, route2) {
        // Normalize routes
        const normalize = (route) => route.replace(/^\/+|\/+$/g, '').toLowerCase();
        const norm1 = normalize(route1);
        const norm2 = normalize(route2);

        // Exact match
        if (norm1 === norm2) return true;

        // Check if one is a prefix of the other
        return norm1.startsWith(norm2 + '/') || norm2.startsWith(norm1 + '/');
    }

    /**
     * Register a module in the registry
     * @param {Object} module - Module to register
     * @param {Object} options - Registration options
     * @returns {Promise<Object>} Registration result
     */
    async register(module, options = {}) {
        return this._executeThreadSafe(async () => {
            try {
                // Validate module structure
                const validation = this._validateModule(module);
                if (!validation.isValid) {
                    const error = new Error(`Module validation failed: ${validation.errors.join(', ')}`);
                    error.validationErrors = validation.errors;
                    error.validationWarnings = validation.warnings;
                    throw error;
                }

                // Check for conflicts unless forced
                if (!options.force) {
                    const conflicts = this._checkConflicts(module);
                    if (conflicts.length > 0) {
                        const error = new Error(`Module conflicts detected: ${JSON.stringify(conflicts)}`);
                        error.conflicts = conflicts;
                        throw error;
                    }
                }

                // Prepare module entry
                const moduleEntry = {
                    id: module.id,
                    name: module.name,
                    version: module.version || '1.0.0',
                    description: module.description || '',
                    state: this.MODULE_STATES.LOADED,
                    metadata: {
                        ...(module.metadata || {}),
                        registeredAt: new Date(),
                        registrationOptions: options
                    },
                    routes: module.routes || [],
                    dependencies: module.dependencies || [],
                    conflicts: module.conflicts || [],
                    exports: module.exports || {},
                    config: module.config || {},
                    hooks: module.hooks || {},
                    lastError: null,
                    statistics: {
                        loadCount: 0,
                        errorCount: 0,
                        lastAccess: null
                    }
                };

                // Store in registry
                this.modules.set(module.id, moduleEntry);
                this.registryMetadata.totalRegistrations++;

                // Emit registration event
                this.emit('moduleRegistered', {
                    moduleId: module.id,
                    module: moduleEntry,
                    timestamp: new Date()
                });

                // Log warnings if any
                if (validation.warnings.length > 0) {
                    this.emit('moduleWarnings', {
                        moduleId: module.id,
                        warnings: validation.warnings,
                        timestamp: new Date()
                    });
                }

                return {
                    success: true,
                    moduleId: module.id,
                    warnings: validation.warnings,
                    state: moduleEntry.state
                };

            } catch (error) {
                // Update error state if module was partially registered
                if (this.modules.has(module.id)) {
                    const moduleEntry = this.modules.get(module.id);
                    moduleEntry.state = this.MODULE_STATES.ERROR;
                    moduleEntry.lastError = {
                        message: error.message,
                        timestamp: new Date(),
                        stack: error.stack
                    };
                    moduleEntry.statistics.errorCount++;
                }

                this.emit('moduleRegistrationFailed', {
                    moduleId: module.id,
                    error: error.message,
                    timestamp: new Date()
                });

                throw error;
            }
        });
    }

    /**
     * Unregister a module from the registry
     * @param {string} moduleId - ID of module to unregister
     * @param {Object} options - Unregistration options
     * @returns {Promise<Object>} Unregistration result
     */
    async unregister(moduleId, options = {}) {
        return this._executeThreadSafe(async () => {
            try {
                if (!this.modules.has(moduleId)) {
                    throw new Error(`Module '${moduleId}' is not registered`);
                }

                const moduleEntry = this.modules.get(moduleId);

                // Check for dependent modules unless forced
                if (!options.force) {
                    const dependentModules = this.getDependentModules(moduleId);
                    if (dependentModules.length > 0) {
                        throw new Error(
                            `Cannot unregister module '${moduleId}'. ` +
                            `Dependent modules: ${dependentModules.map(m => m.id).join(', ')}`
                        );
                    }
                }

                // Set unloading state
                moduleEntry.state = this.MODULE_STATES.UNLOADING;

                // Emit unloading event
                this.emit('moduleUnloading', {
                    moduleId,
                    module: moduleEntry,
                    timestamp: new Date()
                });

                // Clean up module resources if cleanup hook exists
                if (moduleEntry.hooks.cleanup && typeof moduleEntry.hooks.cleanup === 'function') {
                    try {
                        await moduleEntry.hooks.cleanup();
                    } catch (cleanupError) {
                        this.emit('moduleCleanupError', {
                            moduleId,
                            error: cleanupError.message,
                            timestamp: new Date()
                        });
                    }
                }

                // Remove from registry
                this.modules.delete(moduleId);
                this.registryMetadata.totalUnregistrations++;

                // Emit unregistration event
                this.emit('moduleUnregistered', {
                    moduleId,
                    module: moduleEntry,
                    timestamp: new Date()
                });

                return {
                    success: true,
                    moduleId,
                    unregisteredModule: {
                        id: moduleEntry.id,
                        name: moduleEntry.name,
                        version: moduleEntry.version
                    }
                };

            } catch (error) {
                this.emit('moduleUnregistrationFailed', {
                    moduleId,
                    error: error.message,
                    timestamp: new Date()
                });

                throw error;
            }
        });
    }

    /**
     * Get a specific module by ID
     * @param {string} moduleId - Module ID to retrieve
     * @returns {Object|null} Module entry or null if not found
     */
    getModule(moduleId) {
        const module = this.modules.get(moduleId);
        if (module) {
            // Update last access time
            module.statistics.lastAccess = new Date();
            module.statistics.loadCount++;

            // Return a deep copy to prevent external modifications
            return JSON.parse(JSON.stringify(module));
        }
        return null;
    }

    /**
     * Get all registered modules
     * @param {Object} filter - Optional filter criteria
     * @returns {Array} Array of module entries
     */
    getAllModules(filter = {}) {
        const modules = Array.from(this.modules.values());

        let filteredModules = modules;

        // Apply state filter
        if (filter.state) {
            filteredModules = filteredModules.filter(module => module.state === filter.state);
        }

        // Apply name filter (case-insensitive partial match)
        if (filter.name) {
            const nameFilter = filter.name.toLowerCase();
            filteredModules = filteredModules.filter(module =>
                module.name.toLowerCase().includes(nameFilter)
            );
        }

        // Apply version filter
        if (filter.version) {
            filteredModules = filteredModules.filter(module => module.version === filter.version);
        }

        // Apply dependency filter
        if (filter.hasDependency) {
            filteredModules = filteredModules.filter(module =>
                module.dependencies.includes(filter.hasDependency)
            );
        }

        // Sort by registration time (newest first) unless specified otherwise
        const sortBy = filter.sortBy || 'registeredAt';
        const sortOrder = filter.sortOrder || 'desc';

        filteredModules.sort((a, b) => {
            let aValue, bValue;

            if (sortBy === 'registeredAt') {
                aValue = new Date(a.metadata.registeredAt);
                bValue = new Date(b.metadata.registeredAt);
            } else if (sortBy === 'name') {
                aValue = a.name.toLowerCase();
                bValue = b.name.toLowerCase();
            } else {
                aValue = a[sortBy];
                bValue = b[sortBy];
            }

            if (sortOrder === 'desc') {
                return aValue > bValue ? -1 : 1;
            } else {
                return aValue > bValue ? 1 : -1;
            }
        });

        // Return deep copies to prevent external modifications
        return filteredModules.map(module => JSON.parse(JSON.stringify(module)));
    }

    /**
     * Get all active modules
     * @returns {Array} Array of active module entries
     */
    getActiveModules() {
        return this.getAllModules({ state: this.MODULE_STATES.ACTIVE });
    }

    /**
     * Get modules that depend on the specified module
     * @param {string} moduleId - Module ID to check dependencies for
     * @returns {Array} Array of dependent modules
     */
    getDependentModules(moduleId) {
        return this.getAllModules().filter(module =>
            module.dependencies.includes(moduleId)
        );
    }

    /**
     * Update module state
     * @param {string} moduleId - Module ID
     * @param {string} newState - New state
     * @param {Object} metadata - Optional metadata to update
     * @returns {boolean} Success status
     */
    updateModuleState(moduleId, newState, metadata = {}) {
        if (!this.modules.has(moduleId)) {
            return false;
        }

        const module = this.modules.get(moduleId);
        const oldState = module.state;

        module.state = newState;
        module.metadata = { ...module.metadata, ...metadata, lastStateChange: new Date() };

        this.emit('moduleStateChanged', {
            moduleId,
            oldState,
            newState,
            metadata,
            timestamp: new Date()
        });

        return true;
    }

    /**
     * Update module configuration
     * @param {string} moduleId - Module ID
     * @param {Object} config - New configuration
     * @returns {boolean} Success status
     */
    updateModuleConfig(moduleId, config) {
        if (!this.modules.has(moduleId)) {
            return false;
        }

        const module = this.modules.get(moduleId);
        const oldConfig = { ...module.config };

        module.config = { ...module.config, ...config };
        module.metadata.lastConfigUpdate = new Date();

        this.emit('moduleConfigChanged', {
            moduleId,
            oldConfig,
            newConfig: module.config,
            timestamp: new Date()
        });

        return true;
    }

    /**
     * Get registry statistics
     * @returns {Object} Registry statistics
     */
    getRegistryStats() {
        const modules = Array.from(this.modules.values());

        const stats = {
            ...this.registryMetadata,
            totalModules: modules.length,
            modulesByState: {},
            totalRoutes: 0,
            totalDependencies: 0,
            memoryUsage: process.memoryUsage(),
            uptime: Date.now() - this.registryMetadata.created.getTime()
        };

        // Count modules by state
        for (const state of Object.values(this.MODULE_STATES)) {
            stats.modulesByState[state] = modules.filter(m => m.state === state).length;
        }

        // Count total routes and dependencies
        stats.totalRoutes = modules.reduce((sum, m) => sum + (Array.isArray(m.routes) ? m.routes.length : Object.keys(m.routes || {}).length), 0);
        stats.totalDependencies = modules.reduce((sum, m) => sum + m.dependencies.length, 0);

        return stats;
    }

    /**
     * Clear all modules from registry
     * @param {boolean} force - Force clear even with dependencies
     * @returns {Promise<Object>} Clear result
     */
    async clearRegistry(force = false) {
        return this._executeThreadSafe(async () => {
            const moduleIds = Array.from(this.modules.keys());
            const results = {
                cleared: [],
                failed: []
            };

            // Unregister all modules
            for (const moduleId of moduleIds) {
                try {
                    await this.unregister(moduleId, { force });
                    results.cleared.push(moduleId);
                } catch (error) {
                    results.failed.push({ moduleId, error: error.message });
                }
            }

            this.emit('registryCleared', {
                results,
                timestamp: new Date()
            });

            return results;
        });
    }

    /**
     * Export registry state for persistence
     * @returns {Object} Serializable registry state
     */
    exportState() {
        return {
            metadata: this.registryMetadata,
            modules: Object.fromEntries(this.modules),
            timestamp: new Date()
        };
    }

    /**
     * Import registry state from persistence
     * @param {Object} state - Serialized registry state
     * @returns {boolean} Success status
     */
    importState(state) {
        try {
            if (state.modules) {
                this.modules.clear();
                for (const [id, module] of Object.entries(state.modules)) {
                    this.modules.set(id, module);
                }
            }

            if (state.metadata) {
                this.registryMetadata = { ...this.registryMetadata, ...state.metadata };
            }

            this.emit('registryStateImported', {
                importedModules: Object.keys(state.modules || {}),
                timestamp: new Date()
            });

            return true;
        } catch (error) {
            this.emit('registryStateImportFailed', {
                error: error.message,
                timestamp: new Date()
            });
            return false;
        }
    }
}

// Create and export singleton instance
const moduleRegistry = new ModuleRegistry();

module.exports = moduleRegistry;