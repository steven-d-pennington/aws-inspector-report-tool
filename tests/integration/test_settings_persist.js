/**
 * Integration Test: Settings Persistence Across Application Restarts
 *
 * This test verifies the user scenario from quickstart.md section 6:
 * "Settings survive application restart"
 *
 * This test is designed to FAIL initially (TDD approach) since the settings UI
 * doesn't exist yet. It tests the complete persistence workflow including:
 * - Enable SBOM module in settings
 * - Verify SBOM tab appears in dashboard
 * - Simulate application restart (database persistence)
 * - Verify SBOM tab still visible after restart
 * - Verify settings screen shows SBOM still enabled
 * - Test persistence across multiple restart cycles
 */

const request = require('supertest');
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');
const Database = require('../../src/models/database');

describe('Settings Persistence Integration Tests', function() {
    this.timeout(15000); // Increased timeout for integration tests

    let app;
    let db;
    let testDbPath;
    let originalApp;

    before(async function() {
        // Create a test database file path
        testDbPath = path.join(__dirname, '..', '..', 'db', 'test_persistence.db');

        // Ensure test db directory exists
        const dbDir = path.dirname(testDbPath);
        await fs.mkdir(dbDir, { recursive: true });

        // Remove existing test database if it exists
        try {
            await fs.unlink(testDbPath);
        } catch (err) {
            // File doesn't exist, that's fine
        }
    });

    beforeEach(async function() {
        // Initialize fresh database for each test
        db = new Database();
        // Override the database path for testing
        db.dbPath = testDbPath;
        await db.initialize();

        // Import and initialize the Express app
        delete require.cache[require.resolve('../../server.js')];
        app = require('../../server.js');

        // Wait a moment for server initialization
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    afterEach(async function() {
        // Close database connection
        if (db && db.db) {
            await new Promise(resolve => db.db.close(resolve));
        }

        // Clean up test database
        try {
            await fs.unlink(testDbPath);
        } catch (err) {
            // File might not exist, that's fine
        }
    });

    describe('Settings API Endpoints', function() {

        it('should provide settings API endpoint', async function() {
            const response = await request(app)
                .get('/api/settings')
                .expect(200);

            expect(response.body).to.be.an('object');
            expect(response.body).to.have.property('settings');
        });

        it('should provide modules API endpoint', async function() {
            const response = await request(app)
                .get('/api/modules')
                .expect(200);

            expect(response.body).to.be.an('array');
            expect(response.body).to.have.length.greaterThan(0);

            // Should include AWS Inspector and SBOM modules
            const moduleIds = response.body.map(m => m.module_id);
            expect(moduleIds).to.include('aws-inspector');
            expect(moduleIds).to.include('sbom');
        });

        it('should allow toggling module state via API', async function() {
            // First get current state
            const initialResponse = await request(app)
                .get('/api/modules')
                .expect(200);

            const sbomModule = initialResponse.body.find(m => m.module_id === 'sbom');
            expect(sbomModule).to.exist;

            const initialState = sbomModule.enabled;

            // Toggle the module
            const toggleResponse = await request(app)
                .put('/api/modules/sbom/toggle')
                .send({ enabled: !initialState })
                .expect(200);

            expect(toggleResponse.body).to.have.property('success', true);

            // Verify state changed
            const updatedResponse = await request(app)
                .get('/api/modules')
                .expect(200);

            const updatedSbomModule = updatedResponse.body.find(m => m.module_id === 'sbom');
            expect(updatedSbomModule.enabled).to.equal(!initialState);
        });
    });

    // Helper function to simulate application restart
    async function simulateRestart() {
        // Close current database
        if (db && db.db) {
            await new Promise(resolve => db.db.close(resolve));
        }

        // Create new database instance
        db = new Database();
        db.dbPath = testDbPath;
        await db.initialize();

        // Re-import server module
        delete require.cache[require.resolve('../../server.js')];
        app = require('../../server.js');

        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    describe('Settings Persistence Across Restarts', function() {

        it('should persist SBOM module state across application restart', async function() {
            // Step 1: Verify initial state (SBOM disabled by default)
            const initialResponse = await request(app)
                .get('/api/modules')
                .expect(200);

            const initialSbomModule = initialResponse.body.find(m => m.module_id === 'sbom');
            expect(initialSbomModule).to.exist;
            expect(initialSbomModule.enabled).to.equal(false); // Default state

            // Step 2: Enable SBOM module via settings API
            await request(app)
                .put('/api/modules/sbom/toggle')
                .send({ enabled: true })
                .expect(200);

            // Step 3: Verify SBOM module is now enabled
            const enabledResponse = await request(app)
                .get('/api/modules')
                .expect(200);

            const enabledSbomModule = enabledResponse.body.find(m => m.module_id === 'sbom');
            expect(enabledSbomModule.enabled).to.equal(true);

            // Step 4: Simulate application restart by:
            // - Closing current database connection
            // - Creating new database instance with same file
            // - Re-importing server module

            if (db && db.db) {
                await new Promise(resolve => db.db.close(resolve));
            }

            // Simulate restart - new database instance
            const restartedDb = new Database();
            restartedDb.dbPath = testDbPath;
            await restartedDb.initialize();

            // Re-import server (simulating restart)
            delete require.cache[require.resolve('../../server.js')];
            const restartedApp = require('../../server.js');

            // Wait for initialization
            await new Promise(resolve => setTimeout(resolve, 100));

            // Step 5: Verify SBOM module is still enabled after restart
            const restartResponse = await request(restartedApp)
                .get('/api/modules')
                .expect(200);

            const persistedSbomModule = restartResponse.body.find(m => m.module_id === 'sbom');
            expect(persistedSbomModule).to.exist;
            expect(persistedSbomModule.enabled).to.equal(true, 'SBOM module should remain enabled after restart');

            // Step 6: Verify AWS Inspector is still enabled (default module)
            const awsInspectorModule = restartResponse.body.find(m => m.module_id === 'aws-inspector');
            expect(awsInspectorModule).to.exist;
            expect(awsInspectorModule.enabled).to.equal(true);
            expect(awsInspectorModule.is_default).to.equal(true);

            // Clean up restarted database
            if (restartedDb && restartedDb.db) {
                await new Promise(resolve => restartedDb.db.close(resolve));
            }
        });

        it('should persist settings across multiple restart cycles', async function() {
            // Test multiple restart cycles to ensure robust persistence

            // Initial state check
            let response = await request(app)
                .get('/api/modules')
                .expect(200);

            let sbomModule = response.body.find(m => m.module_id === 'sbom');
            expect(sbomModule.enabled).to.equal(false);

            // Cycle 1: Enable SBOM, restart, verify
            await request(app)
                .put('/api/modules/sbom/toggle')
                .send({ enabled: true })
                .expect(200);

            await this.simulateRestart();

            response = await request(app)
                .get('/api/modules')
                .expect(200);
            sbomModule = response.body.find(m => m.module_id === 'sbom');
            expect(sbomModule.enabled).to.equal(true, 'SBOM should be enabled after first restart');

            // Cycle 2: Disable SBOM, restart, verify
            await request(app)
                .put('/api/modules/sbom/toggle')
                .send({ enabled: false })
                .expect(200);

            await simulateRestart();

            response = await request(app)
                .get('/api/modules')
                .expect(200);
            sbomModule = response.body.find(m => m.module_id === 'sbom');
            expect(sbomModule.enabled).to.equal(false, 'SBOM should be disabled after second restart');

            // Cycle 3: Re-enable SBOM, restart, verify
            await request(app)
                .put('/api/modules/sbom/toggle')
                .send({ enabled: true })
                .expect(200);

            await simulateRestart();

            response = await request(app)
                .get('/api/modules')
                .expect(200);
            sbomModule = response.body.find(m => m.module_id === 'sbom');
            expect(sbomModule.enabled).to.equal(true, 'SBOM should be enabled after third restart');

        });

    });

    describe('Database State Validation', function() {

        it('should maintain database integrity across restarts', async function() {
            // Enable SBOM module
            await request(app)
                .put('/api/modules/sbom/toggle')
                .send({ enabled: true })
                .expect(200);

            // Directly query database to verify state
            const directQuery = await new Promise((resolve, reject) => {
                db.db.get(
                    'SELECT * FROM module_settings WHERE module_id = ?',
                    ['sbom'],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            expect(directQuery).to.exist;
            expect(directQuery.enabled).to.equal(1); // SQLite boolean as integer
            expect(directQuery.module_id).to.equal('sbom');

            // Simulate restart
            await simulateRestart();

            // Re-query database after restart
            const postRestartQuery = await new Promise((resolve, reject) => {
                db.db.get(
                    'SELECT * FROM module_settings WHERE module_id = ?',
                    ['sbom'],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            expect(postRestartQuery).to.exist;
            expect(postRestartQuery.enabled).to.equal(1);
            expect(postRestartQuery.module_id).to.equal('sbom');

            // Verify updated_at timestamp was preserved or updated appropriately
            expect(postRestartQuery.updated_at).to.exist;
        });

        it('should preserve default module protection across restarts', async function() {
            // Verify AWS Inspector cannot be disabled (it's the default)
            const response = await request(app)
                .put('/api/modules/aws-inspector/toggle')
                .send({ enabled: false })
                .expect(400); // Should fail

            expect(response.body).to.have.property('error');
            expect(response.body.error).to.match(/default.*cannot.*disabled/i);

            // Simulate restart
            await simulateRestart();

            // Verify AWS Inspector is still enabled and protected
            const modulesResponse = await request(app)
                .get('/api/modules')
                .expect(200);

            const awsInspectorModule = modulesResponse.body.find(m => m.module_id === 'aws-inspector');
            expect(awsInspectorModule).to.exist;
            expect(awsInspectorModule.enabled).to.equal(true);
            expect(awsInspectorModule.is_default).to.equal(true);
        });
    });

    describe('UI State Persistence (Dashboard)', function() {

        it('should reflect module state in dashboard after restart', async function() {
            // Enable SBOM module
            await request(app)
                .put('/api/modules/sbom/toggle')
                .send({ enabled: true })
                .expect(200);

            // Get dashboard page (should show SBOM tab)
            let dashboardResponse = await request(app)
                .get('/dashboard')
                .expect(200);

            // Parse HTML to verify SBOM tab is present
            // Note: This test will FAIL initially since the UI doesn't exist yet
            expect(dashboardResponse.text).to.include('SBOM', 'Dashboard should show SBOM tab when module is enabled');

            // Simulate restart
            await simulateRestart();

            // Verify dashboard still shows SBOM tab after restart
            dashboardResponse = await request(app)
                .get('/dashboard')
                .expect(200);

            expect(dashboardResponse.text).to.include('SBOM', 'Dashboard should still show SBOM tab after restart');
        });

        it('should hide disabled modules from dashboard after restart', async function() {
            // Ensure SBOM is disabled
            await request(app)
                .put('/api/modules/sbom/toggle')
                .send({ enabled: false })
                .expect(200);

            // Get dashboard page (should NOT show SBOM tab)
            let dashboardResponse = await request(app)
                .get('/dashboard')
                .expect(200);

            // Should only show AWS Inspector, not SBOM
            expect(dashboardResponse.text).to.not.include('SBOM Tab', 'Dashboard should not show SBOM tab when disabled');
            expect(dashboardResponse.text).to.include('AWS Inspector', 'Dashboard should always show AWS Inspector');

            // Simulate restart
            await simulateRestart();

            // Verify SBOM tab is still hidden after restart
            dashboardResponse = await request(app)
                .get('/dashboard')
                .expect(200);

            expect(dashboardResponse.text).to.not.include('SBOM Tab', 'Dashboard should not show SBOM tab after restart when disabled');
        });
    });

    describe('Settings Screen Persistence', function() {

        it('should show correct module states in settings screen after restart', async function() {
            // Enable SBOM module
            await request(app)
                .put('/api/modules/sbom/toggle')
                .send({ enabled: true })
                .expect(200);

            // Get settings page
            // Note: This test will FAIL initially since settings UI doesn't exist
            let settingsResponse = await request(app)
                .get('/settings')
                .expect(200);

            // Verify settings page shows SBOM as enabled
            expect(settingsResponse.text).to.include('SBOM Reports', 'Settings should show SBOM module');
            expect(settingsResponse.text).to.match(/SBOM.*enabled|enabled.*SBOM/i, 'Settings should show SBOM as enabled');

            // Simulate restart
            await simulateRestart();

            // Verify settings page still shows correct state after restart
            settingsResponse = await request(app)
                .get('/settings')
                .expect(200);

            expect(settingsResponse.text).to.include('SBOM Reports', 'Settings should show SBOM module after restart');
            expect(settingsResponse.text).to.match(/SBOM.*enabled|enabled.*SBOM/i, 'Settings should show SBOM as enabled after restart');
        });

        it('should prevent disabling default module in settings screen', async function() {
            // Get settings page
            const settingsResponse = await request(app)
                .get('/settings')
                .expect(200);

            // Should show AWS Inspector as locked/disabled toggle
            expect(settingsResponse.text).to.include('AWS Inspector', 'Settings should show AWS Inspector module');
            expect(settingsResponse.text).to.match(/AWS Inspector.*locked|disabled.*AWS Inspector/i, 'AWS Inspector toggle should be locked');

            // Should include tooltip or explanation
            expect(settingsResponse.text).to.match(/default.*cannot.*disabled/i, 'Should explain why default module cannot be disabled');
        });
    });

    describe('Performance Requirements', function() {

        it('should load settings quickly after restart', async function() {
            const startTime = Date.now();

            const response = await request(app)
                .get('/api/settings')
                .expect(200);

            const responseTime = Date.now() - startTime;

            // Settings should load in under 200ms as per quickstart.md
            expect(responseTime).to.be.lessThan(200, 'Settings should load in under 200ms');
            expect(response.body).to.have.property('settings');
        });

        it('should save settings quickly', async function() {
            const startTime = Date.now();

            await request(app)
                .put('/api/modules/sbom/toggle')
                .send({ enabled: true })
                .expect(200);

            const responseTime = Date.now() - startTime;

            // Settings save should complete in under 200ms as per quickstart.md
            expect(responseTime).to.be.lessThan(200, 'Settings save should complete in under 200ms');
        });
    });

    describe('Error Scenarios', function() {

        it('should handle database unavailable gracefully', async function() {
            // Close database connection to simulate unavailable database
            if (db && db.db) {
                await new Promise(resolve => db.db.close(resolve));
            }

            // Try to save settings with database unavailable
            const response = await request(app)
                .put('/api/modules/sbom/toggle')
                .send({ enabled: true })
                .expect(500);

            expect(response.body).to.have.property('error');
            expect(response.body.error).to.match(/database|connection/i);
        });

        it('should validate settings data', async function() {
            // Try to send invalid module toggle data
            const response = await request(app)
                .put('/api/modules/sbom/toggle')
                .send({ enabled: 'invalid' })
                .expect(400);

            expect(response.body).to.have.property('error');
            expect(response.body.error).to.match(/invalid|validation/i);
        });

        it('should handle non-existent module gracefully', async function() {
            // Try to toggle a module that doesn't exist
            const response = await request(app)
                .put('/api/modules/non-existent/toggle')
                .send({ enabled: true })
                .expect(404);

            expect(response.body).to.have.property('error');
            expect(response.body.error).to.match(/not found|does not exist/i);
        });
    });
});