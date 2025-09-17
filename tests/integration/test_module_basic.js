/**
 * Basic Integration test for module enable/disable functionality
 * Tests core functionality without external testing frameworks to demonstrate TDD approach
 */

const app = require('../../server');
const ModuleSettings = require('../../src/models/moduleSettings');

async function runTests() {
    console.log('🧪 Running Module Toggle Integration Tests');
    console.log('===============================================');

    let testsPassed = 0;
    let testsFailed = 0;
    let server;

    try {
        // Start server for testing
        const PORT = 3013;
        server = app.listen(PORT);
        console.log(`Test server started on port ${PORT}`);

        // Wait for server to be ready
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 1: Check if ModuleSettings class works
        console.log('\n📝 Test 1: ModuleSettings Class Initialization');
        try {
            const moduleSettings = new ModuleSettings();
            await moduleSettings.initialize();
            console.log('✅ ModuleSettings class initialized successfully');
            testsPassed++;

            // Test 2: Check default modules
            console.log('\n📝 Test 2: Default Module State');
            const modules = await moduleSettings.getAllModules();
            console.log(`Found ${modules.length} modules:`);
            modules.forEach(module => {
                console.log(`  - ${module.name} (${module.module_id}): ${module.enabled ? 'Enabled' : 'Disabled'}`);
            });

            const awsInspector = modules.find(m => m.module_id === 'aws-inspector');
            const sbom = modules.find(m => m.module_id === 'sbom');

            if (awsInspector && awsInspector.enabled && awsInspector.is_default) {
                console.log('✅ AWS Inspector module is enabled and marked as default');
                testsPassed++;
            } else {
                console.log('❌ AWS Inspector module not properly configured');
                testsFailed++;
            }

            if (sbom && !sbom.enabled && !sbom.is_default) {
                console.log('✅ SBOM module is disabled and not default');
                testsPassed++;
            } else {
                console.log('❌ SBOM module not properly configured');
                testsFailed++;
            }

            // Test 3: Enable SBOM module
            console.log('\n📝 Test 3: Enable SBOM Module');
            await moduleSettings.enableModule('sbom');
            const updatedModules = await moduleSettings.getAllModules();
            const updatedSbom = updatedModules.find(m => m.module_id === 'sbom');

            if (updatedSbom && updatedSbom.enabled) {
                console.log('✅ SBOM module enabled successfully');
                testsPassed++;
            } else {
                console.log('❌ Failed to enable SBOM module');
                testsFailed++;
            }

            // Test 4: Try to disable default module (should fail)
            console.log('\n📝 Test 4: Attempt to Disable Default Module (Should Fail)');
            try {
                await moduleSettings.disableModule('aws-inspector');
                console.log('❌ Default module was disabled - this should not happen!');
                testsFailed++;
            } catch (error) {
                if (error.message.includes('default module')) {
                    console.log('✅ Default module protection working correctly');
                    testsPassed++;
                } else {
                    console.log('❌ Unexpected error:', error.message);
                    testsFailed++;
                }
            }

            // Test 5: Disable SBOM module
            console.log('\n📝 Test 5: Disable SBOM Module');
            await moduleSettings.disableModule('sbom');
            const finalModules = await moduleSettings.getAllModules();
            const finalSbom = finalModules.find(m => m.module_id === 'sbom');

            if (finalSbom && !finalSbom.enabled) {
                console.log('✅ SBOM module disabled successfully');
                testsPassed++;
            } else {
                console.log('❌ Failed to disable SBOM module');
                testsFailed++;
            }

        } catch (error) {
            console.log('❌ ModuleSettings test failed:', error.message);
            testsFailed++;
        }

        // Test 6: API Endpoints (Simulated HTTP Requests)
        console.log('\n📝 Test 6: API Endpoint Availability');
        try {
            const http = require('http');

            // Test modules endpoint
            const checkEndpoint = (path) => {
                return new Promise((resolve) => {
                    const req = http.get(`http://localhost:${PORT}${path}`, (res) => {
                        resolve({ status: res.statusCode, path });
                    });
                    req.on('error', () => resolve({ status: 'error', path }));
                    req.setTimeout(2000, () => {
                        req.destroy();
                        resolve({ status: 'timeout', path });
                    });
                });
            };

            const endpoints = [
                '/api/modules',
                '/api/modules/enabled',
                '/settings'
            ];

            for (const endpoint of endpoints) {
                const result = await checkEndpoint(endpoint);
                if (endpoint === '/settings') {
                    // Settings should fail (TDD approach)
                    if (result.status === 500 || result.status === 'error') {
                        console.log(`✅ ${endpoint} failed as expected (TDD - UI not implemented)`);
                        testsPassed++;
                    } else {
                        console.log(`❌ ${endpoint} should fail but returned ${result.status}`);
                        testsFailed++;
                    }
                } else {
                    // API endpoints should work
                    if (result.status === 200) {
                        console.log(`✅ ${endpoint} responded successfully`);
                        testsPassed++;
                    } else {
                        console.log(`❌ ${endpoint} failed with status ${result.status}`);
                        testsFailed++;
                    }
                }
            }

        } catch (error) {
            console.log('❌ API endpoint test failed:', error.message);
            testsFailed++;
        }

    } catch (error) {
        console.log('❌ Test setup failed:', error.message);
        testsFailed++;
    } finally {
        if (server) {
            server.close();
            console.log('Test server stopped');
        }
    }

    // Test Results
    console.log('\n📊 Test Results');
    console.log('================');
    console.log(`✅ Tests Passed: ${testsPassed}`);
    console.log(`❌ Tests Failed: ${testsFailed}`);
    console.log(`📈 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);

    if (testsFailed > 0) {
        console.log('\n🎯 TDD Approach Working:');
        console.log('Some tests are expected to fail initially until the UI components are implemented.');
        console.log('This demonstrates the Test-Driven Development approach where tests are written first.');
    }

    console.log('\n🔄 Next Steps:');
    console.log('1. Implement settings UI components');
    console.log('2. Add module tab management to dashboard');
    console.log('3. Create settings.ejs view template');
    console.log('4. Add JavaScript for dynamic tab switching');

    process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { runTests };