/**
 * Contract Test: GET /api/settings/backup/status/:id
 * T006: Check backup operation status
 *
 * Tests MUST FAIL before implementation as per TDD principles.
 *
 * Contract Requirements:
 * - Admin authentication required
 * - Returns { status: string, progress: number, downloadUrl?: string }
 * - status must be one of: 'pending', 'running', 'completed', 'failed'
 * - progress must be integer 0-100
 * - downloadUrl only present when status is 'completed'
 * - Returns 404 for invalid operation IDs
 * - Returns 403 for non-admin users
 */

const request = require('supertest');
const { expect } = require('chai');

describe('Contract Test: GET /api/settings/backup/status/:id', () => {
    let app;
    const validOperationId = '123e4567-e89b-12d3-a456-426614174000';
    const invalidOperationId = 'invalid-id';

    before(async () => {
        // This will fail until we implement the backup status route
        try {
            app = require('../../server');
        } catch (error) {
            console.warn('Server not ready for backup status testing:', error.message);
        }
    });

    describe('Authentication Requirements', () => {
        it('should return 401 for unauthenticated requests', async () => {
            const response = await request(app)
                .get(`/api/settings/backup/status/${validOperationId}`)
                .expect(401);

            expect(response.status).to.equal(401);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('authentication');
        });

        it('should return 403 for non-admin users', async () => {
            const response = await request(app)
                .get(`/api/settings/backup/status/${validOperationId}`)
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
                .get(`/api/settings/backup/status/${invalidOperationId}`)
                .set('X-Admin-Auth', 'true')
                .expect(404);

            expect(response.status).to.equal(404);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('operation not found');
        });

        it('should return 404 for non-existent operation ID', async () => {
            const nonExistentId = '999e4567-e89b-12d3-a456-426614174999';
            const response = await request(app)
                .get(`/api/settings/backup/status/${nonExistentId}`)
                .set('X-Admin-Auth', 'true')
                .expect(404);

            expect(response.status).to.equal(404);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('operation not found');
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
                .get(`/api/settings/backup/status/${validOperationId}`)
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
            expect(response.body).to.not.have.property('downloadUrl');
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
                .get(`/api/settings/backup/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Status', 'running')
                .set('X-Mock-Progress', '45')
                .expect(200);

            expect(response.body.status).to.equal('running');
            expect(response.body.progress).to.equal(45);
            expect(response.body).to.not.have.property('downloadUrl');
        });

        it('should validate progress bounds for running operations', async () => {
            const response = await request(app)
                .get(`/api/settings/backup/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Status', 'running')
                .expect(200);

            expect(response.body.progress).to.be.at.least(0);
            expect(response.body.progress).to.be.at.most(100);
            expect(Number.isInteger(response.body.progress)).to.be.true;
        });
    });

    describe('Status Response Validation - Completed Operation', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should return completed status with download URL', async () => {
            const response = await request(app)
                .get(`/api/settings/backup/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Status', 'completed')
                .expect(200);

            expect(response.body.status).to.equal('completed');
            expect(response.body.progress).to.equal(100);
            expect(response.body).to.have.property('downloadUrl');
            expect(response.body.downloadUrl).to.be.a('string');
            expect(response.body.downloadUrl).to.include('/api/settings/backup/download/');
        });

        it('should validate download URL format', async () => {
            const response = await request(app)
                .get(`/api/settings/backup/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Status', 'completed')
                .expect(200);

            const downloadUrl = response.body.downloadUrl;
            expect(downloadUrl).to.match(/^\/api\/settings\/backup\/download\/[a-zA-Z0-9_-]+\.sql\.gz$/);
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
                .get(`/api/settings/backup/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Status', 'failed')
                .expect(200);

            expect(response.body.status).to.equal('failed');
            expect(response.body.progress).to.be.a('number');
            expect(response.body).to.not.have.property('downloadUrl');

            // Failed operations may include error message
            if (response.body.error) {
                expect(response.body.error).to.be.a('string');
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
                .get(`/api/settings/backup/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .expect(200);

            expect(validStatuses).to.include(response.body.status);
        });

        it('should set appropriate cache headers', async () => {
            const response = await request(app)
                .get(`/api/settings/backup/status/${validOperationId}`)
                .set('X-Admin-Auth', 'true')
                .expect(200);

            // Status should not be cached as it changes frequently
            expect(response.headers['cache-control']).to.include('no-cache');
        });
    });
});