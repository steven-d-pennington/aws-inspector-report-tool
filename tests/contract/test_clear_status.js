/**
 * Contract Test: GET /api/settings/clear/status/:id
 * T010: Check clear operation status
 *
 * Tests MUST FAIL before implementation as per TDD principles.
 *
 * Contract Requirements:
 * - Admin authentication required
 * - Returns { status: string, progress: number, recordsCleared?: number }
 * - status must be one of: 'pending', 'running', 'completed', 'failed'
 * - progress must be integer 0-100
 * - recordsCleared only present when status is 'completed'
 * - Returns 404 for invalid operation IDs
 * - Returns 403 for non-admin users
 */

const request = require('supertest');
const { expect } = require('chai');

describe('Contract Test: GET /api/settings/clear/status/:id', () => {
    let app;
    const validOperationId = '456e7890-e89b-12d3-a456-426614174001';
    const invalidOperationId = 'invalid-clear-id';

    before(async () => {
        // This will fail until we implement the clear status route
        try {
            app = require('../../server');
        } catch (error) {
            console.warn('Server not ready for clear status testing:', error.message);
        }
    });

    describe('Authentication Requirements', () => {
        it('should return 401 for unauthenticated requests', async () => {
            const response = await request(app)
                .get(`/api/settings/clear/status/${validOperationId}`)
                .expect(401);

            expect(response.status).to.equal(401);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('authentication');
        });

        it('should return 403 for non-admin users', async () => {
            const response = await request(app)
                .get(`/api/settings/clear/status/${validOperationId}`)
                .set('Authorization', 'Bearer user-token')
                .expect(403);

            expect(response.status).to.equal(403);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('admin');
        });
    });

    describe('Operation ID Validation', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should return 404 for invalid operation ID format', async () => {
            const response = await request(app)
                .get(`/api/settings/clear/status/${invalidOperationId}`)
                .set('X-Admin-Auth', 'true')
                .expect(404);

            expect(response.status).to.equal(404);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('operation not found');
        });

        it('should return 404 for non-existent operation ID', async () => {
            const nonExistentId = '888e4567-e89b-12d3-a456-426614174888';
            const response = await request(app)
                .get(`/api/settings/clear/status/${nonExistentId}`)
                .set('X-Admin-Auth', 'true')
                .expect(404);

            expect(response.status).to.equal(404);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('operation not found');
        });

        it('should return 400 for backup operation ID used in clear endpoint', async () => {
            const backupOperationId = '123e4567-e89b-12d3-a456-426614174000'; // From backup tests
            const response = await request(app)
                .get(`/api/settings/clear/status/${backupOperationId}`)
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Wrong-Operation-Type', 'backup')
                .expect(400);

            expect(response.status).to.equal(400);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('invalid operation type');
        });
    });

    describe('Status Response Validation - Pending Operation', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should return pending status for new operation', async () => {
            const response = await request(app)
                .get(`/api/settings/clear/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Status', 'pending')
                .expect(200);

            expect(response.headers['content-type']).to.include('application/json');
            expect(response.body).to.have.property('status');
            expect(response.body).to.have.property('progress');
            expect(response.body.status).to.equal('pending');
            expect(response.body.progress).to.be.a('number');
            expect(response.body.progress).to.be.at.least(0);
            expect(response.body.progress).to.be.at.most(100);
            expect(response.body).to.not.have.property('recordsCleared');
        });
    });

    describe('Status Response Validation - Running Operation', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should return running status with progress', async () => {
            const response = await request(app)
                .get(`/api/settings/clear/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Status', 'running')
                .set('X-Mock-Progress', '65')
                .expect(200);

            expect(response.body.status).to.equal('running');
            expect(response.body.progress).to.equal(65);
            expect(response.body).to.not.have.property('recordsCleared');
        });

        it('should validate progress bounds for running operations', async () => {
            const response = await request(app)
                .get(`/api/settings/clear/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Status', 'running')
                .expect(200);

            expect(response.body.progress).to.be.at.least(0);
            expect(response.body.progress).to.be.at.most(100);
            expect(Number.isInteger(response.body.progress)).to.be.true;
        });

        it('should include partial counts during running state', async () => {
            const response = await request(app)
                .get(`/api/settings/clear/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Status', 'running')
                .set('X-Mock-Partial-Count', '1250')
                .expect(200);

            // Optional: Include current cleared count during operation
            if (response.body.recordsCleared) {
                expect(response.body.recordsCleared).to.be.a('number');
                expect(response.body.recordsCleared).to.be.at.least(0);
            }
        });
    });

    describe('Status Response Validation - Completed Operation', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should return completed status with records cleared', async () => {
            const response = await request(app)
                .get(`/api/settings/clear/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Status', 'completed')
                .set('X-Mock-Records-Cleared', '2500')
                .expect(200);

            expect(response.body.status).to.equal('completed');
            expect(response.body.progress).to.equal(100);
            expect(response.body).to.have.property('recordsCleared');
            expect(response.body.recordsCleared).to.be.a('number');
            expect(response.body.recordsCleared).to.be.at.least(0);
        });

        it('should validate recordsCleared field type and value', async () => {
            const response = await request(app)
                .get(`/api/settings/clear/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Status', 'completed')
                .expect(200);

            expect(response.body.recordsCleared).to.be.a('number');
            expect(Number.isInteger(response.body.recordsCleared)).to.be.true;
            expect(response.body.recordsCleared).to.be.at.least(0);
        });

        it('should handle zero records cleared scenario', async () => {
            const response = await request(app)
                .get(`/api/settings/clear/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Status', 'completed')
                .set('X-Mock-Records-Cleared', '0')
                .expect(200);

            expect(response.body.status).to.equal('completed');
            expect(response.body.recordsCleared).to.equal(0);
        });
    });

    describe('Status Response Validation - Failed Operation', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should return failed status with error information', async () => {
            const response = await request(app)
                .get(`/api/settings/clear/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Status', 'failed')
                .set('X-Mock-Error', 'Database connection lost')
                .expect(200);

            expect(response.body.status).to.equal('failed');
            expect(response.body.progress).to.be.a('number');
            expect(response.body).to.not.have.property('recordsCleared');

            // Failed operations may include error message
            if (response.body.error) {
                expect(response.body.error).to.be.a('string');
                expect(response.body.error.length).to.be.greaterThan(0);
            }
        });

        it('should include partial progress for failed operations', async () => {
            const response = await request(app)
                .get(`/api/settings/clear/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Status', 'failed')
                .set('X-Mock-Progress', '30')
                .expect(200);

            expect(response.body.status).to.equal('failed');
            expect(response.body.progress).to.equal(30);
        });

        it('should handle different failure types', async () => {
            const failureTypes = [
                'database-connection-lost',
                'insufficient-permissions',
                'transaction-timeout',
                'disk-space-full',
                'operation-cancelled'
            ];

            for (const failureType of failureTypes) {
                const response = await request(app)
                    .get(`/api/settings/clear/status/${validOperationId}`)
                    .set('X-Admin-Auth', 'true')
                    .set('X-Mock-Status', 'failed')
                    .set('X-Mock-Failure-Type', failureType)
                    .expect(200);

                expect(response.body.status).to.equal('failed');
                if (response.body.error) {
                    expect(response.body.error).to.include(failureType.replace('-', ' '));
                }
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

        it('should return only valid status values', async () => {
            const validStatuses = ['pending', 'running', 'completed', 'failed'];

            const response = await request(app)
                .get(`/api/settings/clear/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .expect(200);

            expect(validStatuses).to.include(response.body.status);
        });

        it('should return only required fields based on status', async () => {
            const testCases = [
                {
                    status: 'pending',
                    expectedFields: ['status', 'progress'],
                    forbiddenFields: ['recordsCleared']
                },
                {
                    status: 'running',
                    expectedFields: ['status', 'progress'],
                    forbiddenFields: ['recordsCleared']
                },
                {
                    status: 'completed',
                    expectedFields: ['status', 'progress', 'recordsCleared'],
                    forbiddenFields: []
                },
                {
                    status: 'failed',
                    expectedFields: ['status', 'progress'],
                    forbiddenFields: ['recordsCleared']
                }
            ];

            for (const testCase of testCases) {
                const response = await request(app)
                    .get(`/api/settings/clear/status/${validOperationId}`)
                    .set('X-Admin-Auth', 'true')
                    .set('X-Mock-Status', testCase.status)
                    .expect(200);

                // Check required fields are present
                testCase.expectedFields.forEach(field => {
                    expect(response.body).to.have.property(field,
                        `${testCase.status} status should have ${field}`);
                });

                // Check forbidden fields are not present
                testCase.forbiddenFields.forEach(field => {
                    expect(response.body).to.not.have.property(field,
                        `${testCase.status} status should not have ${field}`);
                });
            }
        });

        it('should set appropriate cache headers', async () => {
            const response = await request(app)
                .get(`/api/settings/clear/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .expect(200);

            // Status should not be cached as it changes frequently
            expect(response.headers['cache-control']).to.include('no-cache');
        });

        it('should include operation metadata in headers', async () => {
            const response = await request(app)
                .get(`/api/settings/clear/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .expect(200);

            // Optional: Include operation type in headers for tracking
            if (response.headers['x-operation-type']) {
                expect(response.headers['x-operation-type']).to.equal('database-clear');
            }
        });
    });

    describe('Operation State Transitions', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should track operation from start to completion', async () => {
            // Simulate checking status at different points in time
            const statusSequence = ['pending', 'running', 'running', 'completed'];
            const progressSequence = [0, 25, 75, 100];

            for (let i = 0; i < statusSequence.length; i++) {
                const response = await request(app)
                    .get(`/api/settings/clear/status/${validOperationId}`)
                    .set('X-Admin-Auth', 'true')
                    .set('X-Mock-Status', statusSequence[i])
                    .set('X-Mock-Progress', progressSequence[i].toString())
                    .expect(200);

                expect(response.body.status).to.equal(statusSequence[i]);
                expect(response.body.progress).to.equal(progressSequence[i]);

                // Only completed status should have recordsCleared
                if (statusSequence[i] === 'completed') {
                    expect(response.body).to.have.property('recordsCleared');
                } else {
                    expect(response.body).to.not.have.property('recordsCleared');
                }
            }
        });

        it('should maintain consistency in progress reporting', async () => {
            const response = await request(app)
                .get(`/api/settings/clear/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Status', 'running')
                .expect(200);

            // Progress should be consistent with status
            if (response.body.status === 'pending') {
                expect(response.body.progress).to.be.lessThan(10);
            } else if (response.body.status === 'running') {
                expect(response.body.progress).to.be.greaterThan(0);
                expect(response.body.progress).to.be.lessThan(100);
            } else if (response.body.status === 'completed') {
                expect(response.body.progress).to.equal(100);
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

        it('should handle operation store errors', async () => {
            const response = await request(app)
                .get(`/api/settings/clear/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Store-Error', 'redis-unavailable')
                .expect(500);

            expect(response.status).to.equal(500);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('operation store unavailable');
        });

        it('should handle concurrent status requests gracefully', async () => {
            const concurrentRequests = Array(10).fill().map(() =>
                request(app)
                    .get(`/api/settings/clear/status/${validOperationId}`)
                    .set('X-Admin-Auth', 'true')
            );

            const responses = await Promise.all(concurrentRequests);

            // All requests should return the same status
            const statuses = responses.map(r => r.body.status);
            const uniqueStatuses = [...new Set(statuses)];
            expect(uniqueStatuses.length).to.equal(1);
        });

        it('should handle expired operations appropriately', async () => {
            const response = await request(app)
                .get(`/api/settings/clear/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Operation-Expired', 'true')
                .expect(410); // Gone

            expect(response.status).to.equal(410);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('operation expired');
        });
    });

    describe('Performance Considerations', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should respond quickly for status queries', async () => {
            const startTime = Date.now();
            const response = await request(app)
                .get(`/api/settings/clear/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .expect(200);

            const responseTime = Date.now() - startTime;
            expect(responseTime).to.be.lessThan(1000); // Should respond within 1 second
        });

        it('should handle high frequency status polling', async () => {
            // Simulate rapid polling (every 100ms for 1 second)
            const rapidRequests = Array(10).fill().map((_, i) =>
                new Promise(resolve => {
                    setTimeout(async () => {
                        const response = await request(app)
                            .get(`/api/settings/clear/status/${validOperationId}`)
                            .set('X-Admin-Auth', 'true');
                        resolve(response);
                    }, i * 100);
                })
            );

            const responses = await Promise.all(rapidRequests);

            // All requests should succeed
            responses.forEach(response => {
                expect(response.status).to.equal(200);
            });
        });
    });
});