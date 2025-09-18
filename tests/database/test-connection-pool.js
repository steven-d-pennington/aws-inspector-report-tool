/**
 * Connection Pool Test
 * TDD: This test MUST FAIL initially
 */

const { expect } = require('chai');
const { PostgreSQLDatabaseService } = require('../../src/models/postgresql-database');

describe('Connection Pool Tests', function() {
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

    it('should manage connection pool statistics', async function() {
        const stats = dbService.getPoolStats();
        expect(stats.maxCount).to.equal(20);
        expect(stats.isConnected).to.be.true;
    });

    it('should handle multiple concurrent connections', async function() {
        const queries = Array(15).fill(null).map(() =>
            dbService.query('SELECT 1 as test')
        );

        const results = await Promise.all(queries);
        expect(results).to.have.length(15);
        results.forEach(result => {
            expect(result.rows[0].test).to.equal(1);
        });
    });
});