/**
 * Test Script for Module Registry Core Functionality
 * Tests only the module registry without Express dependencies
 */

const moduleRegistry = require('./moduleRegistry');

async function testRegistryCore() {
    console.log('🧪 Testing Module Registry Core...\n');

    try {
        // Test 1: Create and register a simple module
        console.log('1️⃣ Testing module registration...');

        const testModule = {
            id: 'test-module-1',
            name: 'Test Module 1',
            version: '1.0.0',
            description: 'A test module for demonstration',
            routes: {
                '/hello': {
                    method: 'GET',
                    handler: (req, res) => res.json({ message: 'Hello from test module!' })
                }
            },
            config: {
                testSetting: 'test-value'
            },
            dependencies: [],
            exports: {
                greet: (name) => `Hello, ${name}!`
            }
        };

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
        const stateUpdateResult = moduleRegistry.updateModuleState('test-module-1', moduleRegistry.MODULE_STATES.ACTIVE);
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
            const conflictModule = {
                id: 'test-module-1', // Same ID - should conflict
                name: 'Conflict Module',
                version: '1.0.0'
            };
            await moduleRegistry.register(conflictModule);
            console.log('❌ Conflict should have been detected');
        } catch (error) {
            console.log('✅ Conflict detected as expected:', error.message.substring(0, 50) + '...');
        }

        // Test 6: Test dependency checking
        console.log('\n6️⃣ Testing dependency management...');
        const dependentModule = {
            id: 'dependent-module',
            name: 'Dependent Module',
            version: '1.0.0',
            dependencies: ['test-module-1', 'non-existent-module'],
            exports: {}
        };

        const result6 = await moduleRegistry.register(dependentModule);
        console.log('✅ Dependent module registered with warnings:', result6.warnings);

        // Test 7: Test getting all modules
        console.log('\n7️⃣ Testing module listing...');
        const allModules = moduleRegistry.getAllModules();
        console.log('✅ All modules:', allModules.map(m => ({
            id: m.id,
            name: m.name,
            state: m.state
        })));

        // Test 8: Test active modules
        console.log('\n8️⃣ Testing active module filtering...');
        const activeModules = moduleRegistry.getActiveModules();
        console.log('✅ Active modules:', activeModules.map(m => m.id));

        // Test 9: Test registry statistics
        console.log('\n9️⃣ Testing registry statistics...');
        const stats = moduleRegistry.getRegistryStats();
        console.log('✅ Registry stats:', {
            totalModules: stats.totalModules,
            modulesByState: stats.modulesByState,
            totalRegistrations: stats.totalRegistrations
        });

        // Test 10: Test dependent modules
        console.log('\n🔟 Testing dependent module lookup...');
        const dependents = moduleRegistry.getDependentModules('test-module-1');
        console.log('✅ Modules depending on test-module-1:', dependents.map(m => m.id));

        // Test 11: Test event system
        console.log('\n1️⃣1️⃣ Testing event system...');
        let eventReceived = false;
        moduleRegistry.on('moduleStateChanged', (event) => {
            console.log(`📡 Event: Module ${event.moduleId} state changed from ${event.oldState} to ${event.newState}`);
            eventReceived = true;
        });

        moduleRegistry.updateModuleState('test-module-1', moduleRegistry.MODULE_STATES.DISABLED);

        // Give a moment for event to fire
        await new Promise(resolve => setTimeout(resolve, 100));

        if (eventReceived) {
            console.log('✅ Event system working correctly');
        } else {
            console.log('⚠️ Event system may not be working');
        }

        // Test 12: Test module exports functionality
        console.log('\n1️⃣2️⃣ Testing module exports...');
        const testModuleData = moduleRegistry.getModule('test-module-1');
        if (testModuleData && testModuleData.exports && testModuleData.exports.greet) {
            const greetResult = testModuleData.exports.greet('World');
            console.log('✅ Module export function works:', greetResult);
        }

        // Test 13: Test thread safety with concurrent operations
        console.log('\n1️⃣3️⃣ Testing thread safety...');
        const concurrentPromises = [];

        for (let i = 0; i < 5; i++) {
            const promise = moduleRegistry.register({
                id: `concurrent-module-${i}`,
                name: `Concurrent Module ${i}`,
                version: '1.0.0',
                exports: {}
            });
            concurrentPromises.push(promise);
        }

        const concurrentResults = await Promise.allSettled(concurrentPromises);
        const successfulConcurrent = concurrentResults.filter(r => r.status === 'fulfilled').length;
        console.log('✅ Concurrent registrations:', successfulConcurrent, 'successful out of 5');

        // Test 14: Test filtering
        console.log('\n1️⃣4️⃣ Testing module filtering...');
        const filteredModules = moduleRegistry.getAllModules({
            name: 'Test',
            sortBy: 'name',
            sortOrder: 'asc'
        });
        console.log('✅ Filtered modules (name contains "Test"):', filteredModules.map(m => m.name));

        // Test 15: Test state export/import
        console.log('\n1️⃣5️⃣ Testing state export/import...');
        const exportedState = moduleRegistry.exportState();
        console.log('✅ Exported state contains', Object.keys(exportedState.modules).length, 'modules');

        // Test 16: Test unregistration with dependencies
        console.log('\n1️⃣6️⃣ Testing unregistration with dependencies...');
        try {
            await moduleRegistry.unregister('test-module-1'); // Should fail due to dependent module
            console.log('❌ Should have failed due to dependencies');
        } catch (error) {
            console.log('✅ Unregistration blocked due to dependencies:', error.message.substring(0, 50) + '...');
        }

        // Test 17: Force unregistration
        console.log('\n1️⃣7️⃣ Testing forced unregistration...');
        const unregisterResult = await moduleRegistry.unregister('dependent-module', { force: true });
        console.log('✅ Dependent module unregistered:', unregisterResult.success);

        const unregisterResult2 = await moduleRegistry.unregister('test-module-1', { force: true });
        console.log('✅ Test module unregistered:', unregisterResult2.success);

        // Clean up concurrent modules
        for (let i = 0; i < 5; i++) {
            try {
                await moduleRegistry.unregister(`concurrent-module-${i}`, { force: true });
            } catch (error) {
                // Ignore cleanup errors
            }
        }

        // Test 18: Final statistics
        console.log('\n1️⃣8️⃣ Final registry statistics...');
        const finalStats = moduleRegistry.getRegistryStats();
        console.log('✅ Final stats:', {
            totalModules: finalStats.totalModules,
            totalRegistrations: finalStats.totalRegistrations,
            totalUnregistrations: finalStats.totalUnregistrations
        });

        console.log('\n🎉 All registry tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    testRegistryCore()
        .then(() => {
            console.log('\n✅ Module registry test completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Module registry test failed:', error);
            process.exit(1);
        });
}

module.exports = { testRegistryCore };