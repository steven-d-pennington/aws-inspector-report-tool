const fs = require('fs').promises;
const path = require('path');
const moduleRegistry = require('./moduleRegistry');

/**
 * Module Loader for dynamic module loading and integration
 * Works with ModuleRegistry to provide complete module lifecycle management
 */
class ModuleLoader {
    constructor() {
        this.loadedPaths = new Set();
        this.watchedDirectories = new Set();
        this.fileWatchers = new Map();
    }

    /**
     * Load a module from file path
     * @param {string} modulePath - Path to module file
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Load result
     */
    async loadFromFile(modulePath, options = {}) {
        try {
            // Resolve absolute path
            const absolutePath = path.resolve(modulePath);

            // Check if file exists
            try {
                await fs.access(absolutePath);
            } catch (error) {
                throw new Error(`Module file not found: ${absolutePath}`);
            }

            // Clear require cache if reloading
            if (options.reload && require.cache[absolutePath]) {
                delete require.cache[absolutePath];
            }

            // Load module
            const moduleExports = require(absolutePath);

            // Extract module definition
            let moduleDefinition;
            if (typeof moduleExports === 'function') {
                // Module is a factory function
                moduleDefinition = await moduleExports(options.context || {});
            } else if (moduleExports.default) {
                // ES6 module with default export
                moduleDefinition = moduleExports.default;
            } else {
                // Direct module definition
                moduleDefinition = moduleExports;
            }

            // Add metadata
            moduleDefinition.metadata = {
                ...(moduleDefinition.metadata || {}),
                loadedFrom: absolutePath,
                loadedAt: new Date(),
                loaderOptions: options
            };

            // Register with registry
            const registrationResult = await moduleRegistry.register(moduleDefinition, options);

            // Track loaded path
            this.loadedPaths.add(absolutePath);

            // Set up file watching if requested
            if (options.watch) {
                await this.watchFile(absolutePath, async () => {
                    try {
                        await this.reloadModule(moduleDefinition.id, options);
                    } catch (error) {
                        moduleRegistry.emit('moduleReloadFailed', {
                            moduleId: moduleDefinition.id,
                            error: error.message,
                            timestamp: new Date()
                        });
                    }
                });
            }

            return {
                success: true,
                moduleId: moduleDefinition.id,
                loadedFrom: absolutePath,
                registrationResult
            };

        } catch (error) {
            throw new Error(`Failed to load module from ${modulePath}: ${error.message}`);
        }
    }

    /**
     * Load modules from directory
     * @param {string} directoryPath - Directory containing modules
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Load results
     */
    async loadFromDirectory(directoryPath, options = {}) {
        try {
            const absolutePath = path.resolve(directoryPath);

            // Check if directory exists
            try {
                const stats = await fs.stat(absolutePath);
                if (!stats.isDirectory()) {
                    throw new Error(`Path is not a directory: ${absolutePath}`);
                }
            } catch (error) {
                throw new Error(`Directory not found: ${absolutePath}`);
            }

            const results = {
                loaded: [],
                failed: [],
                skipped: []
            };

            // Read directory contents
            const entries = await fs.readdir(absolutePath, { withFileTypes: true });

            // Filter for JavaScript files
            const moduleFiles = entries
                .filter(entry => entry.isFile())
                .filter(entry => {
                    const ext = path.extname(entry.name).toLowerCase();
                    return ext === '.js' || ext === '.mjs';
                })
                .filter(entry => {
                    // Skip files starting with . or _
                    return !entry.name.startsWith('.') && !entry.name.startsWith('_');
                });

            // Load each module file
            for (const file of moduleFiles) {
                const filePath = path.join(absolutePath, file.name);

                try {
                    // Skip if already loaded and not reloading
                    if (this.loadedPaths.has(filePath) && !options.reload) {
                        results.skipped.push({
                            file: file.name,
                            reason: 'Already loaded'
                        });
                        continue;
                    }

                    const loadResult = await this.loadFromFile(filePath, options);
                    results.loaded.push({
                        file: file.name,
                        moduleId: loadResult.moduleId,
                        result: loadResult
                    });

                } catch (error) {
                    results.failed.push({
                        file: file.name,
                        error: error.message
                    });
                }
            }

            // Set up directory watching if requested
            if (options.watch) {
                await this.watchDirectory(absolutePath, options);
            }

            return results;

        } catch (error) {
            throw new Error(`Failed to load modules from directory ${directoryPath}: ${error.message}`);
        }
    }

    /**
     * Reload a specific module
     * @param {string} moduleId - Module ID to reload
     * @param {Object} options - Reload options
     * @returns {Promise<Object>} Reload result
     */
    async reloadModule(moduleId, options = {}) {
        try {
            // Get current module info
            const currentModule = moduleRegistry.getModule(moduleId);
            if (!currentModule) {
                throw new Error(`Module '${moduleId}' is not registered`);
            }

            const modulePath = currentModule.metadata.loadedFrom;
            if (!modulePath) {
                throw new Error(`Module '${moduleId}' was not loaded from file`);
            }

            // Unregister current module
            await moduleRegistry.unregister(moduleId, { force: true });

            // Remove from loaded paths
            this.loadedPaths.delete(modulePath);

            // Reload module
            const reloadResult = await this.loadFromFile(modulePath, {
                ...options,
                reload: true
            });

            moduleRegistry.emit('moduleReloaded', {
                moduleId,
                oldVersion: currentModule.version,
                newVersion: reloadResult.moduleId,
                timestamp: new Date()
            });

            return reloadResult;

        } catch (error) {
            throw new Error(`Failed to reload module '${moduleId}': ${error.message}`);
        }
    }

    /**
     * Watch a file for changes
     * @param {string} filePath - File to watch
     * @param {Function} callback - Callback to execute on change
     * @returns {Promise<void>}
     */
    async watchFile(filePath, callback) {
        if (this.fileWatchers.has(filePath)) {
            return; // Already watching
        }

        try {
            const fs = require('fs');
            const watcher = fs.watchFile(filePath, { interval: 1000 }, (curr, prev) => {
                if (curr.mtime > prev.mtime) {
                    callback();
                }
            });

            this.fileWatchers.set(filePath, watcher);

        } catch (error) {
            throw new Error(`Failed to watch file ${filePath}: ${error.message}`);
        }
    }

    /**
     * Watch a directory for changes
     * @param {string} directoryPath - Directory to watch
     * @param {Object} options - Watch options
     * @returns {Promise<void>}
     */
    async watchDirectory(directoryPath, options = {}) {
        if (this.watchedDirectories.has(directoryPath)) {
            return; // Already watching
        }

        try {
            const fs = require('fs');
            const watcher = fs.watch(directoryPath, async (eventType, filename) => {
                if (eventType === 'change' && filename) {
                    const filePath = path.join(directoryPath, filename);
                    const ext = path.extname(filename).toLowerCase();

                    // Only handle JavaScript files
                    if (ext === '.js' || ext === '.mjs') {
                        try {
                            // Find module by file path
                            const modules = moduleRegistry.getAllModules();
                            const targetModule = modules.find(m =>
                                m.metadata.loadedFrom === filePath
                            );

                            if (targetModule) {
                                await this.reloadModule(targetModule.id, options);
                            }
                        } catch (error) {
                            moduleRegistry.emit('directoryWatchError', {
                                directory: directoryPath,
                                filename,
                                error: error.message,
                                timestamp: new Date()
                            });
                        }
                    }
                }
            });

            this.watchedDirectories.add(directoryPath);
            this.fileWatchers.set(directoryPath, watcher);

        } catch (error) {
            throw new Error(`Failed to watch directory ${directoryPath}: ${error.message}`);
        }
    }

    /**
     * Stop watching a file or directory
     * @param {string} path - Path to stop watching
     * @returns {boolean} Success status
     */
    stopWatching(path) {
        if (this.fileWatchers.has(path)) {
            const watcher = this.fileWatchers.get(path);

            if (typeof watcher.close === 'function') {
                watcher.close();
            } else {
                // For fs.watchFile
                require('fs').unwatchFile(path);
            }

            this.fileWatchers.delete(path);
            this.watchedDirectories.delete(path);
            return true;
        }
        return false;
    }

    /**
     * Stop all file watching
     * @returns {number} Number of watchers stopped
     */
    stopAllWatching() {
        let stoppedCount = 0;

        for (const path of this.fileWatchers.keys()) {
            if (this.stopWatching(path)) {
                stoppedCount++;
            }
        }

        return stoppedCount;
    }

    /**
     * Unload a module (remove from require cache and registry)
     * @param {string} moduleId - Module ID to unload
     * @returns {Promise<boolean>} Success status
     */
    async unloadModule(moduleId) {
        try {
            const module = moduleRegistry.getModule(moduleId);
            if (!module) {
                return false;
            }

            const modulePath = module.metadata.loadedFrom;

            // Remove from require cache
            if (modulePath && require.cache[modulePath]) {
                delete require.cache[modulePath];
            }

            // Unregister from registry
            await moduleRegistry.unregister(moduleId);

            // Remove from loaded paths
            if (modulePath) {
                this.loadedPaths.delete(modulePath);
            }

            return true;

        } catch (error) {
            throw new Error(`Failed to unload module '${moduleId}': ${error.message}`);
        }
    }

    /**
     * Create module definition template
     * @param {Object} moduleInfo - Basic module information
     * @returns {Object} Module template
     */
    createModuleTemplate(moduleInfo = {}) {
        return {
            id: moduleInfo.id || 'new-module',
            name: moduleInfo.name || 'New Module',
            version: moduleInfo.version || '1.0.0',
            description: moduleInfo.description || 'A new module',

            // Module configuration
            config: {
                enabled: true,
                settings: {}
            },

            // Dependencies
            dependencies: [],

            // Routes (Express.js format)
            routes: {
                '/': {
                    method: 'GET',
                    handler: (req, res) => {
                        res.json({ message: `Hello from ${moduleInfo.name || 'New Module'}` });
                    }
                }
            },

            // Module exports (API)
            exports: {
                // Public methods that other modules can use
            },

            // Lifecycle hooks
            hooks: {
                // Called when module is loaded
                init: async function() {
                    console.log(`Module ${this.name} initialized`);
                },

                // Called when module is unloaded
                cleanup: async function() {
                    console.log(`Module ${this.name} cleaned up`);
                }
            },

            // Metadata
            metadata: {
                author: 'Unknown',
                license: 'MIT',
                keywords: [],
                homepage: '',
                repository: ''
            }
        };
    }

    /**
     * Get loader statistics
     * @returns {Object} Loader statistics
     */
    getLoaderStats() {
        return {
            loadedPaths: Array.from(this.loadedPaths),
            watchedDirectories: Array.from(this.watchedDirectories),
            activeWatchers: this.fileWatchers.size,
            totalLoaded: this.loadedPaths.size
        };
    }
}

// Create and export singleton instance
const moduleLoader = new ModuleLoader();

module.exports = moduleLoader;