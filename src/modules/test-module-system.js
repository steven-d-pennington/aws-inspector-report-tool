/**
 * Test Script for Module Registry System
 * Demonstrates module registration, loading, and management
 */

const moduleRegistry = require('./moduleRegistry');
const moduleLoader = require('./moduleLoader');
const { createModule } = require('./index');

async function testModuleSystem() {
    console.log('🧪 Testing Module Registry System...\n');

    try {
        // Test 1: Create and register a simple module
        console.log('1️⃣ Testing module creation and registration...');

        const testModule = createModule({
            id: 'test-module-1',
            name: 'Test Module 1',
            description: 'A test module for demonstration',
            routes: {
                '/hello': {
                    method: 'GET',
                    handler: (req, res) => res.json({ message: 'Hello from test module!' })
                }
            },
            config: {
                testSetting: 'test-value'
            }
        });

        const result1 = await moduleRegistry.register(testModule);
        console.log('✅ Module registered:', result1);

        // Test 2: Get module information
        console.log('\n2️⃣ Testing module retrieval...');
        const retrievedModule = moduleRegistry.getModule('test-module-1');
        console.log('✅ Retrieved module:', {
            id: retrievedModule.id,
            name: retrievedModule.name,
            state: retrievedModule.state
        });

        // Test 3: Test module state management
        console.log('\n3️⃣ Testing module state management...');
        const stateUpdateResult = moduleRegistry.updateModuleState('test-module-1', 'active');
        console.log('✅ State updated:', stateUpdateResult);

        // Test 4: Test configuration updates
        console.log('\n4️⃣ Testing configuration updates...');
        const configUpdateResult = moduleRegistry.updateModuleConfig('test-module-1', {
            testSetting: 'updated-value',
            newSetting: 'new-value'
        });
        console.log('✅ Config updated:', configUpdateResult);

        // Test 5: Test module conflicts
        console.log('\n5️⃣ Testing module conflict detection...');
        try {
            const conflictModule = createModule({
                id: 'test-module-1', // Same ID - should conflict
                name: 'Conflict Module'
            });
            await moduleRegistry.register(conflictModule);
        } catch (error) {
            console.log('✅ Conflict detected as expected:', error.message.substring(0, 50) + '...');
        }

        // Test 6: Test dependency checking
        console.log('\n6️⃣ Testing dependency management...');
        const dependentModule = createModule({
            id: 'dependent-module',
            name: 'Dependent Module',
            dependencies: ['test-module-1', 'non-existent-module']
        });

        const result6 = await moduleRegistry.register(dependentModule);
        console.log('✅ Dependent module registered with warnings:', result6.warnings);

        // Test 7: Test module loading from file
        console.log('\n7️⃣ Testing module loading from file...');
        try {
            const loadResult = await moduleLoader.loadFromFile('./src/modules/example-module.js');
            console.log('✅ Module loaded from file:', {
                success: loadResult.success,
                moduleId: loadResult.moduleId,
                loadedFrom: loadResult.loadedFrom.split('/').pop()
            });
        } catch (error) {
            console.log('⚠️ Could not load example module (file may not exist):', error.message.substring(0, 50) + '...');
        }

        // Test 8: Test getting all modules
        console.log('\n8️⃣ Testing module listing...');
        const allModules = moduleRegistry.getAllModules();
        console.log('✅ All modules:', allModules.map(m => ({
            id: m.id,
            name: m.name,
            state: m.state
        })));

        // Test 9: Test active modules
        console.log('\n9️⃣ Testing active module filtering...');
        const activeModules = moduleRegistry.getActiveModules();
        console.log('✅ Active modules:', activeModules.map(m => m.id));

        // Test 10: Test registry statistics
        console.log('\n🔟 Testing registry statistics...');
        const stats = moduleRegistry.getRegistryStats();
        console.log('✅ Registry stats:', {
            totalModules: stats.totalModules,
            modulesByState: stats.modulesByState,
            totalRegistrations: stats.totalRegistrations
        });

        // Test 11: Test dependent modules
        console.log('\n1️⃣1️⃣ Testing dependent module lookup...');
        const dependents = moduleRegistry.getDependentModules('test-module-1');
        console.log('✅ Modules depending on test-module-1:', dependents.map(m => m.id));

        // Test 12: Test event system
        console.log('\n1️⃣2️⃣ Testing event system...');
        moduleRegistry.on('moduleStateChanged', (event) => {
            console.log(`📡 Event: Module ${event.moduleId} state changed from ${event.oldState} to ${event.newState}`);
        });

        moduleRegistry.updateModuleState('test-module-1', 'disabled');

        // Test 13: Test module export functionality
        console.log('\n1️⃣3️⃣ Testing module exports...');
        const testModuleData = moduleRegistry.getModule('test-module-1');
        if (testModuleData && testModuleData.exports) {
            console.log('✅ Module exports available:', Object.keys(testModuleData.exports));
        }

        // Test 14: Test unregistration with dependencies
        console.log('\n1️⃣4️⃣ Testing unregistration with dependencies...');
        try {
            await moduleRegistry.unregister('test-module-1'); // Should fail due to dependent module
        } catch (error) {
            console.log('✅ Unregistration blocked due to dependencies:', error.message.substring(0, 50) + '...');
        }

        // Test 15: Force unregistration
        console.log('\n1️⃣5️⃣ Testing forced unregistration...');
        const unregisterResult = await moduleRegistry.unregister('dependent-module', { force: true });
        console.log('✅ Dependent module unregistered:', unregisterResult.success);

        const unregisterResult2 = await moduleRegistry.unregister('test-module-1', { force: true });
        console.log('✅ Test module unregistered:', unregisterResult2.success);

        // Test 16: Final statistics
        console.log('\n1️⃣6️⃣ Final registry statistics...');
        const finalStats = moduleRegistry.getRegistryStats();
        console.log('✅ Final stats:', {
            totalModules: finalStats.totalModules,
            totalRegistrations: finalStats.totalRegistrations,
            totalUnregistrations: finalStats.totalUnregistrations
        });

        console.log('\n🎉 All tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    testModuleSystem()
        .then(() => {
            console.log('\n✅ Module system test completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Module system test failed:', error);
            process.exit(1);
        });
}

module.exports = { testModuleSystem };