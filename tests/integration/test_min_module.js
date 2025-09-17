/**
 * Integration Tests for Minimum Module Enforcement
 *
 * This test suite verifies the user scenario from quickstart.md section 8:
 * "Cannot disable default module" - ensuring complete protection against
 * having zero active modules.
 *
 * Tests use TDD approach - they FAIL initially since module enforcement
 * doesn't exist yet. Implementation must be added to make these pass.
 */

const request = require('supertest');
const { expect } = require('chai');
const Database = require('../../src/models/database');
const puppeteer = require('puppeteer');

// Import the app for testing (we'll need to mock or extend it for module APIs)
let app;
try {
    app = require('../../server');
} catch (err) {
    // Mock app if server.js doesn't export properly
    app = require('express')();
}

describe('Minimum Module Enforcement Integration Tests', function() {
    this.timeout(30000); // Increased timeout for Puppeteer tests

    let db;
    let browser;
    let page;

    before(async function() {
        // Initialize database for testing
        db = new Database();
        // Use in-memory database for tests
        db.dbPath = ':memory:';
        await db.initialize();

        // Seed test data with default modules
        await seedTestModules();

        // Start browser for UI testing
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
    });

    after(async function() {
        if (browser) {
            await browser.close();
        }
        if (db && db.db) {
            await new Promise(resolve => db.db.close(resolve));
        }
    });

    beforeEach(async function() {
        // Reset modules to default state before each test
        await resetModulesToDefaultState();
    });

    describe('Backend API Module Enforcement', function() {

        it('should reject attempts to disable the default AWS Inspector module', async function() {
            // This test will FAIL initially - no enforcement exists yet
            const response = await request(app)
                .put('/api/modules/aws-inspector/toggle')
                .send({ enabled: false })
                .expect(400); // Should be rejected

            expect(response.body).to.have.property('error');
            expect(response.body.error).to.match(/default module cannot be disabled/i);
        });

        it('should reject attempts to disable AWS Inspector via settings API', async function() {
            // This test will FAIL initially - no enforcement exists yet
            const response = await request(app)
                .put('/api/settings')
                .send({
                    modules: {
                        'aws-inspector': { enabled: false },
                        'sbom': { enabled: true }
                    }
                })
                .expect(400); // Should be rejected

            expect(response.body).to.have.property('error');
            expect(response.body.error).to.match(/default module cannot be disabled/i);
        });

        it('should ensure at least one module always remains active', async function() {
            // This test will FAIL initially - no enforcement exists yet
            const response = await request(app)
                .put('/api/settings')
                .send({
                    modules: {
                        'aws-inspector': { enabled: false },
                        'sbom': { enabled: false }
                    }
                })
                .expect(400); // Should be rejected

            expect(response.body).to.have.property('error');
            expect(response.body.error).to.match(/at least one module must remain active/i);
        });

        it('should allow disabling non-default modules when AWS Inspector remains enabled', async function() {
            // This should work - disabling non-default modules is allowed
            const response = await request(app)
                .put('/api/modules/sbom/toggle')
                .send({ enabled: false })
                .expect(200);

            expect(response.body).to.have.property('success', true);

            // Verify AWS Inspector is still enabled
            const modulesResponse = await request(app)
                .get('/api/modules')
                .expect(200);

            const awsInspector = modulesResponse.body.find(m => m.module_id === 'aws-inspector');
            expect(awsInspector).to.have.property('enabled', true);
        });

        it('should provide fallback to AWS Inspector if all modules somehow disabled', async function() {
            // Simulate a scenario where data corruption occurs
            // This test will FAIL initially - no fallback mechanism exists yet

            // First, manually corrupt the database to disable all modules
            await db.db.run('UPDATE module_settings SET enabled = 0');

            const response = await request(app)
                .get('/api/modules')
                .expect(200);

            // Should automatically re-enable AWS Inspector as fallback
            const awsInspector = response.body.find(m => m.module_id === 'aws-inspector');
            expect(awsInspector).to.have.property('enabled', true);
            expect(response.body.filter(m => m.enabled).length).to.be.at.least(1);
        });

        it('should handle invalid module disable attempts gracefully', async function() {
            // This test will FAIL initially - no validation exists yet
            const response = await request(app)
                .put('/api/modules/nonexistent/toggle')
                .send({ enabled: false })
                .expect(404);

            expect(response.body).to.have.property('error');
            expect(response.body.error).to.match(/module not found/i);
        });

        it('should validate request payload for module toggle operations', async function() {
            // This test will FAIL initially - no validation exists yet
            const response = await request(app)
                .put('/api/modules/aws-inspector/toggle')
                .send({ invalid: 'payload' })
                .expect(400);

            expect(response.body).to.have.property('error');
            expect(response.body.error).to.match(/invalid request/i);
        });
    });

    describe('Frontend UI Module Enforcement', function() {

        beforeEach(async function() {
            // Navigate to settings page before each UI test
            // Note: This will fail initially since settings page doesn't exist yet
            try {
                await page.goto('http://localhost:3010/settings', {
                    waitUntil: 'networkidle0',
                    timeout: 5000
                });
            } catch (err) {
                // Settings page doesn't exist yet - test will document this
                console.log('Settings page not accessible yet - test will fail as expected in TDD');
            }
        });

        it('should show AWS Inspector toggle as locked/disabled in settings UI', async function() {
            // This test will FAIL initially - settings UI doesn't exist yet
            try {
                const awsInspectorToggle = await page.$('[data-testid="module-toggle-aws-inspector"]');
                expect(awsInspectorToggle).to.not.be.null;

                const isDisabled = await page.evaluate(el => el.disabled, awsInspectorToggle);
                expect(isDisabled).to.be.true;

                const hasLockedClass = await page.evaluate(
                    el => el.classList.contains('locked') || el.classList.contains('disabled'),
                    awsInspectorToggle
                );
                expect(hasLockedClass).to.be.true;
            } catch (err) {
                // Expected to fail - no settings UI exists yet
                expect(err.message).to.match(/Navigation.*failed|Element.*not found/i);
                throw new Error('TDD: Settings UI with module toggles not implemented yet');
            }
        });

        it('should display tooltip explaining "Default module cannot be disabled"', async function() {
            // This test will FAIL initially - tooltip doesn't exist yet
            try {
                await page.hover('[data-testid="module-toggle-aws-inspector"]');

                const tooltip = await page.waitForSelector('[data-testid="tooltip"], .tooltip', {
                    timeout: 2000
                });
                expect(tooltip).to.not.be.null;

                const tooltipText = await page.evaluate(el => el.textContent, tooltip);
                expect(tooltipText.toLowerCase()).to.include('default module cannot be disabled');
            } catch (err) {
                // Expected to fail - no tooltip exists yet
                throw new Error('TDD: Tooltip explaining default module protection not implemented yet');
            }
        });

        it('should prevent form submission when trying to disable AWS Inspector', async function() {
            // This test will FAIL initially - form validation doesn't exist yet
            try {
                // Try to uncheck AWS Inspector (should be prevented)
                const checkbox = await page.$('[data-testid="module-toggle-aws-inspector"] input[type="checkbox"]');
                if (checkbox) {
                    await page.click('[data-testid="module-toggle-aws-inspector"] input[type="checkbox"]');

                    // Try to submit form
                    await page.click('[data-testid="save-settings"], button[type="submit"]');

                    // Should show error message
                    const errorMessage = await page.waitForSelector('.error-message, [data-testid="error"]', {
                        timeout: 2000
                    });
                    expect(errorMessage).to.not.be.null;

                    const errorText = await page.evaluate(el => el.textContent, errorMessage);
                    expect(errorText.toLowerCase()).to.include('default module cannot be disabled');
                }
            } catch (err) {
                // Expected to fail - no form validation exists yet
                throw new Error('TDD: Frontend form validation for default module protection not implemented yet');
            }
        });

        it('should visually indicate which module is the default/required one', async function() {
            // This test will FAIL initially - visual indicators don't exist yet
            try {
                const awsInspectorRow = await page.$('[data-testid="module-row-aws-inspector"]');
                expect(awsInspectorRow).to.not.be.null;

                // Should have visual indicators like badge, icon, or special styling
                const hasDefaultBadge = await page.evaluate(
                    el => el.querySelector('.default-badge, .required-badge, [data-testid="default-indicator"]') !== null,
                    awsInspectorRow
                );
                expect(hasDefaultBadge).to.be.true;
            } catch (err) {
                // Expected to fail - no visual indicators exist yet
                throw new Error('TDD: Visual indicators for default module not implemented yet');
            }
        });

        it('should maintain AWS Inspector enabled state after page refresh', async function() {
            // This test verifies persistence - will FAIL initially
            try {
                // Check initial state
                const initialState = await page.evaluate(() => {
                    const toggle = document.querySelector('[data-testid="module-toggle-aws-inspector"] input');
                    return toggle ? toggle.checked : null;
                });

                if (initialState !== null) {
                    expect(initialState).to.be.true;

                    // Refresh page
                    await page.reload({ waitUntil: 'networkidle0' });

                    // Verify state is still enabled
                    const afterRefreshState = await page.evaluate(() => {
                        const toggle = document.querySelector('[data-testid="module-toggle-aws-inspector"] input');
                        return toggle ? toggle.checked : null;
                    });

                    expect(afterRefreshState).to.be.true;
                }
            } catch (err) {
                // Expected to fail - settings UI doesn't exist yet
                throw new Error('TDD: Settings UI persistence not implemented yet');
            }
        });
    });

    describe('Cross-Component Integration Tests', function() {

        it('should maintain module enforcement across API and UI components', async function() {
            // This comprehensive test will FAIL initially - no integration exists yet

            // 1. Verify backend protects against disabling default module
            const apiResponse = await request(app)
                .put('/api/modules/aws-inspector/toggle')
                .send({ enabled: false });

            expect(apiResponse.status).to.equal(400);

            // 2. Verify UI reflects the protected state
            try {
                await page.goto('http://localhost:3010/settings');

                const toggleDisabled = await page.evaluate(() => {
                    const toggle = document.querySelector('[data-testid="module-toggle-aws-inspector"]');
                    return toggle ? toggle.disabled : null;
                });

                expect(toggleDisabled).to.be.true;
            } catch (err) {
                // Expected to fail - no UI exists yet
                throw new Error('TDD: UI and API integration not implemented yet');
            }
        });

        it('should handle edge case: last remaining module disable attempt', async function() {
            // This test will FAIL initially - no edge case handling exists yet

            // First disable all non-default modules
            await request(app)
                .put('/api/modules/sbom/toggle')
                .send({ enabled: false })
                .expect(200);

            // Now try to disable the last remaining (default) module
            const response = await request(app)
                .put('/api/modules/aws-inspector/toggle')
                .send({ enabled: false })
                .expect(400);

            expect(response.body.error).to.match(/cannot disable.*last.*module/i);

            // Verify at least one module is still enabled
            const modulesResponse = await request(app)
                .get('/api/modules')
                .expect(200);

            const enabledModules = modulesResponse.body.filter(m => m.enabled);
            expect(enabledModules.length).to.be.at.least(1);
            expect(enabledModules[0].module_id).to.equal('aws-inspector');
        });
    });

    // Helper functions
    async function seedTestModules() {
        const modules = [
            {
                module_id: 'aws-inspector',
                name: 'AWS Inspector',
                description: 'AWS Inspector vulnerability reports',
                enabled: true,
                is_default: true,
                display_order: 1,
                route: '/',
                icon: 'shield-check'
            },
            {
                module_id: 'sbom',
                name: 'SBOM Reports',
                description: 'Software Bill of Materials reports',
                enabled: true,
                is_default: false,
                display_order: 2,
                route: '/sbom',
                icon: 'list-tree'
            },
            {
                module_id: 'security-scan',
                name: 'Security Scan',
                description: 'Security scanning results',
                enabled: false,
                is_default: false,
                display_order: 3,
                route: '/security',
                icon: 'search'
            }
        ];

        for (const module of modules) {
            await new Promise((resolve, reject) => {
                db.db.run(
                    `INSERT OR REPLACE INTO module_settings
                     (module_id, name, description, enabled, is_default, display_order, route, icon)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        module.module_id,
                        module.name,
                        module.description,
                        module.enabled,
                        module.is_default,
                        module.display_order,
                        module.route,
                        module.icon
                    ],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    }
                );
            });
        }
    }

    async function resetModulesToDefaultState() {
        await new Promise((resolve, reject) => {
            db.db.serialize(() => {
                // Reset to default state: AWS Inspector enabled, others as configured
                db.db.run(`UPDATE module_settings SET enabled = 1 WHERE module_id = 'aws-inspector'`);
                db.db.run(`UPDATE module_settings SET enabled = 1 WHERE module_id = 'sbom'`);
                db.db.run(`UPDATE module_settings SET enabled = 0 WHERE module_id = 'security-scan'`,
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        });
    }
});