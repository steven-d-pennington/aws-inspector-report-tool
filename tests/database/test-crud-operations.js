/**
 * CRUD Operations Test
 * TDD: This test MUST FAIL initially - no CRUD operations exist yet
 */

const { expect } = require('chai');
const { PostgreSQLDatabaseService } = require('../../src/models/postgresql-database');

describe('PostgreSQL CRUD Operations Tests', function() {
    this.timeout(10000);

    let dbService;

    beforeEach(async function() {
        // This will fail - PostgreSQL service doesn't exist yet
        dbService = new PostgreSQLDatabaseService();
        await dbService.initialize();
    });

    afterEach(async function() {
        if (dbService && dbService.close) {
            await dbService.close();
        }
    });

    describe('Reports CRUD', function() {
        it('should create a new report', async function() {
            // This test MUST fail initially
            const reportData = {
                filename: 'test-report.json',
                file_size: 1024,
                status: 'PROCESSED'
            };

            const reportId = await dbService.insertReport(reportData);
            expect(reportId).to.be.a('number');
            expect(reportId).to.be.greaterThan(0);
        });

        it('should retrieve all reports', async function() {
            // This test MUST fail initially
            const reports = await dbService.getAllReports();
            expect(reports).to.be.an('array');
        });

        it('should retrieve report by ID', async function() {
            // This test MUST fail initially
            const reportData = {
                filename: 'test-report-2.json',
                file_size: 2048
            };

            const reportId = await dbService.insertReport(reportData);
            const report = await dbService.getReportById(reportId);

            expect(report).to.not.be.null;
            expect(report.filename).to.equal('test-report-2.json');
            expect(report.file_size).to.equal(2048);
        });

        it('should update report', async function() {
            // This test MUST fail initially
            const reportData = { filename: 'update-test.json' };
            const reportId = await dbService.insertReport(reportData);

            const updated = await dbService.updateReport(reportId, {
                vulnerabilities_count: 5,
                status: 'PROCESSED'
            });

            expect(updated).to.be.true;

            const report = await dbService.getReportById(reportId);
            expect(report.vulnerabilities_count).to.equal(5);
            expect(report.status).to.equal('PROCESSED');
        });

        it('should delete report', async function() {
            // This test MUST fail initially
            const reportData = { filename: 'delete-test.json' };
            const reportId = await dbService.insertReport(reportData);

            const deleted = await dbService.deleteReport(reportId);
            expect(deleted).to.be.true;

            const report = await dbService.getReportById(reportId);
            expect(report).to.be.null;
        });
    });

    describe('Vulnerabilities CRUD', function() {
        let testReportId;

        beforeEach(async function() {
            // Create a test report for vulnerabilities
            testReportId = await dbService.insertReport({
                filename: 'vuln-test.json'
            });
        });

        it('should create vulnerabilities', async function() {
            // This test MUST fail initially
            const vulnData = {
                report_id: testReportId,
                title: 'Test Vulnerability',
                severity: 'HIGH',
                package_name: 'test-package',
                package_version: '1.0.0'
            };

            const vulnId = await dbService.insertVulnerability(vulnData);
            expect(vulnId).to.be.a('number');
            expect(vulnId).to.be.greaterThan(0);
        });

        it('should retrieve vulnerabilities with filters', async function() {
            // This test MUST fail initially
            const filters = {
                severity: 'HIGH',
                limit: 10,
                offset: 0
            };

            const vulnerabilities = await dbService.getVulnerabilities(filters);
            expect(vulnerabilities).to.be.an('array');
        });

        it('should bulk insert vulnerabilities', async function() {
            // This test MUST fail initially
            const vulnArray = [
                {
                    report_id: testReportId,
                    title: 'Bulk Test 1',
                    severity: 'MEDIUM'
                },
                {
                    report_id: testReportId,
                    title: 'Bulk Test 2',
                    severity: 'LOW'
                }
            ];

            const vulnIds = await dbService.insertVulnerabilities(vulnArray);
            expect(vulnIds).to.be.an('array');
            expect(vulnIds).to.have.length(2);
        });

        it('should archive vulnerabilities', async function() {
            // This test MUST fail initially
            const vulnData = {
                report_id: testReportId,
                title: 'Archive Test',
                severity: 'HIGH'
            };

            const vulnId = await dbService.insertVulnerability(vulnData);
            const archivedCount = await dbService.archiveVulnerabilities([vulnId]);

            expect(archivedCount).to.equal(1);

            // Check that it's in history table
            const history = await dbService.query(
                'SELECT * FROM vulnerability_history WHERE original_vulnerability_id = $1',
                [vulnId]
            );
            expect(history.rows).to.have.length(1);
        });
    });
});