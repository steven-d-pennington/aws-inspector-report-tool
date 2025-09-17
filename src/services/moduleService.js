const ModuleSettings = require('../models/moduleSettings');

/**
 * ModuleService - Business logic layer for module management
 *
 * Provides comprehensive module management functionality including:
 * - Module state management (enable/disable/toggle)
 * - Configuration validation and updates
 * - Module ordering and display management
 * - Business rule enforcement (default module protection, minimum enabled modules)
 * - Module dependency checking and resolution
 * - Audit logging for all module changes
 * - Integration with module registry for lifecycle management
 *
 * All methods include comprehensive error handling and validation
 */
class ModuleService {
    constructor() {
        this.moduleSettings = new ModuleSettings();
        this.moduleRegistry = new Map(); // In-memory registry for module lifecycle management
        this.auditLog = []; // Simple in-memory audit log (could be replaced with database logging)
        this.isInitialized = false;
    }

    /**
     * Initialize the module service and underlying database
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            await this.moduleSettings.initialize();
            await this._initializeModuleRegistry();
            this.isInitialized = true;
            this._logAuditEvent('service_initialized', 'system', { timestamp: new Date().toISOString() });
        } catch (error) {
            throw new Error(`Failed to initialize ModuleService: ${error.message}`);
        }
    }

    /**
     * Get all modules with their current state and configuration
     * @returns {Promise<Array>} Array of all module objects
     */
    async getModules() {
        try {
            this._ensureInitialized();
            const modules = await this.moduleSettings.getAllModules();

            // Enhance modules with runtime state from registry
            return modules.map(module => this._enrichModuleWithRegistryData(module));
        } catch (error) {
            throw new Error(`Failed to get modules: ${error.message}`);
        }
    }

    /**
     * Get only enabled modules ordered by display_order
     * @returns {Promise<Array>} Array of enabled module objects
     */
    async getEnabledModules() {
        try {
            this._ensureInitialized();
            const modules = await this.moduleSettings.getEnabledModules();

            // Enhance modules with runtime state from registry
            return modules.map(module => this._enrichModuleWithRegistryData(module));
        } catch (error) {
            throw new Error(`Failed to get enabled modules: ${error.message}`);
        }
    }

    /**
     * Validate module toggle operation with comprehensive business rule checking
     * @param {string} moduleId - The module identifier
     * @param {boolean} enabled - The desired enabled state
     * @returns {Promise<Object>} Validation result with detailed information
     * @throws {Error} If validation fails with detailed explanation
     */
    async validateModuleToggle(moduleId, enabled) {
        try {
            this._ensureInitialized();
            this._validateModuleId(moduleId);
            this._validateBoolean(enabled, 'enabled');

            // Get current module state
            const currentModule = await this.moduleSettings.getModule(moduleId);
            if (!currentModule) {
                throw new Error(`Module '${moduleId}' not found. Available modules can be retrieved via getModules().`);
            }

            const validationResult = {
                valid: true,
                moduleId,
                currentState: currentModule.enabled,
                requestedState: enabled,
                warnings: [],
                constraints: {
                    isDefault: currentModule.is_default,
                    hasActiveDependents: false,
                    isLastEnabledModule: false
                },
                operationType: enabled ? 'enable' : 'disable'
            };

            // Check if operation is needed
            if (currentModule.enabled === enabled) {
                validationResult.valid = false;
                validationResult.reason = `Module '${moduleId}' is already ${enabled ? 'enabled' : 'disabled'}`;
                return validationResult;
            }

            // Validate business rule: Cannot disable default modules
            if (!enabled && currentModule.is_default) {
                validationResult.valid = false;
                validationResult.constraints.isDefault = true;
                validationResult.reason = `Cannot disable default module '${moduleId}'. Default modules (is_default=1) are protected and must remain active to ensure system functionality. Consider configuring the module instead of disabling it.`;
                return validationResult;
            }

            // Validate business rule: Must maintain at least one enabled module
            if (!enabled) {
                const enabledCount = await this._getEnabledModuleCount();
                if (enabledCount <= 1) {
                    validationResult.valid = false;
                    validationResult.constraints.isLastEnabledModule = true;
                    validationResult.reason = `Cannot disable module '${moduleId}' because it would leave no enabled modules. At least one module must remain active to maintain application functionality. Enable another module before disabling this one.`;
                    return validationResult;
                }
            }

            // Validate module dependencies
            const dependencyValidation = await this._validateModuleDependencies(moduleId, enabled);
            if (!dependencyValidation.valid) {
                validationResult.valid = false;
                validationResult.constraints.hasActiveDependents = dependencyValidation.hasActiveDependents;
                validationResult.reason = dependencyValidation.reason;
                validationResult.dependencies = dependencyValidation.dependencies;
                return validationResult;
            }

            // Add warnings for potential issues
            if (enabled) {
                const registryEntry = this.moduleRegistry.get(moduleId);
                if (registryEntry?.dependencies?.length > 0) {
                    validationResult.warnings.push(`This module depends on: ${registryEntry.dependencies.join(', ')}. Ensure these dependencies are properly configured.`);
                }
            } else {
                const dependents = this._getModuleDependents(moduleId);
                if (dependents.length > 0) {
                    validationResult.warnings.push(`Other modules may depend on this module: ${dependents.join(', ')}. Verify functionality after disabling.`);
                }
            }

            return validationResult;
        } catch (error) {
            return {
                valid: false,
                moduleId,
                reason: error.message,
                error: true
            };
        }
    }

    /**
     * Toggle a module's enabled state with comprehensive validation
     * @param {string} moduleId - The module identifier
     * @param {boolean} enabled - The desired enabled state
     * @param {string} [userId='system'] - User making the change for audit purposes
     * @returns {Promise<Object>} Updated module object
     */
    async toggleModule(moduleId, enabled, userId = 'system') {
        try {
            this._ensureInitialized();

            // Perform comprehensive validation first
            const validation = await this.validateModuleToggle(moduleId, enabled);
            if (!validation.valid) {
                const errorMessage = validation.reason || `Validation failed for module '${moduleId}'`;
                this._logAuditEvent('module_toggle_validation_failed', userId, {
                    moduleId,
                    enabled,
                    validation,
                    error: errorMessage
                });
                throw new Error(errorMessage);
            }

            // Get current module state (already validated)
            const currentModule = await this.moduleSettings.getModule(moduleId);

            // Log validation warnings if any
            if (validation.warnings && validation.warnings.length > 0) {
                this._logAuditEvent('module_toggle_warnings', userId, {
                    moduleId,
                    enabled,
                    warnings: validation.warnings
                });
            }

            // Perform the toggle operation
            if (enabled) {
                await this.moduleSettings.enableModule(moduleId);
                await this._handleModuleEnable(moduleId);
            } else {
                await this.moduleSettings.disableModule(moduleId);
                await this._handleModuleDisable(moduleId);
            }

            // Get updated module state
            const updatedModule = await this.moduleSettings.getModule(moduleId);
            const enrichedModule = this._enrichModuleWithRegistryData(updatedModule);

            // Add validation metadata to response
            enrichedModule.validation = {
                constraints: validation.constraints,
                warnings: validation.warnings || []
            };

            // Log the successful change
            this._logAuditEvent('module_toggled', userId, {
                moduleId,
                previousState: currentModule.enabled,
                newState: enabled,
                module: enrichedModule,
                validation
            });

            return enrichedModule;
        } catch (error) {
            this._logAuditEvent('module_toggle_error', userId, {
                moduleId,
                enabled,
                error: error.message
            });
            throw error; // Re-throw the original error with detailed message
        }
    }

    /**
     * Validate module configuration with comprehensive schema and business rule checking
     * @param {string} moduleId - The module identifier
     * @param {Object} config - Configuration to validate
     * @returns {Promise<Object>} Detailed validation result
     */
    async validateModuleConfig(moduleId, config) {
        try {
            this._ensureInitialized();
            this._validateModuleId(moduleId);

            const module = await this.moduleSettings.getModule(moduleId);
            if (!module) {
                throw new Error(`Module '${moduleId}' not found. Available modules can be retrieved via getModules().`);
            }

            const validationResult = {
                valid: true,
                moduleId,
                originalConfig: config,
                validatedConfig: null,
                schema: null,
                errors: [],
                warnings: [],
                conflicts: [],
                suggestions: []
            };

            // Get module's configuration schema
            const registryEntry = this.moduleRegistry.get(moduleId);
            validationResult.schema = registryEntry?.configSchema || null;

            if (!validationResult.schema) {
                validationResult.warnings.push(`No configuration schema defined for module '${moduleId}'. Configuration will be stored as-is without validation.`);
                validationResult.validatedConfig = config;
                return validationResult;
            }

            // Validate configuration against schema
            try {
                validationResult.validatedConfig = await this._validateModuleConfiguration(moduleId, config);
            } catch (schemaError) {
                validationResult.valid = false;
                validationResult.errors.push({
                    type: 'schema_validation',
                    message: schemaError.message,
                    field: this._extractFieldFromError(schemaError.message)
                });
            }

            // Check for configuration conflicts
            if (validationResult.valid) {
                const conflicts = await this._checkConfigurationConflicts(moduleId, validationResult.validatedConfig);
                validationResult.conflicts = conflicts.map(conflict => ({
                    type: 'conflict',
                    message: conflict,
                    severity: 'error'
                }));

                if (conflicts.length > 0) {
                    validationResult.valid = false;
                    validationResult.errors.push(...validationResult.conflicts);
                }
            }

            // Generate warnings and suggestions
            if (validationResult.valid) {
                validationResult.warnings.push(...this._getConfigurationWarnings(moduleId, validationResult.validatedConfig));
                validationResult.suggestions.push(...this._getConfigurationSuggestions(moduleId, validationResult.validatedConfig));
            }

            // Validate configuration consistency with module state
            if (validationResult.valid && !module.enabled) {
                validationResult.warnings.push(`Module '${moduleId}' is currently disabled. Configuration changes will take effect when the module is enabled.`);
            }

            return validationResult;
        } catch (error) {
            return {
                valid: false,
                moduleId,
                error: error.message,
                originalConfig: config,
                validatedConfig: null,
                schema: null,
                errors: [{
                    type: 'validation_error',
                    message: error.message
                }],
                warnings: [],
                conflicts: [],
                suggestions: []
            };
        }
    }

    /**
     * Get current module constraints and system state information
     * @returns {Promise<Object>} Current constraint status and system information
     */
    async getModuleConstraints() {
        try {
            this._ensureInitialized();

            const allModules = await this.moduleSettings.getAllModules();
            const enabledModules = allModules.filter(m => m.enabled);
            const defaultModules = allModules.filter(m => m.is_default);

            const constraints = {
                timestamp: new Date().toISOString(),
                system: {
                    totalModules: allModules.length,
                    enabledModules: enabledModules.length,
                    disabledModules: allModules.length - enabledModules.length,
                    defaultModules: defaultModules.length
                },
                rules: {
                    minEnabledModules: 1,
                    defaultModulesProtected: true,
                    moduleIdFormat: '^[a-z0-9-_]+$'
                },
                current: {
                    canDisableAnyModule: enabledModules.length > 1,
                    protectedModules: defaultModules.map(m => m.module_id),
                    vulnerableToDisabling: enabledModules.length === 1 ? enabledModules[0].module_id : null
                },
                modules: {}
            };

            // Add per-module constraint information
            for (const module of allModules) {
                const moduleId = module.module_id;
                const dependents = this._getModuleDependents(moduleId);
                const enabledDependents = dependents.filter(depId => {
                    const depModule = allModules.find(m => m.module_id === depId);
                    return depModule && depModule.enabled;
                });

                const registryEntry = this.moduleRegistry.get(moduleId);

                constraints.modules[moduleId] = {
                    enabled: module.enabled,
                    isDefault: module.is_default,
                    canEnable: !module.enabled,
                    canDisable: module.enabled && !module.is_default && (enabledModules.length > 1) && enabledDependents.length === 0,
                    canConfigure: true,
                    hasSchema: !!(registryEntry?.configSchema),
                    dependencies: registryEntry?.dependencies || [],
                    dependents,
                    enabledDependents,
                    constraints: {
                        protectedByDefault: module.is_default,
                        protectedByMinimum: enabledModules.length === 1 && module.enabled,
                        protectedByDependents: enabledDependents.length > 0,
                        hasUnmetDependencies: false // Will be calculated below
                    }
                };

                // Check for unmet dependencies
                if (registryEntry?.dependencies) {
                    const unmetDeps = registryEntry.dependencies.filter(depId => {
                        const depModule = allModules.find(m => m.module_id === depId);
                        return !depModule || !depModule.enabled;
                    });
                    constraints.modules[moduleId].constraints.hasUnmetDependencies = unmetDeps.length > 0;
                    constraints.modules[moduleId].unmetDependencies = unmetDeps;
                }
            }

            return constraints;
        } catch (error) {
            throw new Error(`Failed to get module constraints: ${error.message}`);
        }
    }

    /**
     * Update module configuration with validation
     * @param {string} moduleId - The module identifier
     * @param {Object} config - New configuration object
     * @param {string} [userId='system'] - User making the change for audit purposes
     * @returns {Promise<Object>} Updated module object
     */
    async updateModuleConfig(moduleId, config, userId = 'system') {
        try {
            this._ensureInitialized();

            // Perform comprehensive configuration validation first
            const validation = await this.validateModuleConfig(moduleId, config);
            if (!validation.valid) {
                const errorMessage = validation.errors.map(e => e.message).join('; ') || `Configuration validation failed for module '${moduleId}'`;
                this._logAuditEvent('module_config_validation_failed', userId, {
                    moduleId,
                    config,
                    validation,
                    error: errorMessage
                });
                throw new Error(errorMessage);
            }

            // Get current module to ensure it exists (already validated)
            const currentModule = await this.moduleSettings.getModule(moduleId);

            // Log validation warnings if any
            if (validation.warnings && validation.warnings.length > 0) {
                this._logAuditEvent('module_config_warnings', userId, {
                    moduleId,
                    config: validation.validatedConfig,
                    warnings: validation.warnings
                });
            }

            // Update the configuration
            await this.moduleSettings.updateModuleConfig(moduleId, validation.validatedConfig);

            // Handle configuration change in registry
            await this._handleConfigurationChange(moduleId, validation.validatedConfig);

            // Get updated module state
            const updatedModule = await this.moduleSettings.getModule(moduleId);
            const enrichedModule = this._enrichModuleWithRegistryData(updatedModule);

            // Add validation metadata to response
            enrichedModule.configValidation = {
                warnings: validation.warnings || [],
                suggestions: validation.suggestions || []
            };

            // Log the configuration change
            this._logAuditEvent('module_config_updated', userId, {
                moduleId,
                previousConfig: currentModule.config,
                newConfig: validation.validatedConfig,
                module: enrichedModule,
                validation
            });

            return enrichedModule;
        } catch (error) {
            this._logAuditEvent('module_config_error', userId, {
                moduleId,
                config,
                error: error.message
            });
            throw error; // Re-throw the original error with detailed message
        }
    }

    /**
     * Reorder modules by updating display_order
     * @param {Array<string>} orderArray - Array of module_ids in desired order
     * @param {string} [userId='system'] - User making the change for audit purposes
     * @returns {Promise<Array>} Updated modules in new order
     */
    async reorderModules(orderArray, userId = 'system') {
        try {
            this._ensureInitialized();
            this._validateOrderArray(orderArray);

            // Get current module order for audit
            const currentModules = await this.moduleSettings.getModulesByOrder();
            const currentOrder = currentModules.map(m => m.module_id);

            // Validate that all provided module IDs exist
            await this._validateModuleIdsExist(orderArray);

            // Check for conflicts in reordering
            await this._validateReorderConflicts(orderArray);

            // Perform the reorder operation
            await this.moduleSettings.reorderModules(orderArray);

            // Handle reorder in registry
            await this._handleModuleReorder(orderArray);

            // Get updated modules in new order
            const updatedModules = await this.moduleSettings.getModulesByOrder();
            const enrichedModules = updatedModules.map(module => this._enrichModuleWithRegistryData(module));

            // Log the reorder operation
            this._logAuditEvent('modules_reordered', userId, {
                previousOrder: currentOrder,
                newOrder: orderArray,
                affectedModules: enrichedModules.length
            });

            return enrichedModules;
        } catch (error) {
            this._logAuditEvent('module_reorder_error', userId, {
                orderArray,
                error: error.message
            });
            throw new Error(`Failed to reorder modules: ${error.message}`);
        }
    }

    /**
     * Get audit log entries for module changes
     * @param {Object} [filters] - Optional filters for audit log
     * @param {string} [filters.userId] - Filter by user ID
     * @param {string} [filters.moduleId] - Filter by module ID
     * @param {string} [filters.action] - Filter by action type
     * @param {Date} [filters.startDate] - Filter by start date
     * @param {Date} [filters.endDate] - Filter by end date
     * @returns {Array} Filtered audit log entries
     */
    getAuditLog(filters = {}) {
        try {
            let filteredLog = [...this.auditLog];

            if (filters.userId) {
                filteredLog = filteredLog.filter(entry => entry.userId === filters.userId);
            }

            if (filters.moduleId) {
                filteredLog = filteredLog.filter(entry =>
                    entry.details && entry.details.moduleId === filters.moduleId
                );
            }

            if (filters.action) {
                filteredLog = filteredLog.filter(entry => entry.action === filters.action);
            }

            if (filters.startDate) {
                filteredLog = filteredLog.filter(entry =>
                    new Date(entry.timestamp) >= filters.startDate
                );
            }

            if (filters.endDate) {
                filteredLog = filteredLog.filter(entry =>
                    new Date(entry.timestamp) <= filters.endDate
                );
            }

            return filteredLog.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            throw new Error(`Failed to get audit log: ${error.message}`);
        }
    }

    /**
     * Get module dependency information
     * @param {string} moduleId - The module identifier
     * @returns {Promise<Object>} Module dependency information
     */
    async getModuleDependencies(moduleId) {
        try {
            this._ensureInitialized();
            this._validateModuleId(moduleId);

            const module = await this.moduleSettings.getModule(moduleId);
            if (!module) {
                throw new Error(`Module '${moduleId}' not found`);
            }

            const registryEntry = this.moduleRegistry.get(moduleId);

            return {
                moduleId,
                dependencies: registryEntry?.dependencies || [],
                dependents: this._getModuleDependents(moduleId),
                canBeDisabled: await this._canModuleBeDisabled(moduleId),
                conflicts: await this._getModuleConflicts(moduleId)
            };
        } catch (error) {
            throw new Error(`Failed to get dependencies for module '${moduleId}': ${error.message}`);
        }
    }

    /**
     * Validate module configuration without saving (backward compatibility)
     * @param {string} moduleId - The module identifier
     * @param {Object} config - Configuration to validate
     * @returns {Promise<Object>} Validation result with any errors
     */
    async validateConfiguration(moduleId, config) {
        const result = await this.validateModuleConfig(moduleId, config);

        // Transform to backward-compatible format
        return {
            valid: result.valid,
            config: result.validatedConfig,
            conflicts: result.conflicts.map(c => c.message || c),
            warnings: result.warnings.map(w => w.message || w),
            error: result.error
        };
    }

    // ============ PRIVATE METHODS ============

    /**
     * Initialize the module registry with known modules
     * @private
     */
    async _initializeModuleRegistry() {
        // Initialize registry with default module configurations
        this.moduleRegistry.set('aws-inspector', {
            dependencies: [],
            conflicts: [],
            configSchema: {
                type: 'object',
                properties: {
                    autoRefresh: { type: 'boolean', default: true },
                    refreshInterval: { type: 'number', minimum: 30, default: 300 }
                }
            }
        });

        this.moduleRegistry.set('sbom', {
            dependencies: [],
            conflicts: [],
            configSchema: {
                type: 'object',
                properties: {
                    format: { type: 'string', enum: ['json', 'xml', 'csv'], default: 'json' },
                    includeDevDependencies: { type: 'boolean', default: false }
                }
            }
        });
    }

    /**
     * Ensure the service is initialized before operations
     * @private
     */
    _ensureInitialized() {
        if (!this.isInitialized) {
            throw new Error('ModuleService must be initialized before use');
        }
    }

    /**
     * Validate module ID format and presence
     * @private
     */
    _validateModuleId(moduleId) {
        if (!moduleId || typeof moduleId !== 'string') {
            throw new Error('Module ID must be a non-empty string');
        }
        if (!/^[a-z0-9-_]+$/i.test(moduleId)) {
            throw new Error('Module ID contains invalid characters. Only alphanumeric characters, hyphens, and underscores are allowed.');
        }
    }

    /**
     * Validate boolean values
     * @private
     */
    _validateBoolean(value, fieldName) {
        if (typeof value !== 'boolean') {
            throw new Error(`${fieldName} must be a boolean value (true or false)`);
        }
    }

    /**
     * Validate module order array
     * @private
     */
    _validateOrderArray(orderArray) {
        if (!Array.isArray(orderArray)) {
            throw new Error('Order array must be an array');
        }
        if (orderArray.length === 0) {
            throw new Error('Order array cannot be empty');
        }

        const uniqueIds = new Set(orderArray);
        if (uniqueIds.size !== orderArray.length) {
            throw new Error('Order array cannot contain duplicate module IDs');
        }

        orderArray.forEach(id => this._validateModuleId(id));
    }

    /**
     * Validate module dependencies before state changes with detailed reporting
     * @private
     */
    async _validateModuleDependencies(moduleId, enabled) {
        const registryEntry = this.moduleRegistry.get(moduleId);
        const validation = {
            valid: true,
            dependencies: [],
            dependents: [],
            hasActiveDependents: false,
            reason: null
        };

        if (enabled && registryEntry?.dependencies) {
            // Check if all dependencies are enabled
            for (const depId of registryEntry.dependencies) {
                const depModule = await this.moduleSettings.getModule(depId);
                const depInfo = {
                    moduleId: depId,
                    exists: !!depModule,
                    enabled: depModule?.enabled || false,
                    name: depModule?.name || 'Unknown'
                };
                validation.dependencies.push(depInfo);

                if (!depModule || !depModule.enabled) {
                    validation.valid = false;
                    validation.reason = `Cannot enable '${moduleId}' because required dependency '${depId}' is not enabled. Enable the dependency first or check if the module '${depId}' exists in the system.`;
                    return validation;
                }
            }
        }

        if (!enabled) {
            // Check if any enabled modules depend on this one
            const dependents = this._getModuleDependents(moduleId);
            const enabledDependents = [];

            for (const depId of dependents) {
                const depModule = await this.moduleSettings.getModule(depId);
                const depInfo = {
                    moduleId: depId,
                    exists: !!depModule,
                    enabled: depModule?.enabled || false,
                    name: depModule?.name || 'Unknown'
                };
                validation.dependents.push(depInfo);

                if (depModule && depModule.enabled) {
                    enabledDependents.push({ id: depId, name: depModule.name });
                }
            }

            if (enabledDependents.length > 0) {
                validation.valid = false;
                validation.hasActiveDependents = true;
                const depList = enabledDependents.map(d => `'${d.id}' (${d.name})`).join(', ');
                validation.reason = `Cannot disable '${moduleId}' because the following enabled modules depend on it: ${depList}. Disable the dependent modules first, or ensure they don't require this module's functionality.`;
                return validation;
            }
        }

        return validation;
    }

    /**
     * Validate module configuration against schema
     * @private
     */
    async _validateModuleConfiguration(moduleId, config) {
        if (config === null || config === undefined) {
            return null;
        }

        if (typeof config !== 'object') {
            throw new Error('Configuration must be an object');
        }

        const registryEntry = this.moduleRegistry.get(moduleId);
        if (registryEntry?.configSchema) {
            // Basic schema validation (could be enhanced with a proper JSON schema validator)
            return this._validateAgainstSchema(config, registryEntry.configSchema);
        }

        // Return config as-is if no schema defined
        return config;
    }

    /**
     * Basic schema validation
     * @private
     */
    _validateAgainstSchema(config, schema) {
        if (schema.type === 'object' && schema.properties) {
            const validated = {};

            for (const [key, propSchema] of Object.entries(schema.properties)) {
                if (config.hasOwnProperty(key)) {
                    validated[key] = this._validateProperty(config[key], propSchema, key);
                } else if (propSchema.default !== undefined) {
                    validated[key] = propSchema.default;
                }
            }

            return validated;
        }

        return config;
    }

    /**
     * Validate individual property against schema
     * @private
     */
    _validateProperty(value, schema, propertyName) {
        if (schema.type === 'boolean' && typeof value !== 'boolean') {
            throw new Error(`Property '${propertyName}' must be a boolean`);
        }

        if (schema.type === 'number' && typeof value !== 'number') {
            throw new Error(`Property '${propertyName}' must be a number`);
        }

        if (schema.type === 'string' && typeof value !== 'string') {
            throw new Error(`Property '${propertyName}' must be a string`);
        }

        if (schema.enum && !schema.enum.includes(value)) {
            throw new Error(`Property '${propertyName}' must be one of: ${schema.enum.join(', ')}`);
        }

        if (schema.minimum !== undefined && value < schema.minimum) {
            throw new Error(`Property '${propertyName}' must be at least ${schema.minimum}`);
        }

        return value;
    }

    /**
     * Check for configuration conflicts without throwing
     * @private
     */
    async _checkConfigurationConflicts(moduleId, config) {
        const conflicts = [];

        // Check for port conflicts, resource conflicts, etc.
        // This is a placeholder for more sophisticated conflict detection

        return conflicts;
    }

    /**
     * Get configuration warnings
     * @private
     */
    _getConfigurationWarnings(moduleId, config) {
        const warnings = [];

        if (!config) return warnings;

        // Generate warnings for potentially problematic configurations
        const registryEntry = this.moduleRegistry.get(moduleId);

        if (moduleId === 'aws-inspector' && config.refreshInterval) {
            if (config.refreshInterval < 60) {
                warnings.push('Refresh interval below 60 seconds may cause high API usage and potential rate limiting.');
            }
            if (config.refreshInterval > 3600) {
                warnings.push('Refresh interval above 1 hour may result in stale vulnerability data.');
            }
        }

        if (moduleId === 'sbom' && config.includeDevDependencies === true) {
            warnings.push('Including development dependencies may significantly increase report size and processing time.');
        }

        // Generic warnings
        if (typeof config === 'object') {
            const configKeys = Object.keys(config);
            const schemaProperties = registryEntry?.configSchema?.properties || {};
            const unknownKeys = configKeys.filter(key => !schemaProperties[key]);

            if (unknownKeys.length > 0) {
                warnings.push(`Unknown configuration properties will be ignored: ${unknownKeys.join(', ')}.`);
            }
        }

        return warnings;
    }

    /**
     * Get configuration suggestions for optimization
     * @private
     */
    _getConfigurationSuggestions(moduleId, config) {
        const suggestions = [];

        if (!config) return suggestions;

        if (moduleId === 'aws-inspector') {
            if (!config.hasOwnProperty('autoRefresh')) {
                suggestions.push('Consider enabling autoRefresh for real-time vulnerability monitoring.');
            }
            if (config.autoRefresh && !config.refreshInterval) {
                suggestions.push('Set a refreshInterval when autoRefresh is enabled to control update frequency.');
            }
        }

        if (moduleId === 'sbom') {
            if (!config.hasOwnProperty('format')) {
                suggestions.push('Specify a preferred format (json, xml, csv) for consistent SBOM exports.');
            }
        }

        return suggestions;
    }

    /**
     * Extract field name from validation error message
     * @private
     */
    _extractFieldFromError(errorMessage) {
        const match = errorMessage.match(/Property '([^']+)'/);
        return match ? match[1] : null;
    }

    /**
     * Validate that all module IDs exist
     * @private
     */
    async _validateModuleIdsExist(moduleIds) {
        for (const moduleId of moduleIds) {
            const module = await this.moduleSettings.getModule(moduleId);
            if (!module) {
                throw new Error(`Module '${moduleId}' not found`);
            }
        }
    }

    /**
     * Validate reorder conflicts
     * @private
     */
    async _validateReorderConflicts(orderArray) {
        // Check for any conflicts that would prevent reordering
        // This is a placeholder for more sophisticated conflict checking
    }

    /**
     * Get count of enabled modules
     * @private
     */
    async _getEnabledModuleCount() {
        const enabledModules = await this.moduleSettings.getEnabledModules();
        return enabledModules.length;
    }

    /**
     * Get modules that depend on the given module
     * @private
     */
    _getModuleDependents(moduleId) {
        const dependents = [];

        for (const [id, entry] of this.moduleRegistry.entries()) {
            if (entry.dependencies && entry.dependencies.includes(moduleId)) {
                dependents.push(id);
            }
        }

        return dependents;
    }

    /**
     * Check if a module can be disabled
     * @private
     */
    async _canModuleBeDisabled(moduleId) {
        const module = await this.moduleSettings.getModule(moduleId);
        if (!module) return false;

        // Cannot disable default modules
        if (module.is_default) return false;

        // Cannot disable if it would leave no enabled modules
        const enabledCount = await this._getEnabledModuleCount();
        if (module.enabled && enabledCount <= 1) return false;

        // Cannot disable if other modules depend on it
        const dependents = this._getModuleDependents(moduleId);
        for (const depId of dependents) {
            const depModule = await this.moduleSettings.getModule(depId);
            if (depModule && depModule.enabled) return false;
        }

        return true;
    }

    /**
     * Get module conflicts
     * @private
     */
    async _getModuleConflicts(moduleId) {
        const registryEntry = this.moduleRegistry.get(moduleId);
        return registryEntry?.conflicts || [];
    }

    /**
     * Enrich module data with registry information
     * @private
     */
    _enrichModuleWithRegistryData(module) {
        const registryEntry = this.moduleRegistry.get(module.module_id);

        return {
            ...module,
            dependencies: registryEntry?.dependencies || [],
            conflicts: registryEntry?.conflicts || [],
            hasConfigSchema: !!(registryEntry?.configSchema)
        };
    }

    /**
     * Handle module enable lifecycle
     * @private
     */
    async _handleModuleEnable(moduleId) {
        // Trigger module enable events
        // This could notify other parts of the system
        this._logAuditEvent('module_enable_lifecycle', 'system', {
            moduleId,
            action: 'enabled'
        });
    }

    /**
     * Handle module disable lifecycle
     * @private
     */
    async _handleModuleDisable(moduleId) {
        // Trigger module disable events
        // This could clean up resources, notify other parts of the system
        this._logAuditEvent('module_disable_lifecycle', 'system', {
            moduleId,
            action: 'disabled'
        });
    }

    /**
     * Handle configuration change lifecycle
     * @private
     */
    async _handleConfigurationChange(moduleId, config) {
        // Trigger configuration change events
        this._logAuditEvent('module_config_lifecycle', 'system', {
            moduleId,
            action: 'config_updated',
            config
        });
    }

    /**
     * Handle module reorder lifecycle
     * @private
     */
    async _handleModuleReorder(orderArray) {
        // Trigger reorder events
        this._logAuditEvent('module_reorder_lifecycle', 'system', {
            action: 'reordered',
            newOrder: orderArray
        });
    }

    /**
     * Log audit events
     * @private
     */
    _logAuditEvent(action, userId, details) {
        const auditEntry = {
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            action,
            userId,
            details: { ...details }
        };

        this.auditLog.push(auditEntry);

        // Keep only last 1000 entries to prevent memory leaks
        if (this.auditLog.length > 1000) {
            this.auditLog = this.auditLog.slice(-1000);
        }

        // In production, this would likely write to a database or external logging service
        console.log(`[AUDIT] ${action} by ${userId}:`, details);
    }
}

module.exports = ModuleService;