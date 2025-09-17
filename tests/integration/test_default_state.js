/**
 * Integration Test: Default Module State
 *
 * Tests the user scenario from quickstart.md:
 * "Application starts with AWS Inspector module enabled by default"
 *
 * This test follows TDD approach and should FAIL initially since
 * the UI integration doesn't exist yet.
 */

const { expect } = require('chai');
const puppeteer = require('puppeteer');
const request = require('supertest');
const path = require('path');
const fs = require('fs').promises;

// Import server and database for setup
const Database = require('../../src/models/database');

describe('Default Module State Integration Tests', function() {
    let browser;
    let page;
    let server;
    let db;
    let baseUrl;

    // Test setup - reset database and start server
    before(async function() {
        this.timeout(30000);

        // Initialize test database
        process.env.NODE_ENV = 'test';
        process.env.DB_PATH = path.join(__dirname, '../../db/test.db');

        // Clean up any existing test database
        try {
            await fs.unlink(process.env.DB_PATH);
        } catch (err) {
            // File doesn't exist, ignore
        }

        db = new Database();
        await db.init();

        // Seed default module configuration
        await seedDefaultModules();

        // Start server for testing
        const app = require('../../server');
        server = app.listen(0); // Use random available port
        const address = server.address();
        baseUrl = `http://localhost:${address.port}`;

        // Launch browser for UI testing
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();

        // Set viewport for consistent testing
        await page.setViewport({ width: 1200, height: 800 });
    });

    after(async function() {
        this.timeout(10000);

        if (browser) {
            await browser.close();
        }

        if (server) {
            server.close();
        }

        // Clean up test database
        try {
            await fs.unlink(process.env.DB_PATH);
        } catch (err) {
            // Ignore cleanup errors
        }
    });

    beforeEach(async function() {
        // Reset to clean state before each test
        await resetToDefaultState();
    });

    describe('Quickstart Scenario: Default State Verification', function() {

        it('should start with AWS Inspector module enabled by default', async function() {
            // Navigate to application root
            await page.goto(baseUrl, { waitUntil: 'networkidle0' });

            // Test will FAIL initially - AWS Inspector tab should be visible and active
            const awsInspectorTab = await page.$('[data-testid="aws-inspector-tab"]');
            expect(awsInspectorTab, 'AWS Inspector tab should be visible on page load').to.not.be.null;

            // Check if tab is active
            const isActive = await page.evaluate((tab) => {
                return tab.classList.contains('active') || tab.getAttribute('aria-selected') === 'true';
            }, awsInspectorTab);

            expect(isActive, 'AWS Inspector tab should be active by default').to.be.true;
        });

        it('should NOT show SBOM tab by default (disabled by default)', async function() {
            await page.goto(baseUrl, { waitUntil: 'networkidle0' });

            // SBOM tab should NOT be visible initially
            const sbomTab = await page.$('[data-testid="sbom-tab"]');
            expect(sbomTab, 'SBOM tab should NOT be visible by default').to.be.null;
        });

        it('should have existing AWS Inspector functionality working', async function() {
            await page.goto(baseUrl, { waitUntil: 'networkidle0' });

            // Test existing AWS Inspector dashboard elements
            const dashboardContent = await page.$('[data-testid="aws-inspector-content"]');
            expect(dashboardContent, 'AWS Inspector dashboard content should be present').to.not.be.null;

            // Check for key AWS Inspector UI elements
            const metricsSection = await page.$('[data-testid="vulnerability-metrics"]');
            expect(metricsSection, 'Vulnerability metrics section should be present').to.not.be.null;

            // Verify upload functionality is available
            const uploadSection = await page.$('[data-testid="upload-section"]');
            expect(uploadSection, 'File upload section should be available').to.not.be.null;
        });

        it('should show correct default state in settings', async function() {
            // Navigate to settings page
            await page.goto(`${baseUrl}/settings`, { waitUntil: 'networkidle0' });

            // Verify AWS Inspector is enabled and locked
            const awsInspectorToggle = await page.$('[data-testid="module-toggle-aws-inspector"]');
            expect(awsInspectorToggle, 'AWS Inspector toggle should be present').to.not.be.null;

            const isEnabled = await page.evaluate((toggle) => {
                return toggle.checked || toggle.getAttribute('aria-checked') === 'true';
            }, awsInspectorToggle);

            expect(isEnabled, 'AWS Inspector should be enabled by default').to.be.true;

            // Verify SBOM is disabled by default
            const sbomToggle = await page.$('[data-testid="module-toggle-sbom"]');
            expect(sbomToggle, 'SBOM toggle should be present').to.not.be.null;

            const sbomEnabled = await page.evaluate((toggle) => {
                return toggle.checked || toggle.getAttribute('aria-checked') === 'true';
            }, sbomToggle);

            expect(sbomEnabled, 'SBOM should be disabled by default').to.be.false;
        });
    });

    describe('API Contract Verification', function() {

        it('should return correct default modules via API', async function() {
            const response = await request(baseUrl)
                .get('/api/modules')
                .expect(200);

            const modules = response.body;
            expect(modules).to.be.an('array');

            // Find AWS Inspector module
            const awsInspector = modules.find(m => m.module_id === 'aws-inspector');
            expect(awsInspector, 'AWS Inspector module should exist').to.not.be.undefined;
            expect(awsInspector.enabled, 'AWS Inspector should be enabled').to.be.true;
            expect(awsInspector.is_default, 'AWS Inspector should be marked as default').to.be.true;

            // Find SBOM module
            const sbom = modules.find(m => m.module_id === 'sbom');
            expect(sbom, 'SBOM module should exist').to.not.be.undefined;
            expect(sbom.enabled, 'SBOM should be disabled by default').to.be.false;
            expect(sbom.is_default, 'SBOM should not be default').to.be.false;
        });

        it('should return correct settings via API', async function() {
            const response = await request(baseUrl)
                .get('/api/settings')
                .expect(200);

            const settings = response.body;
            expect(settings).to.be.an('object');

            // Verify module settings are correctly reflected
            expect(settings.modules).to.be.an('object');
            expect(settings.modules['aws-inspector']).to.be.true;
            expect(settings.modules['sbom']).to.be.false;
        });
    });

    describe('Navigation and Tab Behavior', function() {

        it('should display only AWS Inspector tab in navigation', async function() {
            await page.goto(baseUrl, { waitUntil: 'networkidle0' });

            // Get all visible module tabs
            const tabs = await page.$$('[data-testid*="-tab"]');
            expect(tabs.length, 'Should only show one tab initially').to.equal(1);

            // Verify it's the AWS Inspector tab
            const tabText = await page.evaluate((tab) => {
                return tab.textContent || tab.innerText;
            }, tabs[0]);

            expect(tabText.toLowerCase()).to.include('inspector');
        });

        it('should not have SBOM navigation elements', async function() {
            await page.goto(baseUrl, { waitUntil: 'networkidle0' });

            // Look for any SBOM-related navigation
            const sbomElements = await page.$$('[data-testid*="sbom"], [href*="sbom"], [id*="sbom"]');
            expect(sbomElements.length, 'No SBOM navigation should be present').to.equal(0);
        });
    });

    describe('Performance Requirements', function() {

        it('should load page within performance requirements', async function() {
            const startTime = Date.now();

            await page.goto(baseUrl, { waitUntil: 'networkidle0' });

            const loadTime = Date.now() - startTime;
            expect(loadTime, 'Page should load within 2 seconds').to.be.below(2000);
        });

        it('should have tab switching under 100ms (when implemented)', async function() {
            // This test will initially pass (no-op) but will verify performance once tabs exist
            await page.goto(baseUrl, { waitUntil: 'networkidle0' });

            // For now, just verify the single tab responds quickly
            const startTime = Date.now();
            await page.click('[data-testid="aws-inspector-tab"]');
            const switchTime = Date.now() - startTime;

            expect(switchTime, 'Tab interaction should be under 100ms').to.be.below(100);
        });
    });

    // Helper functions
    async function seedDefaultModules() {
        const modules = [
            {
                module_id: 'aws-inspector',
                name: 'AWS Inspector',
                description: 'AWS Inspector vulnerability reports',
                enabled: true,
                is_default: true,
                display_order: 1,
                route: '/'
            },
            {
                module_id: 'sbom',
                name: 'SBOM Reports',
                description: 'Software Bill of Materials reports',
                enabled: false,
                is_default: false,
                display_order: 2,
                route: '/sbom'
            }
        ];

        for (const module of modules) {
            try {
                await db.run(`
                    INSERT OR REPLACE INTO modules
                    (module_id, name, description, enabled, is_default, display_order, route)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    module.module_id,
                    module.name,
                    module.description,
                    module.enabled ? 1 : 0,
                    module.is_default ? 1 : 0,
                    module.display_order,
                    module.route
                ]);
            } catch (error) {
                console.error(`Error seeding module ${module.module_id}:`, error);
            }
        }
    }

    async function resetToDefaultState() {
        // Reset modules to default state
        await db.run(`UPDATE modules SET enabled = 0 WHERE module_id != 'aws-inspector'`);
        await db.run(`UPDATE modules SET enabled = 1 WHERE module_id = 'aws-inspector'`);

        // Reset any settings to default
        await db.run(`DELETE FROM settings WHERE key NOT IN ('app_initialized')`);
    }
});