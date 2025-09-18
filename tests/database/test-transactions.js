/**
 * Transaction Handling Test
 * TDD: This test MUST FAIL initially
 */

const { expect } = require('chai');
const { PostgreSQLDatabaseService } = require('../../src/models/postgresql-database');

describe('Transaction Tests', function() {
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

    it('should commit successful transactions', async function() {
        const result = await dbService.executeTransaction(async (client) => {
            const reportResult = await client.query(
                "INSERT INTO reports (filename) VALUES ('transaction-test.json') RETURNING id"
            );
            return reportResult.rows[0].id;
        });

        expect(result).to.be.a('number');

        const report = await dbService.getReportById(result);
        expect(report).to.not.be.null;
    });

    it('should rollback failed transactions', async function() {
        const initialCount = await dbService.query('SELECT COUNT(*) FROM reports');

        try {
            await dbService.executeTransaction(async (client) => {
                await client.query("INSERT INTO reports (filename) VALUES ('rollback-test.json')");
                throw new Error('Intentional failure');
            });
        } catch (error) {
            expect(error.message).to.equal('Intentional failure');
        }

        const finalCount = await dbService.query('SELECT COUNT(*) FROM reports');
        expect(finalCount.rows[0].count).to.equal(initialCount.rows[0].count);
    });
});