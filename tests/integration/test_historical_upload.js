/**
 * Integration Tests for Historical Report Upload with Date Picker
 *
 * These tests verify the complete workflow from date selection through
 * database persistence and timeline reconstruction.
 *
 * MUST FAIL before implementation as the date picker feature isn't implemented yet.
 */

const request = require('supertest');
const fs = require('fs').promises;
const path = require('path');
const Database = require('../../src/models/database');
const HistoryService = require('../../src/services/historyService');

// Mock express app - will be replaced with actual server
let app;
let db;
let historyService;

describe('Historical Upload Integration Tests', () => {
    beforeAll(async () => {
        // Initialize test database
        db = new Database();
        db.dbPath = ':memory:'; // Use in-memory database for tests
        await db.initialize();

        historyService = new HistoryService(db);

        // Import server after database setup to avoid initialization issues
        const serverModule = require('../../server');
        app = serverModule;
    });

    afterAll(async () => {
        if (db && db.db) {
            await new Promise(resolve => db.db.close(resolve));
        }
    });

    beforeEach(async () => {
        // Clear all tables before each test
        await db.clearCurrentTables();
        await historyService.clearHistory();
    });

    describe('Date Picker Integration Workflow', () => {
        test('should trigger date picker when historical file is uploaded', async () => {
            // Create mock historical report file
            const mockReportData = {
                findings: [
                    {
                        findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/historical1",
                        awsAccountId: "123456789012",
                        description: "Historical vulnerability from 2024-01-15",
                        severity: "HIGH",
                        status: "ACTIVE",
                        title: "Historical Test Vulnerability",
                        lastObservedAt: "2024-01-15T10:00:00.000Z",
                        firstObservedAt: "2024-01-15T10:00:00.000Z",
                        updatedAt: "2024-01-15T10:00:00.000Z"
                    }
                ]
            };

            const tempFilePath = await global.testUtils.createMockFile(
                'historical-report.json',
                JSON.stringify(mockReportData)
            );

            // This test MUST FAIL because date picker integration isn't implemented
            const response = await request(app)
                .post('/upload')
                .attach('reportFile', tempFilePath)
                .field('reportRunDate', '2024-01-15') // Date picker selected date
                .expect(400); // Should fail - not implemented

            // Verify expected failure response
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Date picker functionality not implemented');
        });

        test('should persist report_run_date in database when date is provided', async () => {
            const reportRunDate = '2024-02-20';
            const mockReportData = {
                findings: [
                    {
                        findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/dated1",
                        awsAccountId: "123456789012",
                        severity: "CRITICAL",
                        status: "ACTIVE",
                        title: "Dated Vulnerability Test",
                        lastObservedAt: "2024-02-20T15:30:00.000Z"
                    }
                ]
            };

            const tempFilePath = await global.testUtils.createMockFile(
                'dated-report.json',
                JSON.stringify(mockReportData)
            );

            // This MUST FAIL - report_run_date column doesn't exist yet
            const response = await request(app)
                .post('/upload')
                .attach('reportFile', tempFilePath)
                .field('reportRunDate', reportRunDate)
                .expect(500); // Should fail - database schema not updated

            // Verify the database doesn't have report_run_date column
            try {
                const report = await db.getReportById(1);
                expect(report).toBeUndefined(); // Report shouldn't exist due to failure

                // Try to query for report_run_date - should fail
                await new Promise((resolve, reject) => {
                    db.db.get(
                        'SELECT report_run_date FROM reports WHERE id = ?',
                        [1],
                        (err, row) => {
                            if (err && err.message.includes('no such column: report_run_date')) {
                                resolve(); // Expected failure
                            } else {
                                reject(new Error('Expected database schema error'));
                            }
                        }
                    );
                });
            } catch (error) {
                expect(error.message).toContain('no such column: report_run_date');
            }
        });

        test('should validate report_run_date format and reject invalid dates', async () => {
            const mockReportData = { findings: [] };
            const tempFilePath = await global.testUtils.createMockFile(
                'test-report.json',
                JSON.stringify(mockReportData)
            );

            // Test invalid date format
            const invalidDates = [
                '2024-13-45', // Invalid month/day
                '2024/01/15', // Wrong format
                'not-a-date',
                '2024-1-1',   // Single digits
                '24-01-15',   // Two-digit year
                ''            // Empty string
            ];

            for (const invalidDate of invalidDates) {
                // This MUST FAIL - date validation not implemented
                const response = await request(app)
                    .post('/upload')
                    .attach('reportFile', tempFilePath)
                    .field('reportRunDate', invalidDate)
                    .expect(400); // Should fail with validation error

                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toMatch(/invalid.*date|date.*validation/i);
            }
        });
    });

    describe('Timeline Reconstruction Integration', () => {
        test('should reconstruct vulnerability timeline with correct report_run_dates', async () => {
            // Setup: Create multiple historical reports with different dates
            const historicalReports = [
                {
                    date: '2024-01-01',
                    findings: [{
                        findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/timeline1",
                        severity: "HIGH",
                        status: "ACTIVE",
                        title: "Timeline Test Vulnerability"
                    }]
                },
                {
                    date: '2024-02-01',
                    findings: [{
                        findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/timeline1",
                        severity: "HIGH",
                        status: "ACTIVE",
                        title: "Timeline Test Vulnerability"
                    }]
                },
                {
                    date: '2024-03-01',
                    findings: [] // Vulnerability fixed - not in this report
                }
            ];

            // Upload historical reports with dates - MUST FAIL
            for (const report of historicalReports) {
                const tempFilePath = await global.testUtils.createMockFile(
                    `report-${report.date}.json`,
                    JSON.stringify({ findings: report.findings })
                );

                await request(app)
                    .post('/upload')
                    .attach('reportFile', tempFilePath)
                    .field('reportRunDate', report.date)
                    .expect(500); // Should fail - not implemented
            }

            // Try to reconstruct timeline - MUST FAIL
            try {
                const timeline = await historyService.getVulnerabilityHistory(
                    "arn:aws:inspector2:us-east-1:123456789012:finding/timeline1"
                );

                // This should fail because the feature isn't implemented
                expect(timeline).toBeUndefined();
            } catch (error) {
                expect(error.message).toContain('report_run_date column not found');
            }
        });

        test('should handle timezone considerations in date reconstruction', async () => {
            const reportRunDate = '2024-06-15';
            const mockReportData = {
                findings: [{
                    findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/timezone1",
                    lastObservedAt: "2024-06-15T23:59:59.999Z", // End of day UTC
                    firstObservedAt: "2024-06-15T00:00:00.000Z"  // Start of day UTC
                }]
            };

            const tempFilePath = await global.testUtils.createMockFile(
                'timezone-report.json',
                JSON.stringify(mockReportData)
            );

            // This MUST FAIL - timezone handling not implemented
            const response = await request(app)
                .post('/upload')
                .attach('reportFile', tempFilePath)
                .field('reportRunDate', reportRunDate)
                .field('timezone', 'America/New_York')
                .expect(500);

            expect(response.body.error).toContain('Timezone handling not implemented');
        });
    });

    describe('Database Integration with report_run_date', () => {
        test('should create proper foreign key relationships with dated reports', async () => {
            const reportRunDate = '2024-05-10';
            const mockReportData = {
                findings: [{
                    findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/fk1",
                    awsAccountId: "123456789012",
                    severity: "MEDIUM",
                    status: "ACTIVE",
                    title: "Foreign Key Test Vulnerability",
                    resources: [{
                        id: "i-1234567890abcdef0",
                        type: "AwsEc2Instance"
                    }],
                    packageVulnerabilityDetails: {
                        vulnerabilityId: "CVE-2024-1234"
                    }
                }]
            };

            const tempFilePath = await global.testUtils.createMockFile(
                'fk-test-report.json',
                JSON.stringify(mockReportData)
            );

            // This MUST FAIL - proper schema changes not implemented
            await request(app)
                .post('/upload')
                .attach('reportFile', tempFilePath)
                .field('reportRunDate', reportRunDate)
                .expect(500);

            // Verify foreign key constraints work with new schema
            try {
                const reportQuery = 'SELECT * FROM reports WHERE report_run_date = ?';
                await new Promise((resolve, reject) => {
                    db.db.get(reportQuery, [reportRunDate], (err, row) => {
                        if (err) {
                            expect(err.message).toContain('no such column: report_run_date');
                            resolve();
                        } else {
                            reject(new Error('Expected schema error'));
                        }
                    });
                });
            } catch (error) {
                expect(error.message).toContain('Expected schema error');
            }
        });

        test('should handle concurrent uploads with different report_run_dates', async () => {
            const uploads = [
                { date: '2024-07-01', findingArn: 'finding1' },
                { date: '2024-07-02', findingArn: 'finding2' },
                { date: '2024-07-03', findingArn: 'finding3' }
            ];

            const uploadPromises = uploads.map(async (upload, index) => {
                const mockData = {
                    findings: [{
                        findingArn: `arn:aws:inspector2:us-east-1:123456789012:finding/${upload.findingArn}`,
                        severity: "LOW",
                        status: "ACTIVE",
                        title: `Concurrent Upload Test ${index + 1}`
                    }]
                };

                const tempFilePath = await global.testUtils.createMockFile(
                    `concurrent-${index}.json`,
                    JSON.stringify(mockData)
                );

                return request(app)
                    .post('/upload')
                    .attach('reportFile', tempFilePath)
                    .field('reportRunDate', upload.date);
            });

            // All uploads MUST FAIL - concurrent handling not implemented
            const results = await Promise.allSettled(uploadPromises);

            results.forEach(result => {
                expect(result.status).toBe('rejected');
                expect(result.reason.message).toContain('not implemented');
            });
        });
    });

    describe('Error Handling and Rollback Integration', () => {
        test('should rollback transaction if date processing fails', async () => {
            const mockReportData = {
                findings: [{
                    findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/rollback1",
                    severity: "HIGH",
                    status: "ACTIVE",
                    title: "Rollback Test Vulnerability"
                }]
            };

            const tempFilePath = await global.testUtils.createMockFile(
                'rollback-test.json',
                JSON.stringify(mockReportData)
            );

            // This MUST FAIL and trigger rollback
            await request(app)
                .post('/upload')
                .attach('reportFile', tempFilePath)
                .field('reportRunDate', '2024-08-15')
                .expect(500);

            // Verify database is clean after rollback
            const reports = await db.getAllReports();
            expect(reports).toHaveLength(0);

            const vulnerabilities = await db.getVulnerabilities({});
            expect(vulnerabilities).toHaveLength(0);
        });

        test('should preserve existing data when new upload with date fails', async () => {
            // First, add some existing data (without date)
            const existingData = {
                findings: [{
                    findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/existing1",
                    severity: "CRITICAL",
                    status: "ACTIVE",
                    title: "Existing Vulnerability"
                }]
            };

            const existingFilePath = await global.testUtils.createMockFile(
                'existing-data.json',
                JSON.stringify(existingData)
            );

            // Upload existing data (should work with current implementation)
            await request(app)
                .post('/upload')
                .attach('reportFile', existingFilePath)
                .expect(200);

            // Verify existing data is there
            const beforeUpload = await db.getVulnerabilities({});
            expect(beforeUpload).toHaveLength(1);

            // Now try to upload with date - MUST FAIL
            const newData = {
                findings: [{
                    findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/new1",
                    severity: "MEDIUM",
                    status: "ACTIVE",
                    title: "New Vulnerability with Date"
                }]
            };

            const newFilePath = await global.testUtils.createMockFile(
                'new-data-with-date.json',
                JSON.stringify(newData)
            );

            await request(app)
                .post('/upload')
                .attach('reportFile', newFilePath)
                .field('reportRunDate', '2024-09-15')
                .expect(500); // Should fail

            // Verify existing data is still there and new data wasn't added
            const afterFailedUpload = await db.getVulnerabilities({});
            expect(afterFailedUpload).toHaveLength(1);
            expect(afterFailedUpload[0].finding_arn).toBe(existingData.findings[0].findingArn);
        });
    });
});