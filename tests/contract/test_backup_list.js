/**
 * Contract Test: GET /api/settings/backup/list
 * T008: List available backup files
 *
 * Tests MUST FAIL before implementation as per TDD principles.
 *
 * Contract Requirements:
 * - Admin authentication required
 * - Returns array of backup file objects
 * - Each object: { filename: string, size: number, created: string, downloadUrl: string }
 * - Files sorted by creation date (newest first)
 * - Returns empty array if no backups exist
 * - Returns 403 for non-admin users
 * - Content-Type: application/json
 */

const request = require('supertest');
const { expect } = require('chai');

describe('Contract Test: GET /api/settings/backup/list', () => {
    let app;

    before(async () => {
        // This will fail until we implement the backup list route
        try {
            app = require('../../server');
        } catch (error) {
            console.warn('Server not ready for backup list testing:', error.message);
        }
    });

    describe('Authentication Requirements', () => {
        it('should return 401 for unauthenticated requests', async () => {
            const response = await request(app)
                .get('/api/settings/backup/list')
                .expect(401);

            expect(response.status).to.equal(401);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('authentication');
        });

        it('should return 403 for non-admin users', async () => {
            const response = await request(app)
                .get('/api/settings/backup/list')
                .set('Authorization', 'Bearer user-token')
                .expect(403);

            expect(response.status).to.equal(403);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('admin');
        });
    });

    describe('Empty Backup List', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should return empty array when no backups exist', async () => {
            const response = await request(app)
                .get('/api/settings/backup/list')
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Empty-List', 'true')
                .expect(200);

            expect(response.headers['content-type']).to.include('application/json');
            expect(response.body).to.be.an('array');
            expect(response.body).to.have.length(0);
        });
    });

    describe('Backup List with Files', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should return array of backup file objects', async () => {
            const response = await request(app)
                .get('/api/settings/backup/list')
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Multiple-Files', 'true')
                .expect(200);

            expect(response.body).to.be.an('array');
            expect(response.body.length).to.be.greaterThan(0);

            // Validate first backup object structure
            const backup = response.body[0];
            expect(backup).to.have.property('filename');
            expect(backup).to.have.property('size');
            expect(backup).to.have.property('created');
            expect(backup).to.have.property('downloadUrl');
        });

        it('should validate backup object field types', async () => {
            const response = await request(app)
                .get('/api/settings/backup/list')
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Multiple-Files', 'true')
                .expect(200);

            response.body.forEach((backup, index) => {
                expect(backup.filename, `backup[${index}].filename`).to.be.a('string');
                expect(backup.size, `backup[${index}].size`).to.be.a('number');
                expect(backup.created, `backup[${index}].created`).to.be.a('string');
                expect(backup.downloadUrl, `backup[${index}].downloadUrl`).to.be.a('string');

                // Validate filename format
                expect(backup.filename).to.match(/^backup_\d{8}_\d{6}\.sql\.gz$/);

                // Validate size is positive
                expect(backup.size).to.be.greaterThan(0);

                // Validate created is ISO date string
                expect(() => new Date(backup.created)).to.not.throw();
                expect(new Date(backup.created).toISOString()).to.equal(backup.created);

                // Validate download URL format
                expect(backup.downloadUrl).to.include('/api/settings/backup/download/');
                expect(backup.downloadUrl).to.include(backup.filename);
            });
        });

        it('should sort backups by creation date (newest first)', async () => {
            const response = await request(app)
                .get('/api/settings/backup/list')
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Multiple-Files', 'true')
                .expect(200);

            if (response.body.length > 1) {
                for (let i = 0; i < response.body.length - 1; i++) {
                    const current = new Date(response.body[i].created);
                    const next = new Date(response.body[i + 1].created);
                    expect(current.getTime()).to.be.greaterThan(next.getTime(),
                        'Backups should be sorted newest first');
                }
            }
        });

        it('should include only valid backup files', async () => {
            const response = await request(app)
                .get('/api/settings/backup/list')
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Mixed-Files', 'true') // Include non-backup files in directory
                .expect(200);

            // All returned files should be backup files
            response.body.forEach(backup => {
                expect(backup.filename).to.match(/^backup_\d{8}_\d{6}\.sql\.gz$/);
            });
        });
    });

    describe('Response Format Validation', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should return only required fields in backup objects', async () => {
            const response = await request(app)
                .get('/api/settings/backup/list')
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Multiple-Files', 'true')
                .expect(200);

            const expectedFields = ['filename', 'size', 'created', 'downloadUrl'];

            response.body.forEach((backup, index) => {
                const actualFields = Object.keys(backup);

                // Check all required fields are present
                expectedFields.forEach(field => {
                    expect(backup).to.have.property(field, `backup[${index}] missing ${field}`);
                });

                // Check no unexpected fields
                actualFields.forEach(field => {
                    expect(expectedFields).to.include(field, `backup[${index}] has unexpected field ${field}`);
                });
            });
        });

        it('should set appropriate cache headers', async () => {
            const response = await request(app)
                .get('/api/settings/backup/list')
                .set('X-Admin-Auth', 'true')
                .expect(200);

            // Backup list can be cached briefly as it doesn't change frequently
            expect(response.headers['cache-control']).to.include('private');
            expect(response.headers['cache-control']).to.include('max-age');
        });

        it('should handle large number of backup files efficiently', async () => {
            const response = await request(app)
                .get('/api/settings/backup/list')
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Many-Files', '100')
                .expect(200);

            expect(response.body).to.be.an('array');
            // Should not timeout or return 500 error for large lists
            expect(response.status).to.equal(200);
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should handle backup directory access errors', async () => {
            const response = await request(app)
                .get('/api/settings/backup/list')
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Directory-Error', 'permission-denied')
                .expect(500);

            expect(response.status).to.equal(500);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('directory access error');
        });

        it('should handle backup directory not existing', async () => {
            const response = await request(app)
                .get('/api/settings/backup/list')
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Directory-Error', 'not-found')
                .expect(200); // Should create directory and return empty list

            expect(response.body).to.be.an('array');
            expect(response.body).to.have.length(0);
        });

        it('should handle corrupted backup files gracefully', async () => {
            const response = await request(app)
                .get('/api/settings/backup/list')
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Corrupted-Files', 'true')
                .expect(200);

            // Should exclude corrupted files from list
            expect(response.body).to.be.an('array');
            response.body.forEach(backup => {
                expect(backup.size).to.be.greaterThan(0);
            });
        });
    });

    describe('Security Validation', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should not expose system file paths', async () => {
            const response = await request(app)
                .get('/api/settings/backup/list')
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Multiple-Files', 'true')
                .expect(200);

            response.body.forEach(backup => {
                // downloadUrl should be relative, not absolute path
                expect(backup.downloadUrl).to.not.include('C:');
                expect(backup.downloadUrl).to.not.include('/var/');
                expect(backup.downloadUrl).to.not.include('/tmp/');
                expect(backup.downloadUrl).to.not.include('/home/');
                expect(backup.downloadUrl).to.startWith('/api/settings/backup/download/');
            });
        });

        it('should only list files from backup directory', async () => {
            const response = await request(app)
                .get('/api/settings/backup/list')
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Mixed-Files', 'true')
                .expect(200);

            // Should not include files from outside backup directory
            response.body.forEach(backup => {
                expect(backup.filename).to.not.include('..');
                expect(backup.filename).to.not.include('/');
                expect(backup.filename).to.not.include('\\');
            });
        });
    });

    describe('Performance Considerations', () => {
        beforeEach(() => {
            process.env.ADMIN_ENABLED = 'true';
        });

        afterEach(() => {
            delete process.env.ADMIN_ENABLED;
        });

        it('should support pagination for large backup lists', async () => {
            const response = await request(app)
                .get('/api/settings/backup/list')
                .query({ limit: 10, offset: 0 })
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Many-Files', '100')
                .expect(200);

            expect(response.body).to.be.an('array');
            expect(response.body.length).to.be.at.most(10);

            // If pagination is implemented, should include pagination metadata
            if (response.body.length === 10) {
                // Optional pagination metadata
                const headers = response.headers;
                if (headers['x-total-count']) {
                    expect(parseInt(headers['x-total-count'])).to.be.greaterThan(10);
                }
            }
        });

        it('should respond quickly even with many backup files', async () => {
            const startTime = Date.now();
            const response = await request(app)
                .get('/api/settings/backup/list')
                .set('X-Admin-Auth', 'true')
                .set('X-Mock-Many-Files', '1000')
                .expect(200);

            const responseTime = Date.now() - startTime;
            expect(responseTime).to.be.lessThan(5000); // Should respond within 5 seconds
        });
    });
});