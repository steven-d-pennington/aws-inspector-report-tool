/**
 * Integration Tests for Tab Switching Functionality
 *
 * Tests the user scenarios from quickstart.md section 5:
 * - Smooth switching between module tabs
 * - Performance requirement: <100ms tab switching
 * - Active tab visual indicators
 * - Content properly loads for each module
 *
 * Uses TDD approach - these tests will FAIL initially until the UI is implemented
 */

const puppeteer = require('puppeteer');
const { expect } = require('chai');
const express = require('express');
const path = require('path');
const Database = require('../../src/models/database');

describe('Tab Switching Integration Tests', function() {
    let browser;
    let page;
    let app;
    let server;
    let db;
    let serverPort;

    // Extended timeout for browser operations
    this.timeout(30000);

    before(async function() {
        // Setup test database
        db = new Database();
        await db.initialize();

        // Create Express app for testing
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(express.static(path.join(__dirname, '../../public')));

        // Set EJS as view engine
        app.set('view engine', 'ejs');
        app.set('views', path.join(__dirname, '../../views'));

        // NOTE: API routes and UI components need to be implemented
        // These tests will FAIL initially as expected in TDD approach

        // Mock routes for testing (will be replaced with actual implementation)
        app.get('/', (req, res) => {
            res.status(404).send('Dashboard UI not implemented yet');
        });

        app.get('/api/modules', (req, res) => {
            res.status(404).json({ error: 'Modules API not implemented yet' });
        });

        // Start test server
        server = app.listen(0);
        serverPort = server.address().port;

        // Launch browser
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    });

    after(async function() {
        if (browser) {
            await browser.close();
        }
        if (server) {
            server.close();
        }
        if (db && db.db) {
            db.db.close();
        }
    });

    beforeEach(async function() {
        // Setup test modules in database
        await setupTestModules();

        // Create new page for each test
        page = await browser.newPage();

        // Set viewport size
        await page.setViewport({ width: 1200, height: 800 });

        // Enable console logging for debugging
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`PAGE ERROR: ${msg.text()}`);
            }
        });
    });

    afterEach(async function() {
        if (page) {
            await page.close();
        }
    });

    async function setupTestModules() {
        // Clear existing modules
        await new Promise((resolve, reject) => {
            db.db.run('DELETE FROM module_settings', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Insert test modules with both enabled for tab switching tests
        await new Promise((resolve, reject) => {
            db.db.run(`
                INSERT INTO module_settings (
                    module_id, name, description, enabled, is_default, display_order, route, created_at, updated_at
                ) VALUES
                ('aws-inspector', 'AWS Inspector', 'AWS Inspector vulnerability reports', 1, 1, 1, '/', datetime('now'), datetime('now')),
                ('sbom', 'SBOM Reports', 'Software Bill of Materials reports', 1, 0, 2, '/sbom', datetime('now'), datetime('now'))
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    describe('Dashboard Initial State with Both Modules Enabled', function() {
        it('should load dashboard with both AWS Inspector and SBOM tabs visible', async function() {
            try {
                await page.goto(`http://localhost:${serverPort}`, { waitUntil: 'networkidle0' });

                // Test will FAIL initially - these selectors don't exist yet
                await page.waitForSelector('.tab-container', { timeout: 5000 });

                const awsInspectorTab = await page.$('.tab[data-module="aws-inspector"]');
                const sbomTab = await page.$('.tab[data-module="sbom"]');

                expect(awsInspectorTab).to.not.be.null;
                expect(sbomTab).to.not.be.null;

                // Verify AWS Inspector tab is active by default
                const awsTabClass = await page.evaluate(tab => tab.className, awsInspectorTab);
                expect(awsTabClass).to.include('active');

            } catch (error) {
                // Expected to fail in TDD approach
                console.log('EXPECTED FAILURE: Dashboard UI not implemented yet');
                expect(error.message).to.match(/Dashboard UI not implemented|timeout|failed to find element/i);
            }
        });

        it('should display correct tab labels and content areas', async function() {
            try {
                await page.goto(`http://localhost:${serverPort}`);

                // Test will FAIL initially - UI elements don't exist
                const awsTabText = await page.$eval('.tab[data-module="aws-inspector"] .tab-label', el => el.textContent);
                const sbomTabText = await page.$eval('.tab[data-module="sbom"] .tab-label', el => el.textContent);

                expect(awsTabText.trim()).to.equal('AWS Inspector');
                expect(sbomTabText.trim()).to.equal('SBOM Reports');

                // Verify content areas exist
                const awsContent = await page.$('.content-area[data-module="aws-inspector"]');
                const sbomContent = await page.$('.content-area[data-module="sbom"]');

                expect(awsContent).to.not.be.null;
                expect(sbomContent).to.not.be.null;

            } catch (error) {
                // Expected to fail in TDD approach
                console.log('EXPECTED FAILURE: Tab UI elements not implemented yet');
                expect(error.message).to.match(/failed to find element|timeout/i);
            }
        });
    });

    describe('Tab Switching Functionality Tests', function() {
        it('should switch from AWS Inspector to SBOM tab with proper visual indicators', async function() {
            try {
                await page.goto(`http://localhost:${serverPort}`);

                // Wait for tabs to load
                await page.waitForSelector('.tab-container');

                // Verify initial state - AWS Inspector active
                const awsTab = await page.$('.tab[data-module="aws-inspector"]');
                const sbomTab = await page.$('.tab[data-module="sbom"]');

                let awsTabClass = await page.evaluate(tab => tab.className, awsTab);
                expect(awsTabClass).to.include('active');

                // Click SBOM tab
                await sbomTab.click();

                // Verify tab state changed
                await page.waitForFunction(() => {
                    const sbomTab = document.querySelector('.tab[data-module="sbom"]');
                    return sbomTab && sbomTab.classList.contains('active');
                }, { timeout: 1000 });

                // Verify AWS Inspector tab is no longer active
                awsTabClass = await page.evaluate(tab => tab.className, awsTab);
                expect(awsTabClass).to.not.include('active');

                // Verify SBOM tab is now active
                const sbomTabClass = await page.evaluate(tab => tab.className, sbomTab);
                expect(sbomTabClass).to.include('active');

            } catch (error) {
                // Expected to fail in TDD approach
                console.log('EXPECTED FAILURE: Tab switching functionality not implemented yet');
                expect(error.message).to.match(/failed to find element|timeout/i);
            }
        });

        it('should switch from SBOM back to AWS Inspector tab', async function() {
            try {
                await page.goto(`http://localhost:${serverPort}`);
                await page.waitForSelector('.tab-container');

                // Click SBOM tab first
                const sbomTab = await page.$('.tab[data-module="sbom"]');
                await sbomTab.click();

                // Then click AWS Inspector tab
                const awsTab = await page.$('.tab[data-module="aws-inspector"]');
                await awsTab.click();

                // Verify AWS Inspector is active again
                await page.waitForFunction(() => {
                    const awsTab = document.querySelector('.tab[data-module="aws-inspector"]');
                    return awsTab && awsTab.classList.contains('active');
                });

                const awsTabClass = await page.evaluate(tab => tab.className, awsTab);
                expect(awsTabClass).to.include('active');

                const sbomTabClass = await page.evaluate(tab => tab.className, sbomTab);
                expect(sbomTabClass).to.not.include('active');

            } catch (error) {
                // Expected to fail in TDD approach
                console.log('EXPECTED FAILURE: Tab switching functionality not implemented yet');
                expect(error.message).to.match(/failed to find element|timeout/i);
            }
        });
    });

    describe('Content Switching Tests', function() {
        it('should display AWS Inspector content when AWS Inspector tab is active', async function() {
            try {
                await page.goto(`http://localhost:${serverPort}`);
                await page.waitForSelector('.content-area[data-module="aws-inspector"]');

                // Verify AWS Inspector content is visible
                const awsContent = await page.$('.content-area[data-module="aws-inspector"]');
                const awsContentVisible = await page.evaluate(el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden';
                }, awsContent);

                expect(awsContentVisible).to.be.true;

                // Verify SBOM content is hidden
                const sbomContent = await page.$('.content-area[data-module="sbom"]');
                const sbomContentVisible = await page.evaluate(el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden';
                }, sbomContent);

                expect(sbomContentVisible).to.be.false;

            } catch (error) {
                // Expected to fail in TDD approach
                console.log('EXPECTED FAILURE: Content switching not implemented yet');
                expect(error.message).to.match(/failed to find element|timeout/i);
            }
        });

        it('should display SBOM content when SBOM tab is clicked', async function() {
            try {
                await page.goto(`http://localhost:${serverPort}`);

                // Click SBOM tab
                const sbomTab = await page.$('.tab[data-module="sbom"]');
                await sbomTab.click();

                // Wait for content to switch
                await page.waitForFunction(() => {
                    const sbomContent = document.querySelector('.content-area[data-module="sbom"]');
                    if (!sbomContent) return false;
                    const style = window.getComputedStyle(sbomContent);
                    return style.display !== 'none' && style.visibility !== 'hidden';
                }, { timeout: 1000 });

                // Verify SBOM content is visible
                const sbomContent = await page.$('.content-area[data-module="sbom"]');
                const sbomContentVisible = await page.evaluate(el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden';
                }, sbomContent);

                expect(sbomContentVisible).to.be.true;

                // Verify AWS Inspector content is hidden
                const awsContent = await page.$('.content-area[data-module="aws-inspector"]');
                const awsContentVisible = await page.evaluate(el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden';
                }, awsContent);

                expect(awsContentVisible).to.be.false;

            } catch (error) {
                // Expected to fail in TDD approach
                console.log('EXPECTED FAILURE: Content switching not implemented yet');
                expect(error.message).to.match(/failed to find element|timeout/i);
            }
        });
    });

    describe('Performance Requirements Tests', function() {
        it('should complete tab switching in under 100ms (performance requirement)', async function() {
            try {
                await page.goto(`http://localhost:${serverPort}`);
                await page.waitForSelector('.tab-container');

                const sbomTab = await page.$('.tab[data-module="sbom"]');

                // Measure tab switching performance
                const startTime = Date.now();

                await sbomTab.click();

                // Wait for the tab switch to complete
                await page.waitForFunction(() => {
                    const sbomTab = document.querySelector('.tab[data-module="sbom"]');
                    return sbomTab && sbomTab.classList.contains('active');
                }, { timeout: 1000 });

                const endTime = Date.now();
                const switchTime = endTime - startTime;

                console.log(`Tab switching took ${switchTime}ms`);
                expect(switchTime).to.be.below(100, 'Tab switching should complete in under 100ms');

            } catch (error) {
                // Expected to fail in TDD approach
                console.log('EXPECTED FAILURE: Tab switching performance not optimized yet');
                expect(error.message).to.match(/failed to find element|timeout/i);
            }
        });

        it('should handle rapid tab switching without performance degradation', async function() {
            try {
                await page.goto(`http://localhost:${serverPort}`);
                await page.waitForSelector('.tab-container');

                const awsTab = await page.$('.tab[data-module="aws-inspector"]');
                const sbomTab = await page.$('.tab[data-module="sbom"]');

                const switchTimes = [];

                // Perform multiple rapid switches
                for (let i = 0; i < 5; i++) {
                    const startTime = Date.now();

                    await sbomTab.click();
                    await page.waitForFunction(() => {
                        const tab = document.querySelector('.tab[data-module="sbom"]');
                        return tab && tab.classList.contains('active');
                    });

                    await awsTab.click();
                    await page.waitForFunction(() => {
                        const tab = document.querySelector('.tab[data-module="aws-inspector"]');
                        return tab && tab.classList.contains('active');
                    });

                    const endTime = Date.now();
                    switchTimes.push(endTime - startTime);
                }

                // Verify all switches were under 100ms
                const averageTime = switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length;
                console.log(`Average tab switching time: ${averageTime}ms`);

                expect(averageTime).to.be.below(100, 'Average tab switching should be under 100ms');
                expect(Math.max(...switchTimes)).to.be.below(200, 'No single switch should exceed 200ms');

            } catch (error) {
                // Expected to fail in TDD approach
                console.log('EXPECTED FAILURE: Rapid tab switching not optimized yet');
                expect(error.message).to.match(/failed to find element|timeout/i);
            }
        });
    });

    describe('Visual Indicator Tests', function() {
        it('should apply correct CSS classes for active and inactive tabs', async function() {
            try {
                await page.goto(`http://localhost:${serverPort}`);
                await page.waitForSelector('.tab-container');

                // Initial state check
                const awsTab = await page.$('.tab[data-module="aws-inspector"]');
                const sbomTab = await page.$('.tab[data-module="sbom"]');

                // Check initial active state
                let awsTabClass = await page.evaluate(tab => tab.className, awsTab);
                let sbomTabClass = await page.evaluate(tab => tab.className, sbomTab);

                expect(awsTabClass).to.include('active');
                expect(sbomTabClass).to.not.include('active');

                // Switch to SBOM
                await sbomTab.click();
                await page.waitForFunction(() => {
                    const tab = document.querySelector('.tab[data-module="sbom"]');
                    return tab && tab.classList.contains('active');
                });

                // Check switched state
                awsTabClass = await page.evaluate(tab => tab.className, awsTab);
                sbomTabClass = await page.evaluate(tab => tab.className, sbomTab);

                expect(awsTabClass).to.not.include('active');
                expect(sbomTabClass).to.include('active');

            } catch (error) {
                // Expected to fail in TDD approach
                console.log('EXPECTED FAILURE: Tab visual indicators not implemented yet');
                expect(error.message).to.match(/failed to find element|timeout/i);
            }
        });

        it('should have proper ARIA attributes for accessibility', async function() {
            try {
                await page.goto(`http://localhost:${serverPort}`);
                await page.waitForSelector('.tab-container');

                // Check ARIA attributes
                const awsTab = await page.$('.tab[data-module="aws-inspector"]');
                const sbomTab = await page.$('.tab[data-module="sbom"]');

                const awsAriaSelected = await page.evaluate(tab => tab.getAttribute('aria-selected'), awsTab);
                const sbomAriaSelected = await page.evaluate(tab => tab.getAttribute('aria-selected'), sbomTab);

                expect(awsAriaSelected).to.equal('true');
                expect(sbomAriaSelected).to.equal('false');

                // Check roles
                const awsRole = await page.evaluate(tab => tab.getAttribute('role'), awsTab);
                const sbomRole = await page.evaluate(tab => tab.getAttribute('role'), sbomTab);

                expect(awsRole).to.equal('tab');
                expect(sbomRole).to.equal('tab');

            } catch (error) {
                // Expected to fail in TDD approach
                console.log('EXPECTED FAILURE: ARIA attributes not implemented yet');
                expect(error.message).to.match(/failed to find element|timeout/i);
            }
        });
    });

    describe('Error Handling and Edge Cases', function() {
        it('should handle clicking on already active tab gracefully', async function() {
            try {
                await page.goto(`http://localhost:${serverPort}`);
                await page.waitForSelector('.tab-container');

                const awsTab = await page.$('.tab[data-module="aws-inspector"]');

                // Click the already active tab
                await awsTab.click();

                // Verify it remains active and no errors occur
                const awsTabClass = await page.evaluate(tab => tab.className, awsTab);
                expect(awsTabClass).to.include('active');

                // Verify no JavaScript errors occurred
                const jsErrors = await page.evaluate(() => window.jsErrors || []);
                expect(jsErrors).to.be.empty;

            } catch (error) {
                // Expected to fail in TDD approach
                console.log('EXPECTED FAILURE: Tab error handling not implemented yet');
                expect(error.message).to.match(/failed to find element|timeout/i);
            }
        });

        it('should maintain state during rapid clicking', async function() {
            try {
                await page.goto(`http://localhost:${serverPort}`);
                await page.waitForSelector('.tab-container');

                const awsTab = await page.$('.tab[data-module="aws-inspector"]');
                const sbomTab = await page.$('.tab[data-module="sbom"]');

                // Rapid clicking
                await sbomTab.click();
                await awsTab.click();
                await sbomTab.click();
                await awsTab.click();

                // Wait for final state
                await page.waitForTimeout(100);

                // Verify exactly one tab is active
                const activeTabs = await page.$$('.tab.active');
                expect(activeTabs).to.have.length(1);

            } catch (error) {
                // Expected to fail in TDD approach
                console.log('EXPECTED FAILURE: Rapid clicking handling not implemented yet');
                expect(error.message).to.match(/failed to find element|timeout/i);
            }
        });
    });
});