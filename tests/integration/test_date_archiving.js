/**
 * Integration Tests for Date Archiving with report_run_date Preservation
 *
 * These tests verify that report_run_date is properly preserved when
 * vulnerabilities are archived to the history table.
 *
 * MUST FAIL before implementation as the date archiving feature isn't implemented yet.
 */

const request = require('supertest');
const fs = require('fs').promises;
const path = require('path');
const Database = require('../../src/models/database');
const HistoryService = require('../../src/services/historyService');
// Note: ReportService is exported as object, not class
const reportService = require('../../src/services/reportService');

let app;
let db;
let historyService;
// reportService is now imported directly

describe('Date Archiving Integration Tests', () => {
    beforeAll(async () => {
        // Initialize test database
        db = new Database();
        db.dbPath = ':memory:'; // Use in-memory database for tests
        await db.initialize();

        historyService = new HistoryService(db);
        // reportService is module export, initialize if needed
        if (reportService.initialize) {
            reportService.initialize(db);
        }

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
        await historyService.clearHistory();
    });

    describe('report_run_date Preservation in Archives', () => {
        test('should preserve report_run_date when archiving vulnerabilities', async () => {
            const reportRunDate = '2024-03-15';

            // First upload with specific date - MUST FAIL due to missing implementation
            const firstReportData = {
                findings: [{
                    findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/archive1",
                    awsAccountId: "123456789012",
                    severity: "HIGH",
                    status: "ACTIVE",
                    title: "Archival Test Vulnerability",
                    lastObservedAt: "2024-03-15T10:00:00.000Z",
                    resources: [{
                        id: "i-1234567890abcdef0",
                        type: "AwsEc2Instance"
                    }]
                }]
            };

            const firstFilePath = await global.testUtils.createMockFile(
                'first-report.json',
                JSON.stringify(firstReportData)
            );

            // This upload MUST FAIL - report_run_date not implemented
            const firstResponse = await request(app)
                .post('/upload')
                .attach('reportFile', firstFilePath)
                .field('reportRunDate', reportRunDate)
                .expect(500);

            expect(firstResponse.body.error).toContain('report_run_date column does not exist');

            // Try to verify archiving behavior - MUST FAIL
            try {
                const archivedData = await historyService.getArchivedVulnerabilities({
                    reportRunDate: reportRunDate
                });
                expect(archivedData).toBeUndefined(); // Should fail
            } catch (error) {
                expect(error.message).toContain('report_run_date not implemented in history table');
            }
        });

        test('should maintain date integrity across multiple archive cycles', async () => {
            const dates = ['2024-01-01', '2024-02-01', '2024-03-01'];
            const vulnerabilityArn = "arn:aws:inspector2:us-east-1:123456789012:finding/multiarch1";

            // Upload multiple reports over time - all MUST FAIL
            for (let i = 0; i < dates.length; i++) {
                const reportData = {
                    findings: i < 2 ? [{
                        findingArn: vulnerabilityArn,
                        awsAccountId: "123456789012",
                        severity: "MEDIUM",
                        status: "ACTIVE",
                        title: `Multi-Archive Test ${i + 1}`,
                        lastObservedAt: `${dates[i]}T12:00:00.000Z`
                    }] : [] // Empty in third report (vulnerability fixed)
                };

                const filePath = await global.testUtils.createMockFile(
                    `multi-arch-${i}.json`,
                    JSON.stringify(reportData)
                );

                // Each upload MUST FAIL - date archiving not implemented
                await request(app)
                    .post('/upload')
                    .attach('reportFile', filePath)
                    .field('reportRunDate', dates[i])
                    .expect(500);
            }

            // Try to retrieve timeline - MUST FAIL
            try {
                const timeline = await historyService.getVulnerabilityHistory(vulnerabilityArn);
                expect(timeline).toBeUndefined();
            } catch (error) {
                expect(error.message).toContain('Timeline reconstruction requires report_run_date column');
            }
        });

        test('should handle date conflicts in archive table', async () => {
            const conflictDate = '2024-04-15';

            // Create two different reports with same date - edge case
            const reportData1 = {
                findings: [{
                    findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/conflict1",
                    severity: "HIGH",
                    status: "ACTIVE",
                    title: "Conflict Test 1"
                }]
            };

            const reportData2 = {
                findings: [{
                    findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/conflict2",
                    severity: "CRITICAL",
                    status: "ACTIVE",
                    title: "Conflict Test 2"
                }]
            };

            const file1Path = await global.testUtils.createMockFile(
                'conflict1.json',
                JSON.stringify(reportData1)
            );

            const file2Path = await global.testUtils.createMockFile(
                'conflict2.json',
                JSON.stringify(reportData2)
            );

            // Both uploads MUST FAIL - conflict handling not implemented
            await request(app)
                .post('/upload')
                .attach('reportFile', file1Path)
                .field('reportRunDate', conflictDate)
                .expect(500);

            await request(app)
                .post('/upload')
                .attach('reportFile', file2Path)
                .field('reportRunDate', conflictDate)
                .expect(500);

            // Verify conflict detection in archive table - MUST FAIL
            try {
                const conflicts = await historyService.detectDateConflicts(conflictDate);
                expect(conflicts).toBeUndefined();
            } catch (error) {
                expect(error.message).toContain('Date conflict detection not implemented');
            }
        });
    });

    describe('History Table Schema Integration', () => {
        test('should include report_run_date in vulnerability_history table schema', async () => {
            // Try to query history table schema - MUST FAIL
            try {
                await new Promise((resolve, reject) => {
                    db.db.get(
                        "PRAGMA table_info(vulnerability_history)",
                        (err, result) => {
                            if (err) {
                                reject(err);
                            } else {
                                // Check if report_run_date column exists
                                const hasReportRunDate = result && result.some
                                    ? result.some(col => col.name === 'report_run_date')
                                    : false;

                                if (!hasReportRunDate) {
                                    reject(new Error('report_run_date column missing from vulnerability_history table'));
                                } else {
                                    resolve(result);
                                }
                            }
                        }
                    );
                });
            } catch (error) {
                expect(error.message).toContain('report_run_date column missing');
            }
        });

        test('should properly index report_run_date for timeline queries', async () => {
            // Check for proper indexing - MUST FAIL
            try {
                await new Promise((resolve, reject) => {
                    db.db.get(
                        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_vulnerability_history_report_run_date'",
                        (err, result) => {
                            if (err) {
                                reject(err);
                            } else if (!result) {
                                reject(new Error('report_run_date index not found'));
                            } else {
                                resolve(result);
                            }
                        }
                    );
                });
            } catch (error) {
                expect(error.message).toContain('report_run_date index not found');
            }
        });

        test('should enforce data types and constraints on report_run_date', async () => {
            // Test data type enforcement - MUST FAIL
            try {
                await new Promise((resolve, reject) => {
                    // Try to insert invalid date into history table
                    db.db.run(
                        `INSERT INTO vulnerability_history
                         (finding_arn, report_run_date, archived_at)
                         VALUES (?, ?, ?)`,
                        ['test-arn', 'invalid-date', new Date().toISOString()],
                        (err) => {
                            if (err) {
                                // Should fail due to missing table or column
                                expect(err.message).toContain('no such table: vulnerability_history');
                                resolve();
                            } else {
                                reject(new Error('Expected table/column error'));
                            }
                        }
                    );
                });
            } catch (error) {
                expect(error.message).toContain('Expected table/column error');
            }
        });
    });

    describe('Archive Metadata Preservation', () => {
        test('should preserve all vulnerability metadata during date-aware archiving', async () => {
            const reportRunDate = '2024-05-20';
            const complexVulnerability = {
                findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/complex1",
                awsAccountId: "123456789012",
                vulnerability_id: "CVE-2024-5678",
                title: "Complex Vulnerability for Archiving",
                description: "Detailed description with special characters: <script>alert('xss')</script>",
                severity: "CRITICAL",
                status: "ACTIVE",
                inspector_score: 8.5,
                epss_score: 0.95,
                exploit_available: "YES",
                fix_available: "YES",
                first_observed_at: "2024-05-15T08:00:00.000Z",
                last_observed_at: "2024-05-20T16:30:00.000Z",
                updated_at: "2024-05-20T16:30:00.000Z",
                resources: [{
                    id: "i-1234567890abcdef0",
                    type: "AwsEc2Instance",
                    region: "us-east-1",
                    platform: "Amazon Linux 2",
                    tags: JSON.stringify({"Environment": "production", "Team": "security"})
                }],
                packages: [{
                    name: "openssl",
                    version: "1.0.2k",
                    fixed_version: "1.0.2ze",
                    package_manager: "yum",
                    file_path: "/usr/bin/openssl"
                }],
                references: [
                    "https://nvd.nist.gov/vuln/detail/CVE-2024-5678",
                    "https://security.example.com/advisory/2024-5678"
                ]
            };

            const reportData = { findings: [complexVulnerability] };
            const filePath = await global.testUtils.createMockFile(
                'complex-vulnerability.json',
                JSON.stringify(reportData)
            );

            // Upload with date - MUST FAIL
            await request(app)
                .post('/upload')
                .attach('reportFile', filePath)
                .field('reportRunDate', reportRunDate)
                .expect(500);

            // Try to verify metadata preservation - MUST FAIL
            try {
                const archivedVuln = await historyService.getArchivedVulnerability(
                    complexVulnerability.findingArn,
                    reportRunDate
                );
                expect(archivedVuln).toBeUndefined();
            } catch (error) {
                expect(error.message).toContain('Archived vulnerability retrieval not implemented');
            }
        });

        test('should handle large datasets during date-aware archiving', async () => {
            const reportRunDate = '2024-06-01';
            const largeDataset = {
                findings: []
            };

            // Generate 1000 vulnerabilities for stress testing
            for (let i = 0; i < 1000; i++) {
                largeDataset.findings.push({
                    findingArn: `arn:aws:inspector2:us-east-1:123456789012:finding/large${i}`,
                    awsAccountId: "123456789012",
                    severity: ["CRITICAL", "HIGH", "MEDIUM", "LOW"][i % 4],
                    status: "ACTIVE",
                    title: `Large Dataset Vulnerability ${i}`,
                    lastObservedAt: `2024-06-01T${String(i % 24).padStart(2, '0')}:00:00.000Z`
                });
            }

            const filePath = await global.testUtils.createMockFile(
                'large-dataset.json',
                JSON.stringify(largeDataset)
            );

            // Upload large dataset with date - MUST FAIL
            const response = await request(app)
                .post('/upload')
                .attach('reportFile', filePath)
                .field('reportRunDate', reportRunDate)
                .expect(500);

            expect(response.body.error).toContain('Bulk archiving with dates not implemented');

            // Verify no partial data was inserted
            const currentVulns = await db.getVulnerabilities({});
            expect(currentVulns).toHaveLength(0);
        });
    });

    describe('Archive Query Integration', () => {
        test('should support date-range queries on archived data', async () => {
            // Try to query archived data by date range - MUST FAIL
            try {
                const dateRangeResults = await historyService.getArchivedVulnerabilities({
                    reportRunDateFrom: '2024-01-01',
                    reportRunDateTo: '2024-12-31'
                });
                expect(dateRangeResults).toBeUndefined();
            } catch (error) {
                expect(error.message).toContain('Date range queries on archives not implemented');
            }
        });

        test('should support vulnerability lifecycle reconstruction', async () => {
            const vulnerabilityArn = "arn:aws:inspector2:us-east-1:123456789012:finding/lifecycle1";

            // Try to get complete lifecycle - MUST FAIL
            try {
                const lifecycle = await historyService.getVulnerabilityLifecycle(vulnerabilityArn);
                expect(lifecycle).toBeUndefined();
            } catch (error) {
                expect(error.message).toContain('Vulnerability lifecycle reconstruction not implemented');
            }
        });

        test('should support cross-date vulnerability analytics', async () => {
            // Try analytics across dates - MUST FAIL
            try {
                const analytics = await historyService.getCrossDateAnalytics({
                    startDate: '2024-01-01',
                    endDate: '2024-06-01',
                    groupBy: 'month'
                });
                expect(analytics).toBeUndefined();
            } catch (error) {
                expect(error.message).toContain('Cross-date analytics not implemented');
            }
        });
    });
});