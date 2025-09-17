/**
 * Test file demonstrating the usage of ModuleLoader
 * This is not a formal test suite, but rather an example of how to use the loader
 */

const ModuleLoader = require('./moduleLoader');
const Database = require('../models/database');

async function testModuleLoader() {
    console.log('=== Module Loader Test ===\n');

    // Initialize database
    const db = new Database();
    await db.initialize();

    // Create module loader instance
    const moduleLoader = new ModuleLoader(db);

    try {
        // Test 1: Discover modules
        console.log('1. Testing module discovery...');
        const discoveredModules = await moduleLoader.discoverModules();
        console.log('Discovered modules:', discoveredModules.map(m => m.id));
        console.log('');

        // Test 2: Load a specific module
        console.log('2. Testing single module loading...');
        if (discoveredModules.length > 0) {
            const firstModule = discoveredModules[0];
            const loadedModule = await moduleLoader.loadModule(firstModule.id);
            if (loadedModule) {
                console.log(`Successfully loaded: ${loadedModule.name}`);
                console.log(`Module has router: ${!!loadedModule.router}`);
                console.log(`Module metadata:`, loadedModule._metadata);
            }
        }
        console.log('');

        // Test 3: Load enabled modules from database
        console.log('3. Testing enabled modules loading...');
        const enabledModules = await moduleLoader.loadEnabledModules();
        console.log('Enabled modules:');
        enabledModules.forEach(module => {
            console.log(`  - ${module.name} (${module.id})`);
            console.log(`    Enabled: ${module._settings.enabled}`);
            console.log(`    Display Order: ${module._settings.displayOrder}`);
        });
        console.log('');

        // Test 4: Get loader statistics
        console.log('4. Testing loader statistics...');
        const stats = moduleLoader.getStats();
        console.log('Loader stats:', stats);
        console.log('');

        // Test 5: Test module validation with invalid module
        console.log('5. Testing module validation...');
        const invalidModule = { name: 'Invalid' }; // Missing required 'id' and 'initialize'
        const validation = moduleLoader.validateModule(invalidModule, 'test');
        console.log('Validation result for invalid module:');
        console.log('  Is valid:', validation.isValid);
        console.log('  Errors:', validation.errors);
        console.log('');

        // Test 6: Test module caching
        console.log('6. Testing module caching...');
        if (discoveredModules.length > 0) {
            const moduleId = discoveredModules[0].id;
            console.log(`Loading ${moduleId} first time...`);
            const start1 = Date.now();
            await moduleLoader.loadModule(moduleId);
            const time1 = Date.now() - start1;

            console.log(`Loading ${moduleId} second time (should use cache)...`);
            const start2 = Date.now();
            await moduleLoader.loadModule(moduleId);
            const time2 = Date.now() - start2;

            console.log(`First load: ${time1}ms, Second load: ${time2}ms`);
        }
        console.log('');

        // Test 7: Test hot reloading setup (development only)
        console.log('7. Testing hot reloading setup...');
        await moduleLoader.enableHotReloading();
        console.log('');

        console.log('=== All tests completed successfully! ===');

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        // Cleanup
        await moduleLoader.clearAllModules();
        console.log('Cleanup completed.');
    }
}

// Export for programmatic use
module.exports = { testModuleLoader };

// Run tests if this file is executed directly
if (require.main === module) {
    testModuleLoader().catch(console.error);
}