/**
 * Database Service Facade
 * Provides a single entry point for database interactions backed by PostgreSQL.
 */

const { PostgreSQLDatabaseService } = require('./postgresql-database');

class Database {
    constructor() {
        this.service = new PostgreSQLDatabaseService();
        this.initialized = false;
    }

    async initialize() {
        if (!this.initialized) {
            console.log('🔄 Initializing PostgreSQL database service...');
            await this.service.initialize();
            this.initialized = true;
            console.log('✅ PostgreSQL database service initialized successfully');
        }
        return this;
    }

    ensureInitialized() {
        if (!this.initialized) {
            throw new Error('Database service has not been initialized');
        }
    }

    async call(method, ...args) {
        this.ensureInitialized();
        if (typeof this.service[method] !== 'function') {
            throw new Error(`${method} is not implemented by the PostgreSQL service`);
        }
        return await this.service[method](...args);
    }

    callSync(method, ...args) {
        this.ensureInitialized();
        if (typeof this.service[method] !== 'function') {
            throw new Error(`${method} is not implemented by the PostgreSQL service`);
        }
        return this.service[method](...args);
    }

    // Report operations
    async getAllReports() { return await this.call('getAllReports'); }
    async getRecentReports(limit = 5) { return await this.call('getRecentReports', limit); }
    async getReportById(id) { return await this.call('getReportById', id); }
    async insertReport(...args) { return await this.call('insertReport', ...args); }
    async updateReport(id, updates) { return await this.call('updateReport', id, updates); }
    async deleteReport(id) { return await this.call('deleteReport', id); }

    // Vulnerability operations
    async getVulnerabilities(filters = {}, includeRelated = true, pagination = {}) {
        return await this.call('getVulnerabilities', filters, includeRelated, pagination);
    }
    async getVulnerabilitiesCount(filters = {}) { return await this.call('getVulnerabilitiesCount', filters); }
    async getFilterOptions() { return await this.call('getFilterOptions'); }
    async getVulnerabilityById(id) { return await this.call('getVulnerabilityById', id); }
    async getVulnerabilitiesByIds(ids = []) { return await this.call('getVulnerabilitiesByIds', ids); }
    async getVulnerabilitiesGroupedByCVE(filters = {}) { return await this.call('getVulnerabilitiesGroupedByCVE', filters); }
    async getFixedVulnerabilities(filters = {}) { return await this.call('getFixedVulnerabilities', filters); }
    async getVulnerabilityTimeline(findingArn) { return await this.call('getVulnerabilityTimeline', findingArn); }
    async insertVulnerability(...args) { return await this.call('insertVulnerability', ...args); }
    async insertResource(...args) { return await this.call('insertResource', ...args); }
    async insertPackage(...args) { return await this.call('insertPackage', ...args); }
    async insertReference(...args) { return await this.call('insertReference', ...args); }
    async insertVulnerabilities(vulnArray) { return await this.call('insertVulnerabilities', vulnArray); }
    async updateVulnerability(id, updates) { return await this.call('updateVulnerability', id, updates); }
    async deleteVulnerability(id) { return await this.call('deleteVulnerability', id); }
    async archiveVulnerabilities(vulnerabilityIds) { return await this.call('archiveVulnerabilities', vulnerabilityIds); }

    // Table management
    async clearCurrentTables() { return await this.call('clearCurrentTables'); }
    async beginTransaction() { return await this.call('beginTransaction'); }
    async commitTransaction() { return await this.call('commitTransaction'); }
    async rollbackTransaction() { return await this.call('rollbackTransaction'); }

    // Upload tracking
    async createUploadEvent(filename) { return await this.call('createUploadEvent', filename); }
    async updateUploadEvent(uploadId, status, metadata = {}) {
        return await this.call('updateUploadEvent', uploadId, status, metadata);
    }
    async getUploadEvents(filters = {}) { return await this.call('getUploadEvents', filters); }

    // Summaries and analytics
    async getSummary(filters = {}) { return await this.call('getSummary', filters); }
    async getVulnerabilityStatistics() { return await this.call('getVulnerabilityStatistics'); }
    async getHistoricalTrends(timeRange) { return await this.call('getHistoricalTrends', timeRange); }
    async searchVulnerabilities(searchTerm, filters = {}) {
        return await this.call('searchVulnerabilities', searchTerm, filters);
    }

    // Health and monitoring
    async healthCheck() { return await this.call('healthCheck'); }
    getPoolStats() { return this.callSync('getPoolStats'); }
    isConnected() { return this.callSync('isConnected'); }

    // Transaction helper
    async executeTransaction(callback) { return await this.call('executeTransaction', callback); }

    // Raw query access
    async query(text, params = []) { return await this.call('query', text, params); }

    // Schema validation
    async validateSchema() { return await this.call('validateSchema'); }

    // Settings & management
    async getAllSettings() { return await this.call('getAllSettings'); }
    async getSettingByKey(key) { return await this.call('getSettingByKey', key); }
    async updateSetting(key, value, type = 'string') {
        return await this.call('updateSetting', key, value, type);
    }
    async insertSetting(settingData) { return await this.call('insertSetting', settingData); }
    async deleteSetting(key) { return await this.call('deleteSetting', key); }
    async getConnectionInfo() { return await this.call('getConnectionInfo'); }
    async getTableCounts() { return await this.call('getTableCounts'); }
    async clearDatabase() { return await this.call('clearDatabase'); }
    async clearAllData() { return await this.call('clearAllData'); }

    async close() {
        if (this.initialized) {
            await this.service.close();
            this.initialized = false;
        }
    }
}

module.exports = Database;
