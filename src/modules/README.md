# Module Registry System

A comprehensive runtime module registration and management system for Node.js applications with Express.js integration.

## Overview

The Module Registry System provides:

- **In-memory module registry** with thread-safe operations
- **Dynamic module loading** from files and directories
- **Express.js router integration** for automatic route registration
- **Module lifecycle management** with state tracking
- **Dependency resolution** and conflict detection
- **Event-driven architecture** for module lifecycle events
- **Configuration management** and metadata storage

## Core Components

### 1. ModuleRegistry (`moduleRegistry.js`)

The central registry for managing loaded modules.

**Key Features:**
- Thread-safe operations with operation queuing
- Module state management (loaded, active, error, disabled, unloading)
- Dependency tracking and conflict detection
- Event emission for lifecycle events
- Configuration and metadata management
- Statistics and monitoring

**Methods:**
```javascript
const moduleRegistry = require('./moduleRegistry');

// Register a module
await moduleRegistry.register(moduleDefinition, options);

// Unregister a module
await moduleRegistry.unregister(moduleId, options);

// Get module information
const module = moduleRegistry.getModule(moduleId);

// Get all modules with optional filtering
const modules = moduleRegistry.getAllModules(filter);

// Get only active modules
const activeModules = moduleRegistry.getActiveModules();

// Update module state
moduleRegistry.updateModuleState(moduleId, newState, metadata);

// Update module configuration
moduleRegistry.updateModuleConfig(moduleId, config);

// Get registry statistics
const stats = moduleRegistry.getRegistryStats();
```

### 2. ModuleLoader (`moduleLoader.js`)

Handles dynamic loading of modules from files and directories.

**Key Features:**
- Load modules from individual files or entire directories
- File watching for automatic reloading
- Support for CommonJS and ES6 modules
- Module template generation
- Require cache management

**Methods:**
```javascript
const moduleLoader = require('./moduleLoader');

// Load module from file
const result = await moduleLoader.loadFromFile(filePath, options);

// Load all modules from directory
const results = await moduleLoader.loadFromDirectory(directoryPath, options);

// Reload a specific module
const reloadResult = await moduleLoader.reloadModule(moduleId, options);

// Unload a module
await moduleLoader.unloadModule(moduleId);

// Create module template
const template = moduleLoader.createModuleTemplate(moduleInfo);
```

### 3. RouterIntegration (`routerIntegration.js`)

Integrates module registry with Express.js routing system.

**Key Features:**
- Automatic route registration when modules are loaded
- Route conflict detection
- Module-specific middleware support
- Route prefix management
- Express router management

**Methods:**
```javascript
const RouterIntegration = require('./routerIntegration');
const routerIntegration = new RouterIntegration(expressApp);

// Register routes for a module
await routerIntegration.registerModuleRoutes(moduleId);

// Unregister routes for a module
await routerIntegration.unregisterModuleRoutes(moduleId);

// Get all registered routes
const routes = routerIntegration.getAllRegisteredRoutes();

// Register all active modules
await routerIntegration.registerAllActiveModules();
```

## Module Definition Format

Modules should follow this structure:

```javascript
const moduleDefinition = {
    // Required fields
    id: 'unique-module-id',
    name: 'Human Readable Module Name',
    version: '1.0.0',

    // Optional fields
    description: 'Module description',

    // Configuration
    config: {
        enabled: true,
        routePrefix: '/custom-prefix',
        settings: {
            // Module-specific settings
        }
    },

    // Dependencies on other modules
    dependencies: ['other-module-id'],

    // Express routes
    routes: {
        '/': {
            method: 'GET',
            handler: (req, res) => {
                res.json({ message: 'Hello from module' });
            },
            middleware: [/* optional middleware */]
        },
        '/status': {
            method: 'GET',
            handler: (req, res) => {
                res.json({ status: 'active' });
            }
        }
    },

    // Module-level middleware (applied to all routes)
    middleware: [
        (req, res, next) => {
            // Module middleware
            next();
        }
    ],

    // Public API exports (for other modules)
    exports: {
        publicMethod: () => 'result',
        getData: () => ({ data: 'value' })
    },

    // Lifecycle hooks
    hooks: {
        init: async function() {
            // Called when module is loaded
        },
        cleanup: async function() {
            // Called when module is unloaded
        }
    },

    // Module metadata
    metadata: {
        author: 'Author Name',
        license: 'MIT',
        keywords: ['tag1', 'tag2'],
        homepage: 'https://example.com',
        repository: 'https://github.com/user/repo'
    }
};

module.exports = moduleDefinition;
```

## Quick Start

### 1. Basic Usage

```javascript
const { initializeModuleSystem } = require('./src/modules');
const express = require('express');

const app = express();

// Initialize module system
const moduleSystem = initializeModuleSystem(app);

// Create and register a simple module
const { createModule } = require('./src/modules');

const myModule = createModule({
    id: 'my-module',
    name: 'My Module',
    routes: {
        '/hello': {
            method: 'GET',
            handler: (req, res) => res.json({ message: 'Hello!' })
        }
    }
});

// Register the module
await moduleSystem.registry.register(myModule);

app.listen(3000);
```

### 2. Load Modules from Directory

```javascript
const { quickStartModules } = require('./src/modules');
const express = require('express');

const app = express();

// Load all modules from directory and set up routes
const result = await quickStartModules(app, './src/modules', {
    watch: true // Enable file watching for auto-reload
});

console.log(\`Loaded \${result.stats.totalModules} modules with \${result.stats.totalRoutes} routes\`);

app.listen(3000);
```

### 3. Manual Module Loading

```javascript
const moduleRegistry = require('./src/modules/moduleRegistry');
const moduleLoader = require('./src/modules/moduleLoader');

// Load module from file
const loadResult = await moduleLoader.loadFromFile('./my-module.js');

// Get module information
const module = moduleRegistry.getModule('my-module-id');

// Update module state
moduleRegistry.updateModuleState('my-module-id', 'active');
```

## Event System

The module registry emits events for various lifecycle changes:

```javascript
const moduleRegistry = require('./src/modules/moduleRegistry');

// Listen to module events
moduleRegistry.on('moduleRegistered', (event) => {
    console.log(\`Module \${event.moduleId} registered\`);
});

moduleRegistry.on('moduleUnregistered', (event) => {
    console.log(\`Module \${event.moduleId} unregistered\`);
});

moduleRegistry.on('moduleStateChanged', (event) => {
    console.log(\`Module \${event.moduleId} state: \${event.oldState} → \${event.newState}\`);
});

moduleRegistry.on('moduleConfigChanged', (event) => {
    console.log(\`Module \${event.moduleId} config updated\`);
});
```

## Thread Safety

All operations are thread-safe using an internal operation queue:

```javascript
// These operations are automatically queued and executed safely
const promises = [
    moduleRegistry.register(module1),
    moduleRegistry.register(module2),
    moduleRegistry.updateModuleState('module1', 'active'),
    moduleRegistry.unregister('old-module')
];

await Promise.all(promises); // Safe concurrent execution
```

## Error Handling

The system provides comprehensive error handling:

```javascript
try {
    await moduleRegistry.register(invalidModule);
} catch (error) {
    if (error.validationErrors) {
        console.log('Validation errors:', error.validationErrors);
    }
    if (error.conflicts) {
        console.log('Module conflicts:', error.conflicts);
    }
}
```

## Statistics and Monitoring

Get detailed statistics about the module system:

```javascript
const stats = moduleRegistry.getRegistryStats();
console.log(stats);
// Output:
// {
//   totalModules: 5,
//   totalRegistrations: 8,
//   totalUnregistrations: 3,
//   modulesByState: {
//     loaded: 2,
//     active: 3,
//     error: 0,
//     disabled: 0,
//     unloading: 0
//   },
//   totalRoutes: 15,
//   totalDependencies: 4,
//   uptime: 145000,
//   memoryUsage: { /* process memory */ }
// }
```

## Testing

Run the included tests:

```bash
# Test core registry functionality
node src/modules/test-registry-only.js

# Test full system (requires Express)
node src/modules/test-module-system.js
```

## File Structure

```
src/modules/
├── moduleRegistry.js      # Core module registry
├── moduleLoader.js        # Module loading functionality
├── routerIntegration.js   # Express integration
├── index.js              # Main export and utilities
├── example-module.js      # Example module implementation
├── test-registry-only.js # Core functionality tests
├── test-module-system.js  # Full system tests
└── README.md             # This file
```

## Integration with Existing Systems

The module system is designed to integrate seamlessly with existing Express applications:

1. **Minimal Setup**: Just pass your Express app to `initializeModuleSystem()`
2. **Non-intrusive**: Existing routes and middleware continue to work
3. **Configurable**: Module route prefixes prevent conflicts
4. **Backwards Compatible**: Can be added to existing projects without changes

## Best Practices

1. **Module IDs**: Use kebab-case, unique identifiers
2. **Dependencies**: Keep dependency chains shallow
3. **Error Handling**: Always implement cleanup hooks
4. **Route Prefixes**: Use meaningful prefixes to avoid conflicts
5. **State Management**: Use the registry's state system instead of global variables
6. **Events**: Listen to registry events for debugging and monitoring

## Example Module

See `example-module.js` for a complete working example with:
- Route definitions
- Middleware usage
- Public API exports
- Lifecycle hooks
- Configuration management
- Comprehensive metadata