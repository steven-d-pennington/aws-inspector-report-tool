/**
 * Constraint Validation Test
 * TDD: This test MUST FAIL initially
 */

const { expect } = require('chai');
const { PostgreSQLDatabaseService } = require('../../src/models/postgresql-database');

describe('Constraint Validation Tests', function() {
    this.timeout(10000);

    let dbService;

    beforeEach(async function() {
        dbService = new PostgreSQLDatabaseService();
        await dbService.initialize();
    });

    afterEach(async function() {
        if (dbService && dbService.close) {
            await dbService.close();
        }
    });

    it('should enforce severity constraints', async function() {
        try {
            await dbService.query(
                "INSERT INTO vulnerabilities (report_id, title, severity) VALUES (1, 'Test', 'INVALID')"
            );
            expect.fail('Should have rejected invalid severity');
        } catch (error) {
            expect(error.message).to.include('severity');
        }
    });

    it('should enforce foreign key constraints', async function() {
        try {
            await dbService.query(
                "INSERT INTO vulnerabilities (report_id, title, severity) VALUES (99999, 'Test', 'HIGH')"
            );
            expect.fail('Should have rejected invalid foreign key');
        } catch (error) {
            expect(error.message).to.match(/foreign key|violates/i);
        }
    });

    it('should enforce unique constraints', async function() {
        await dbService.query("INSERT INTO settings (key, value) VALUES ('test_unique', 'value1')");

        try {
            await dbService.query("INSERT INTO settings (key, value) VALUES ('test_unique', 'value2')");
            expect.fail('Should have rejected duplicate key');
        } catch (error) {
            expect(error.message).to.include('unique');
        }
    });
});