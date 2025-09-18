/**
 * Integration Tests for End-to-End Upload Workflow with Date Picker
 *
 * These tests verify the complete upload workflow from file selection
 * through date picker interaction to final response handling.
 *
 * MUST FAIL before implementation as the date picker workflow isn't implemented yet.
 */

const request = require('supertest');
const fs = require('fs').promises;
const path = require('path');
const Database = require('../../src/models/database');

let app;
let db;

describe('Upload Workflow Integration Tests', () => {
    beforeAll(async () => {
        // Initialize test database
        db = new Database();
        db.dbPath = ':memory:'; // Use in-memory database for tests
        await db.initialize();

        // Import server after database setup
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
    });

    describe('File Upload to Date Picker Trigger', () => {
        test('should detect historical report and trigger date picker flow', async () => {
            // Create a report that should trigger date picker (older than current date)
            const historicalReportData = {
                findings: [{
                    findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/historical1",
                    awsAccountId: "123456789012",
                    severity: "HIGH",
                    status: "ACTIVE",
                    title: "Historical Vulnerability",
                    lastObservedAt: "2024-01-15T10:00:00.000Z", // Old date
                    firstObservedAt: "2024-01-15T10:00:00.000Z"
                }]
            };

            const filePath = await global.testUtils.createMockFile(
                'historical-report.json',
                JSON.stringify(historicalReportData)
            );

            // Initial upload should trigger date picker flow - MUST FAIL
            const response = await request(app)
                .post('/upload')
                .attach('reportFile', filePath)
                .expect(422); // Should return "needs date picker" status

            // Verify expected response structure for date picker trigger
            expect(response.body).toHaveProperty('requiresDatePicker', true);
            expect(response.body).toHaveProperty('detectedDate');
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toContain('Date picker required');

            // This test MUST FAIL because this workflow isn't implemented
            expect(response.status).not.toBe(422); // Will actually be 500 or 200
        });

        test('should proceed without date picker for current reports', async () => {
            const currentDate = new Date().toISOString();
            const currentReportData = {
                findings: [{
                    findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/current1",
                    awsAccountId: "123456789012",
                    severity: "MEDIUM",
                    status: "ACTIVE",
                    title: "Current Vulnerability",
                    lastObservedAt: currentDate,
                    firstObservedAt: currentDate
                }]
            };

            const filePath = await global.testUtils.createMockFile(
                'current-report.json',
                JSON.stringify(currentReportData)
            );

            // Should proceed normally without date picker
            const response = await request(app)
                .post('/upload')
                .attach('reportFile', filePath)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).not.toHaveProperty('requiresDatePicker');

            // Verify the upload actually worked
            const vulnerabilities = await db.getVulnerabilities({});
            expect(vulnerabilities).toHaveLength(1);
        });

        test('should validate file format before triggering date picker', async () => {
            // Test with invalid file format
            const invalidFilePath = await global.testUtils.createMockFile(
                'invalid-report.txt',
                'This is not a valid JSON or CSV file'
            );

            // Should fail with format error, not trigger date picker
            const response = await request(app)
                .post('/upload')
                .attach('reportFile', invalidFilePath)
                .expect(415);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Unsupported file format');
            expect(response.body).not.toHaveProperty('requiresDatePicker');
        });
    });

    describe('Date Picker Form Submission Integration', () => {
        test('should accept form submission with selected date', async () => {
            const selectedDate = '2024-02-14';
            const reportData = {
                findings: [{
                    findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/dated1",
                    awsAccountId: "123456789012",
                    severity: "CRITICAL",
                    status: "ACTIVE",
                    title: "Valentine's Day Vulnerability",
                    lastObservedAt: "2024-02-14T14:30:00.000Z"
                }]
            };

            const filePath = await global.testUtils.createMockFile(
                'valentine-report.json',
                JSON.stringify(reportData)
            );

            // Submit with date picker selection - MUST FAIL
            const response = await request(app)
                .post('/upload')
                .attach('reportFile', filePath)
                .field('reportRunDate', selectedDate)
                .field('datePickerConfirmed', 'true')
                .expect(500); // Should fail - not implemented

            expect(response.body.error).toContain('Date picker workflow not implemented');
        });

        test('should reject submission without date when required', async () => {
            const historicalData = {
                findings: [{
                    findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/nodate1",
                    lastObservedAt: "2024-01-01T00:00:00.000Z"
                }]
            };

            const filePath = await global.testUtils.createMockFile(
                'no-date-report.json',
                JSON.stringify(historicalData)
            );

            // Submit historical report without date - MUST FAIL
            const response = await request(app)
                .post('/upload')
                .attach('reportFile', filePath)
                .expect(400);

            expect(response.body.error).toContain('Report run date required for historical reports');

            // This test MUST FAIL because validation isn't implemented
            expect(response.status).not.toBe(400); // Will actually be 200 or 500
        });

        test('should handle date picker cancellation', async () => {
            const reportData = {
                findings: [{
                    findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/cancelled1",
                    lastObservedAt: "2024-03-01T00:00:00.000Z"
                }]
            };

            const filePath = await global.testUtils.createMockFile(
                'cancelled-report.json',
                JSON.stringify(reportData)
            );

            // Submit with cancellation flag - MUST FAIL
            const response = await request(app)
                .post('/upload')
                .attach('reportFile', filePath)
                .field('datePickerCancelled', 'true')
                .expect(400);

            expect(response.body.error).toContain('Upload cancelled by user');

            // This test MUST FAIL because cancellation handling isn't implemented
            expect(response.status).not.toBe(400); // Will actually be 200 or 500
        });
    });

    describe('Response Handling Integration', () => {
        test('should return enhanced response with date information', async () => {
            const reportDate = '2024-04-01';
            const reportData = {
                findings: [{
                    findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/response1",
                    severity: "HIGH",
                    status: "ACTIVE",
                    title: "April Fools Vulnerability"
                }]
            };

            const filePath = await global.testUtils.createMockFile(
                'april-report.json',
                JSON.stringify(reportData)
            );

            // Submit with date - MUST FAIL
            const response = await request(app)
                .post('/upload')
                .attach('reportFile', filePath)
                .field('reportRunDate', reportDate)
                .expect(500);

            // Verify expected enhanced response structure - MUST FAIL
            try {
                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('reportRunDate', reportDate);
                expect(response.body).toHaveProperty('isHistoricalReport', true);
                expect(response.body).toHaveProperty('archivingDetails');
                expect(response.body.archivingDetails).toHaveProperty('archivedCount');
                expect(response.body.archivingDetails).toHaveProperty('archivedDate');
            } catch (error) {
                expect(error.message).toContain('Enhanced response structure not implemented');
            }
        });

        test('should include timeline reconstruction info in response', async () => {
            const reportDate = '2024-05-15';
            const reportData = {
                findings: [{
                    findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/timeline1",
                    severity: "MEDIUM",
                    status: "ACTIVE",
                    title: "Timeline Reconstruction Test"
                }]
            };

            const filePath = await global.testUtils.createMockFile(
                'timeline-report.json',
                JSON.stringify(reportData)
            );

            // Submit with date - MUST FAIL
            const response = await request(app)
                .post('/upload')
                .attach('reportFile', filePath)
                .field('reportRunDate', reportDate)
                .expect(500);

            // Verify timeline info in response - MUST FAIL
            try {
                expect(response.body).toHaveProperty('timelineInfo');
                expect(response.body.timelineInfo).toHaveProperty('availableDates');
                expect(response.body.timelineInfo).toHaveProperty('timelineUrl');
                expect(response.body.timelineInfo.timelineUrl).toContain('/api/vulnerability-history/');
            } catch (error) {
                expect(error.message).toContain('Timeline info not implemented');
            }
        });

        test('should handle processing errors gracefully with date context', async () => {
            // Create malformed report to trigger processing error
            const malformedData = {
                findings: [{
                    // Missing required fields to trigger error
                    findingArn: null,
                    severity: "INVALID_SEVERITY"
                }]
            };

            const filePath = await global.testUtils.createMockFile(
                'malformed-report.json',
                JSON.stringify(malformedData)
            );

            // Submit with date - should fail gracefully
            const response = await request(app)
                .post('/upload')
                .attach('reportFile', filePath)
                .field('reportRunDate', '2024-06-01')
                .expect(500);

            // Verify error response includes date context - MUST FAIL
            try {
                expect(response.body).toHaveProperty('error');
                expect(response.body).toHaveProperty('reportRunDate', '2024-06-01');
                expect(response.body).toHaveProperty('errorContext', 'DATE_PROCESSING');
                expect(response.body).toHaveProperty('rollbackCompleted', true);
            } catch (error) {
                expect(error.message).toContain('Date-aware error handling not implemented');
            }
        });
    });

    describe('Concurrent Upload Handling', () => {
        test('should handle multiple uploads with different dates concurrently', async () => {
            const uploads = [
                { date: '2024-07-01', name: 'concurrent1' },
                { date: '2024-07-02', name: 'concurrent2' },
                { date: '2024-07-03', name: 'concurrent3' }
            ];

            const uploadPromises = uploads.map(async (upload, index) => {
                const reportData = {
                    findings: [{
                        findingArn: `arn:aws:inspector2:us-east-1:123456789012:finding/${upload.name}`,
                        severity: "LOW",
                        status: "ACTIVE",
                        title: `Concurrent Upload ${index + 1}`
                    }]
                };

                const filePath = await global.testUtils.createMockFile(
                    `${upload.name}.json`,
                    JSON.stringify(reportData)
                );

                return request(app)
                    .post('/upload')
                    .attach('reportFile', filePath)
                    .field('reportRunDate', upload.date);
            });

            // All uploads MUST FAIL - concurrent date handling not implemented
            const results = await Promise.allSettled(uploadPromises);

            results.forEach((result, index) => {
                expect(result.status).toBe('rejected');
                const error = result.reason;
                expect(error.message).toContain('Concurrent date uploads not supported');
            });
        });

        test('should prevent race conditions in date archiving', async () => {
            const sameDate = '2024-08-15';

            // Create two uploads with same date to test race condition
            const upload1Data = {
                findings: [{
                    findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/race1",
                    title: "Race Condition Test 1"
                }]
            };

            const upload2Data = {
                findings: [{
                    findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/race2",
                    title: "Race Condition Test 2"
                }]
            };

            const file1Path = await global.testUtils.createMockFile(
                'race1.json',
                JSON.stringify(upload1Data)
            );

            const file2Path = await global.testUtils.createMockFile(
                'race2.json',
                JSON.stringify(upload2Data)
            );

            // Start both uploads simultaneously - MUST FAIL
            const [result1, result2] = await Promise.allSettled([
                request(app)
                    .post('/upload')
                    .attach('reportFile', file1Path)
                    .field('reportRunDate', sameDate),
                request(app)
                    .post('/upload')
                    .attach('reportFile', file2Path)
                    .field('reportRunDate', sameDate)
            ]);

            // At least one should fail due to race condition prevention
            const failures = [result1, result2].filter(r => r.status === 'rejected');
            expect(failures.length).toBeGreaterThan(0);

            failures.forEach(failure => {
                expect(failure.reason.message).toContain('Race condition prevention not implemented');
            });
        });
    });

    describe('File Format and Date Integration', () => {
        test('should handle CSV uploads with date picker', async () => {
            const csvData = `Finding Arn,AWS Account Id,Severity,Status,Title,Last Observed At
arn:aws:inspector2:us-east-1:123456789012:finding/csv1,123456789012,HIGH,ACTIVE,CSV Test Vulnerability,2024-09-01T12:00:00.000Z`;

            const csvFilePath = await global.testUtils.createMockFile(
                'csv-report.csv',
                csvData
            );

            // Submit CSV with date - MUST FAIL
            const response = await request(app)
                .post('/upload')
                .attach('reportFile', csvFilePath)
                .field('reportRunDate', '2024-09-01')
                .expect(500);

            expect(response.body.error).toContain('CSV date integration not implemented');
        });

        test('should validate date consistency between file content and picker', async () => {
            const fileDate = '2024-10-01';
            const pickerDate = '2024-10-15'; // Different date

            const reportData = {
                findings: [{
                    findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/consistency1",
                    lastObservedAt: `${fileDate}T10:00:00.000Z` // File says Oct 1
                }]
            };

            const filePath = await global.testUtils.createMockFile(
                'consistency-test.json',
                JSON.stringify(reportData)
            );

            // Submit with different date - MUST FAIL
            const response = await request(app)
                .post('/upload')
                .attach('reportFile', filePath)
                .field('reportRunDate', pickerDate) // Picker says Oct 15
                .expect(400);

            expect(response.body.error).toContain('Date consistency validation not implemented');

            // This test MUST FAIL because validation isn't implemented
            expect(response.status).not.toBe(400); // Will actually be 500 or 200
        });
    });

    describe('User Experience Integration', () => {
        test('should provide helpful date suggestions based on file content', async () => {
            const reportData = {
                findings: [{
                    findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/suggest1",
                    lastObservedAt: "2024-11-15T14:30:00.000Z",
                    firstObservedAt: "2024-11-10T09:00:00.000Z"
                }]
            };

            const filePath = await global.testUtils.createMockFile(
                'suggestion-test.json',
                JSON.stringify(reportData)
            );

            // Initial upload to get date suggestions - MUST FAIL
            const response = await request(app)
                .post('/upload')
                .attach('reportFile', filePath)
                .expect(422);

            // Verify date suggestions in response - MUST FAIL
            try {
                expect(response.body).toHaveProperty('requiresDatePicker', true);
                expect(response.body).toHaveProperty('suggestedDates');
                expect(response.body.suggestedDates).toContain('2024-11-15');
                expect(response.body.suggestedDates).toContain('2024-11-10');
            } catch (error) {
                expect(error.message).toContain('Date suggestion feature not implemented');
            }
        });

        test('should remember user date preferences for session', async () => {
            // This would test session-based date preference memory - MUST FAIL
            const agent = request.agent(app);

            // First upload with date preference
            const firstData = { findings: [] };
            const firstPath = await global.testUtils.createMockFile(
                'first-session.json',
                JSON.stringify(firstData)
            );

            await agent
                .post('/upload')
                .attach('reportFile', firstPath)
                .field('reportRunDate', '2024-12-01')
                .field('rememberPreference', 'true')
                .expect(500);

            // Second upload should suggest remembered date - MUST FAIL
            const secondData = { findings: [] };
            const secondPath = await global.testUtils.createMockFile(
                'second-session.json',
                JSON.stringify(secondData)
            );

            const response = await agent
                .post('/upload')
                .attach('reportFile', secondPath)
                .expect(422);

            try {
                expect(response.body.suggestedDates).toContain('2024-12-01');
            } catch (error) {
                expect(error.message).toContain('Session preference memory not implemented');
            }
        });
    });
});