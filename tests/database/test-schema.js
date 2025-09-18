/**
 * Schema Validation Test
 * TDD: This test MUST FAIL initially - no PostgreSQL service implementation exists yet
 */

const { expect } = require('chai');
const { PostgreSQLDatabaseService } = require('../../src/models/postgresql-database');

describe('PostgreSQL Schema Validation Tests', function() {
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

    it('should validate all required tables exist', async function() {
        // This test MUST fail initially
        const result = await dbService.validateSchema();

        expect(result.tables.found).to.equal(9);
        expect(result.tables.missing).to.be.empty;

        const expectedTables = [
            'reports', 'vulnerabilities', 'resources', 'packages',
            'references', 'settings', 'vulnerability_history',
            'resource_history', 'upload_events'
        ];

        for (const table of expectedTables) {
            const exists = await dbService.tableExists(table);
            expect(exists).to.be.true;
        }
    });

    it('should validate indexes are created', async function() {
        // This test MUST fail initially
        const indexes = await dbService.getTableIndexes('vulnerabilities');

        expect(indexes).to.include('idx_vulnerabilities_severity');
        expect(indexes).to.include('idx_vulnerabilities_status');
        expect(indexes).to.include('idx_vulnerabilities_report_id');
    });

    it('should validate foreign key constraints', async function() {
        // This test MUST fail initially
        const constraints = await dbService.getForeignKeyConstraints();

        expect(constraints).to.include('fk_vulnerabilities_report_id');
        expect(constraints).to.include('fk_resources_vulnerability_id');
        expect(constraints).to.include('fk_packages_vulnerability_id');
    });

    it('should validate check constraints', async function() {
        // This test MUST fail initially
        try {
            await dbService.query(`
                INSERT INTO vulnerabilities (report_id, title, severity)
                VALUES (1, 'Test', 'INVALID_SEVERITY')
            `);
            expect.fail('Should have rejected invalid severity');
        } catch (error) {
            expect(error.message).to.include('severity');
        }
    });

    it('should validate settings table schema', async function() {
        // This test MUST fail initially
        const tableInfo = await dbService.getTableInfo('settings');

        expect(tableInfo.columns).to.include('key');
        expect(tableInfo.columns).to.include('value');
        expect(tableInfo.columns).to.include('type');
        expect(tableInfo.columns).to.include('created_at');
        expect(tableInfo.columns).to.include('updated_at');

        // Check unique constraint on key
        expect(tableInfo.uniqueConstraints).to.include('settings_key_key');
    });
});