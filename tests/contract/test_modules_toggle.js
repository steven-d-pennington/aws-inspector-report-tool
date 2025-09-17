const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const path = require('path');
const Database = require('../../src/models/database');
const ModuleService = require('../../src/services/moduleService');

describe('PUT /api/modules/{moduleId}/toggle - Contract Tests', function() {
    let app;
    let db;
    let moduleService;
    let server;

    // Test setup - create Express app instance
    before(async function() {
        this.timeout(10000);

        // Initialize database and moduleService
        db = new Database();
        moduleService = new ModuleService();

        // Create test Express app
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        // Add the PUT /api/modules/:moduleId/toggle endpoint implementation
        app.put('/api/modules/:moduleId/toggle', async (req, res) => {
            try {
                const { moduleId } = req.params;
                const { enabled } = req.body;

                // Validate request body structure
                if (!req.body.hasOwnProperty('enabled')) {
                    return res.status(400).json({
                        error: 'Missing required field: enabled'
                    });
                }

                // Validate enabled field type
                if (typeof enabled !== 'boolean') {
                    return res.status(400).json({
                        error: 'Invalid enabled value - must be boolean'
                    });
                }

                // Use moduleService for comprehensive validation and business logic
                const updatedModule = await moduleService.toggleModule(moduleId, enabled, 'test-user');

                // Return response according to OpenAPI specification
                res.json({
                    success: true,
                    module: updatedModule
                });

            } catch (error) {
                // Handle specific error types with appropriate HTTP status codes
                const errorMessage = error.message;

                if (errorMessage.includes('not found')) {
                    return res.status(404).json({
                        error: errorMessage
                    });
                }

                if (errorMessage.includes('cannot disable') ||
                    errorMessage.includes('Cannot disable') ||
                    errorMessage.includes('default module') ||
                    errorMessage.includes('at least one module')) {
                    return res.status(400).json({
                        error: errorMessage
                    });
                }

                // Log unexpected errors for debugging
                console.error('Module toggle error:', error);
                res.status(500).json({
                    error: 'Internal server error'
                });
            }
        });

        // Start server
        server = app.listen(0); // Use random port for testing
    });

    // Test teardown
    after(async function() {
        if (server) {
            server.close();
        }
        if (db && db.db) {
            db.db.close();
        }
    });

    // Reset database before each test
    beforeEach(async function() {
        this.timeout(5000);

        // Initialize database and create tables
        await db.initialize();
        await moduleService.initialize();

        // Clear and insert test modules
        await new Promise((resolve, reject) => {
            db.db.run('DELETE FROM module_settings', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        await new Promise((resolve, reject) => {
            db.db.run(`
                INSERT INTO module_settings (
                    module_id, name, description, enabled, is_default, display_order, route, created_at, updated_at
                ) VALUES
                ('aws-inspector', 'AWS Inspector', 'AWS Inspector vulnerability reports', 1, 1, 1, '/', datetime('now'), datetime('now')),
                ('sbom', 'SBOM Reports', 'Software Bill of Materials reports', 0, 0, 2, '/sbom', datetime('now'), datetime('now')),
                ('test-module', 'Test Module', 'Test module for testing', 1, 0, 3, '/test', datetime('now'), datetime('now'))
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });

    describe('Contract Validation - OpenAPI Specification Compliance', function() {

        describe('Successful Module Toggle (200 Response)', function() {
            it('should toggle module from enabled to disabled with correct response schema', async function() {
                const moduleId = 'test-module';
                const requestBody = { enabled: false };

                const response = await request(app)
                    .put(`/api/modules/${moduleId}/toggle`)
                    .send(requestBody)
                    .expect('Content-Type', /json/)
                    .expect(200);

                // Validate response schema per OpenAPI spec
                expect(response.body).to.have.property('success');
                expect(response.body.success).to.be.a('boolean').and.equal(true);

                expect(response.body).to.have.property('module');
                expect(response.body.module).to.be.an('object');

                // Validate Module schema properties
                const module = response.body.module;
                expect(module).to.have.property('module_id').that.is.a('string').and.equals(moduleId);
                expect(module).to.have.property('name').that.is.a('string');
                expect(module).to.have.property('enabled').that.is.a('boolean').and.equals(false);
                expect(module).to.have.property('is_default').that.is.a('boolean');
                expect(module).to.have.property('display_order').that.is.a('number');
                expect(module).to.have.property('description').that.is.a('string');
                expect(module).to.have.property('route').that.is.a('string');

                // Optional properties that may be present
                if (module.created_at) {
                    expect(module.created_at).to.be.a('string');
                }
                if (module.updated_at) {
                    expect(module.updated_at).to.be.a('string');
                }
            });

            it('should toggle module from disabled to enabled with correct response schema', async function() {
                const moduleId = 'sbom';
                const requestBody = { enabled: true };

                const response = await request(app)
                    .put(`/api/modules/${moduleId}/toggle`)
                    .send(requestBody)
                    .expect('Content-Type', /json/)
                    .expect(200);

                // Validate response schema
                expect(response.body).to.have.property('success', true);
                expect(response.body).to.have.property('module');

                const module = response.body.module;
                expect(module.module_id).to.equal(moduleId);
                expect(module.enabled).to.equal(true);
                expect(module.name).to.equal('SBOM Reports');
            });
        });

        describe('Request Body Validation (400 Response)', function() {
            it('should return 400 when enabled field is missing', async function() {
                const moduleId = 'test-module';
                const requestBody = {}; // Missing required 'enabled' field

                const response = await request(app)
                    .put(`/api/modules/${moduleId}/toggle`)
                    .send(requestBody)
                    .expect('Content-Type', /json/)
                    .expect(400);

                // Validate error response schema per OpenAPI spec
                expect(response.body).to.have.property('error').that.is.a('string');
                expect(response.body.error).to.match(/enabled.*required/i);
            });

            it('should return 400 when enabled field is not boolean', async function() {
                const moduleId = 'test-module';
                const requestBody = { enabled: "true" }; // String instead of boolean

                const response = await request(app)
                    .put(`/api/modules/${moduleId}/toggle`)
                    .send(requestBody)
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body).to.have.property('error').that.is.a('string');
                expect(response.body.error).to.match(/enabled.*boolean/i);
            });

            it('should return 400 when request body is empty', async function() {
                const moduleId = 'test-module';

                const response = await request(app)
                    .put(`/api/modules/${moduleId}/toggle`)
                    .send()
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body).to.have.property('error').that.is.a('string');
            });

            it('should return 400 when trying to disable default module', async function() {
                const moduleId = 'aws-inspector'; // This is the default module
                const requestBody = { enabled: false };

                const response = await request(app)
                    .put(`/api/modules/${moduleId}/toggle`)
                    .send(requestBody)
                    .expect('Content-Type', /json/)
                    .expect(400);

                // Validate error response schema
                expect(response.body).to.have.property('error').that.is.a('string');
                expect(response.body.error).to.match(/default.*module.*cannot.*disabled/i);

                // Verify optional error schema properties
                if (response.body.code) {
                    expect(response.body.code).to.be.a('string');
                }
                if (response.body.details) {
                    expect(response.body.details).to.be.an('object');
                }
            });

            it('should return 400 when trying to disable the last enabled module', async function() {
                // First disable test-module to leave only aws-inspector enabled
                await request(app)
                    .put('/api/modules/test-module/toggle')
                    .send({ enabled: false })
                    .expect(200);

                // Now try to disable the last enabled module (aws-inspector)
                const moduleId = 'aws-inspector';
                const requestBody = { enabled: false };

                const response = await request(app)
                    .put(`/api/modules/${moduleId}/toggle`)
                    .send(requestBody)
                    .expect('Content-Type', /json/)
                    .expect(400);

                // Validate error response schema
                expect(response.body).to.have.property('error').that.is.a('string');
                expect(response.body.error).to.match(/at least one module.*must remain enabled/i);
            });
        });

        describe('Module Not Found (404 Response)', function() {
            it('should return 404 for non-existent module', async function() {
                const moduleId = 'non-existent-module';
                const requestBody = { enabled: true };

                const response = await request(app)
                    .put(`/api/modules/${moduleId}/toggle`)
                    .send(requestBody)
                    .expect('Content-Type', /json/)
                    .expect(404);

                // Validate error response schema per OpenAPI spec
                expect(response.body).to.have.property('error').that.is.a('string');
                expect(response.body.error).to.match(/module.*not.*found/i);
            });

            it('should return 404 for empty module ID', async function() {
                const moduleId = '';
                const requestBody = { enabled: true };

                const response = await request(app)
                    .put(`/api/modules/${moduleId}/toggle`)
                    .send(requestBody)
                    .expect(404); // This might be handled by routing as 404
            });
        });

        describe('Path Parameter Validation', function() {
            it('should handle special characters in module ID correctly', async function() {
                const moduleId = 'module-with-special-chars_123';
                const requestBody = { enabled: true };

                // This should return 404 since module doesn't exist, but shouldn't cause server error
                const response = await request(app)
                    .put(`/api/modules/${moduleId}/toggle`)
                    .send(requestBody);

                expect(response.status).to.be.oneOf([404, 400]); // Either not found or bad request
                expect(response.body).to.have.property('error');
            });
        });

        describe('Content-Type Validation', function() {
            it('should handle JSON content-type correctly', async function() {
                const moduleId = 'test-module';
                const requestBody = { enabled: false };

                const response = await request(app)
                    .put(`/api/modules/${moduleId}/toggle`)
                    .set('Content-Type', 'application/json')
                    .send(requestBody);

                // Should process correctly regardless of actual implementation
                expect(response.headers['content-type']).to.match(/json/);
            });

            it('should reject non-JSON content-type', async function() {
                const moduleId = 'test-module';

                const response = await request(app)
                    .put(`/api/modules/${moduleId}/toggle`)
                    .set('Content-Type', 'text/plain')
                    .send('enabled=false');

                expect(response.status).to.be.oneOf([400, 415]); // Bad request or unsupported media type
            });
        });
    });

    describe('Database State Validation', function() {
        it('should persist module state changes in database', async function() {
            const moduleId = 'test-module';
            const requestBody = { enabled: false };

            // Make the toggle request
            await request(app)
                .put(`/api/modules/${moduleId}/toggle`)
                .send(requestBody)
                .expect(200);

            // Verify the change was persisted in database
            const module = await new Promise((resolve, reject) => {
                db.db.get(
                    'SELECT * FROM module_settings WHERE module_id = ?',
                    [moduleId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            expect(module).to.not.be.undefined;
            expect(module.enabled).to.equal(0); // SQLite stores boolean as 0/1
        });

        it('should update module timestamp on toggle', async function() {
            const moduleId = 'test-module';

            // Get original timestamp
            const originalModule = await new Promise((resolve, reject) => {
                db.db.get(
                    'SELECT updated_at FROM module_settings WHERE module_id = ?',
                    [moduleId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            // Wait a moment to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 10));

            // Toggle the module
            await request(app)
                .put(`/api/modules/${moduleId}/toggle`)
                .send({ enabled: false })
                .expect(200);

            // Verify timestamp was updated
            const updatedModule = await new Promise((resolve, reject) => {
                db.db.get(
                    'SELECT updated_at FROM module_settings WHERE module_id = ?',
                    [moduleId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            expect(updatedModule.updated_at).to.not.equal(originalModule.updated_at);
        });
    });

    describe('Edge Cases and Error Handling', function() {
        it('should handle concurrent toggle requests gracefully', async function() {
            const moduleId = 'test-module';

            // Make concurrent requests
            const promises = [
                request(app).put(`/api/modules/${moduleId}/toggle`).send({ enabled: false }),
                request(app).put(`/api/modules/${moduleId}/toggle`).send({ enabled: true }),
                request(app).put(`/api/modules/${moduleId}/toggle`).send({ enabled: false })
            ];

            const responses = await Promise.all(promises);

            // All requests should complete without server errors
            responses.forEach(response => {
                expect(response.status).to.not.equal(500);
            });
        });

        it('should validate module ID format restrictions', async function() {
            const invalidModuleIds = ['', ' ', 'module with spaces', 'module/with/slashes'];

            for (const moduleId of invalidModuleIds) {
                const response = await request(app)
                    .put(`/api/modules/${encodeURIComponent(moduleId)}/toggle`)
                    .send({ enabled: true });

                expect(response.status).to.be.oneOf([400, 404]); // Either validation error or not found
            }
        });
    });
});