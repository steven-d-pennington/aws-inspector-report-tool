/**
 * Contract Test: POST /api/settings/clear
 * T009: Clear database operation with confirmation
 *
 * Tests MUST FAIL before implementation as per TDD principles.
 *
 * Contract Requirements:
 * - Admin authentication required
 * - Requires confirmationText: "CONFIRM" in request body
 * - Returns { operationId: string, status: 'pending' }
 * - operationId must be a valid UUID
 * - Returns 400 for missing or incorrect confirmation
 * - Returns 403 for non-admin users
 * - Content-Type: application/json
 */

const request = require('supertest');
const { expect } = require('chai');

describe('Contract Test: POST /api/settings/clear', () => {
    let app;

    before(async () => {
        // This will fail until we implement the clear database route
        try {
            app = require('../../server');
        } catch (error) {
            console.warn('Server not ready for database clear testing:', error.message);
        }
    });

    describe('Authentication Requirements', () => {
        it('should return 401 for unauthenticated requests', async () => {
            const response = await request(app)
                .post('/api/settings/clear')
                .send({ confirmationText: 'CONFIRM' })
                .expect(401);

            expect(response.status).to.equal(401);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('authentication');
        });

        it('should return 403 for non-admin users', async () => {
            const response = await request(app)
                .post('/api/settings/clear')
                .set('Authorization', 'Bearer user-token')
                .send({ confirmationText: 'CONFIRM' })
                .expect(403);

            expect(response.status).to.equal(403);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('admin');
        });
    });

    describe('Confirmation Text Validation', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should return 400 for missing confirmation text', async () => {
            const response = await request(app)
                .post('/api/settings/clear')
                .set('X-Admin-Auth', 'true')
                .send({})
                .expect(400);

            expect(response.status).to.equal(400);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('confirmation required');
        });

        it('should return 400 for incorrect confirmation text', async () => {
            const incorrectConfirmations = [
                'confirm',           // lowercase
                'CONFIRMED',        // wrong word
                'YES',              // different word
                'CONFIRM ',         // trailing space
                ' CONFIRM',         // leading space
                'CONF1RM',          // with number
                ''                  // empty string
            ];

            for (const confirmationText of incorrectConfirmations) {
                const response = await request(app)
                    .post('/api/settings/clear')
                    .set('X-Admin-Auth', 'true')
                    .send({ confirmationText })
                    .expect(400);

                expect(response.status).to.equal(400, `Should reject: "${confirmationText}"`);
                expect(response.body).to.have.property('error');
                expect(response.body.error).to.include('invalid confirmation');
            }
        });

        it('should accept exact confirmation text "CONFIRM"', async () => {
            const response = await request(app)
                .post('/api/settings/clear')
                .set('X-Admin-Auth', 'true')
                .send({ confirmationText: 'CONFIRM' })
                .expect(200);

            expect(response.status).to.equal(200);
            expect(response.headers['content-type']).to.include('application/json');
        });

        it('should validate confirmation text type', async () => {
            const invalidTypes = [
                { confirmationText: 123 },          // number
                { confirmationText: true },         // boolean
                { confirmationText: null },         // null
                { confirmationText: undefined },    // undefined
                { confirmationText: ['CONFIRM'] },  // array
                { confirmationText: { text: 'CONFIRM' } } // object
            ];

            for (const payload of invalidTypes) {
                const response = await request(app)
                    .post('/api/settings/clear')
                    .set('X-Admin-Auth', 'true')
                    .send(payload)
                    .expect(400);

                expect(response.status).to.equal(400,
                    `Should reject non-string confirmation: ${JSON.stringify(payload)}`);
            }
        });
    });

    describe('Clear Operation Success', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should create clear operation for valid request', async () => {
            const response = await request(app)
                .post('/api/settings/clear')
                .set('X-Admin-Auth', 'true')
                .send({ confirmationText: 'CONFIRM' })
                .expect(200);

            expect(response.status).to.equal(200);
            expect(response.headers['content-type']).to.include('application/json');

            // Validate response contract
            expect(response.body).to.have.property('operationId');
            expect(response.body).to.have.property('status');
            expect(response.body.status).to.equal('pending');

            // Validate operationId is a UUID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            expect(response.body.operationId).to.match(uuidRegex);
        });

        it('should handle multiple concurrent clear requests', async () => {
            const request1 = request(app)
                .post('/api/settings/clear')
                .set('X-Admin-Auth', 'true')
                .send({ confirmationText: 'CONFIRM' });

            const request2 = request(app)
                .post('/api/settings/clear')
                .set('X-Admin-Auth', 'true')
                .send({ confirmationText: 'CONFIRM' });

            const [response1, response2] = await Promise.all([request1, request2]);

            // Should handle concurrent requests appropriately
            if (response1.status === 200 && response2.status === 200) {
                // Both accepted - different operation IDs
                expect(response1.body.operationId).to.not.equal(response2.body.operationId);
            } else if (response1.status === 200) {
                // First accepted, second rejected due to ongoing operation
                expect(response2.status).to.equal(409); // Conflict
                expect(response2.body.error).to.include('operation already in progress');
            } else if (response2.status === 200) {
                // Second accepted, first rejected
                expect(response1.status).to.equal(409);
                expect(response1.body.error).to.include('operation already in progress');
            }
        });

        it('should reject requests when database is already being cleared', async () => {
            // First request should succeed
            const firstResponse = await request(app)
                .post('/api/settings/clear')
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Operation-Running', 'true')
                .send({ confirmationText: 'CONFIRM' })
                .expect(409);

            expect(firstResponse.status).to.equal(409);
            expect(firstResponse.body).to.have.property('error');
            expect(firstResponse.body.error).to.include('operation already in progress');
        });
    });

    describe('Request Body Validation', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should return 400 for malformed JSON', async () => {
            const response = await request(app)
                .post('/api/settings/clear')
                .set('X-Admin-Auth', 'true')
                .set('Content-Type', 'application/json')
                .send('{ "confirmationText": "CONFIRM"') // Malformed JSON
                .expect(400);

            expect(response.status).to.equal(400);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('invalid JSON');
        });

        it('should return 400 for missing Content-Type header', async () => {
            const response = await request(app)
                .post('/api/settings/clear')
                .set('X-Admin-Auth', 'true')
                .send('confirmationText=CONFIRM') // Form data instead of JSON
                .expect(400);

            expect(response.status).to.equal(400);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('Content-Type must be application/json');
        });

        it('should ignore extra fields in request body', async () => {
            const response = await request(app)
                .post('/api/settings/clear')
                .set('X-Admin-Auth', 'true')
                .send({
                    confirmationText: 'CONFIRM',
                    extraField: 'should be ignored',
                    anotherField: 123
                })
                .expect(200);

            expect(response.status).to.equal(200);
            expect(response.body).to.have.property('operationId');
            expect(response.body).to.have.property('status');
        });

        it('should handle large request payloads appropriately', async () => {
            const largePayload = {
                confirmationText: 'CONFIRM',
                largeField: 'x'.repeat(10000) // 10KB of text
            };

            const response = await request(app)
                .post('/api/settings/clear')
                .set('X-Admin-Auth', 'true')
                .send(largePayload)
                .expect(413); // Payload Too Large or 200 if accepted

            // Either reject large payloads or accept and ignore extra data
            if (response.status === 200) {
                expect(response.body).to.have.property('operationId');
            } else {
                expect(response.body).to.have.property('error');
                expect(response.body.error).to.include('payload too large');
            }
        });
    });

    describe('Response Format Validation', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should return only required fields in response', async () => {
            const response = await request(app)
                .post('/api/settings/clear')
                .set('X-Admin-Auth', 'true')
                .send({ confirmationText: 'CONFIRM' })
                .expect(200);

            // Ensure response only contains expected fields
            const expectedFields = ['operationId', 'status'];
            const actualFields = Object.keys(response.body);

            expectedFields.forEach(field => {
                expect(response.body).to.have.property(field);
            });

            // No unexpected fields
            actualFields.forEach(field => {
                expect(expectedFields).to.include(field);
            });
        });

        it('should set appropriate cache headers', async () => {
            const response = await request(app)
                .post('/api/settings/clear')
                .set('X-Admin-Auth', 'true')
                .send({ confirmationText: 'CONFIRM' })
                .expect(200);

            // Clear operations should not be cached
            expect(response.headers['cache-control']).to.include('no-cache');
        });

        it('should include operation metadata in headers', async () => {
            const response = await request(app)
                .post('/api/settings/clear')
                .set('X-Admin-Auth', 'true')
                .send({ confirmationText: 'CONFIRM' })
                .expect(200);

            // Optional: Include operation type in headers for tracking
            if (response.headers['x-operation-type']) {
                expect(response.headers['x-operation-type']).to.equal('database-clear');
            }
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should handle database connection errors', async () => {
            const response = await request(app)
                .post('/api/settings/clear')
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Database-Error', 'connection-failed')
                .send({ confirmationText: 'CONFIRM' })
                .expect(500);

            expect(response.status).to.equal(500);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('database connection error');
        });

        it('should handle insufficient database permissions', async () => {
            const response = await request(app)
                .post('/api/settings/clear')
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Database-Error', 'permission-denied')
                .send({ confirmationText: 'CONFIRM' })
                .expect(500);

            expect(response.status).to.equal(500);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('insufficient database permissions');
        });

        it('should handle service unavailable scenarios', async () => {
            const response = await request(app)
                .post('/api/settings/clear')
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Service-Error', 'unavailable')
                .send({ confirmationText: 'CONFIRM' })
                .expect(503);

            expect(response.status).to.equal(503);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('service temporarily unavailable');
        });
    });

    describe('Security Validation', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should prevent CSRF attacks', async () => {
            const response = await request(app)
                .post('/api/settings/clear')
                .set('X-Admin-Auth', 'true')
                .set('Origin', 'https://malicious-site.com')
                .send({ confirmationText: 'CONFIRM' })
                .expect(403); // Should be blocked by CSRF protection

            if (response.status === 403) {
                expect(response.body).to.have.property('error');
                expect(response.body.error).to.include('CSRF');
            }
        });

        it('should log security-sensitive operations', async () => {
            const response = await request(app)
                .post('/api/settings/clear')
                .set('X-Admin-Auth', 'true')
                .send({ confirmationText: 'CONFIRM' })
                .expect(200);

            // Clear operations should be logged for audit
            expect(response.headers['x-audit-logged']).to.equal('true');
        });

        it('should rate limit clear operations', async () => {
            // Multiple rapid requests should be rate limited
            const requests = Array(5).fill().map(() =>
                request(app)
                    .post('/api/settings/clear')
                    .set('X-Admin-Auth', 'true')
                    .send({ confirmationText: 'CONFIRM' })
            );

            const responses = await Promise.all(requests);
            const rateLimitedResponses = responses.filter(r => r.status === 429);

            expect(rateLimitedResponses.length).to.be.greaterThan(0);
        });
    });
});