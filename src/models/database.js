/**
 * Database Service Factory
 * Switches between SQLite and PostgreSQL based on environment configuration
 * Maintains backward compatibility with existing interface
 */

const { PostgreSQLDatabaseService } = require('./postgresql-database');

class Database {
    constructor() {
        this.service = null;
        this.initialized = false;
    }

    async initialize() {
        console.log('🔄 Initializing database service...');

        // Check database type from environment
        const dbType = process.env.DATABASE_TYPE || 'sqlite';

        if (dbType === 'postgresql') {
            console.log('📊 Using PostgreSQL database service');
            this.service = new PostgreSQLDatabaseService();
        } else {
            // Fallback to SQLite (original implementation)
            console.log('📊 Using SQLite database service (fallback)');
            const SQLiteService = require('./database-sqlite-backup');
            this.service = new SQLiteService();
        }

        await this.service.initialize();
        this.initialized = true;
        console.log('✅ Database service initialized successfully');
    }

    // Proxy all methods to the underlying service
    // This maintains exact interface compatibility

    async getAllReports() {
        return await this.service.getAllReports();
    }

    async getRecentReports(limit = 5) {
        if (this.service.getRecentReports) {
            return await this.service.getRecentReports(limit);
        }

        const reports = await this.getAllReports();
        return reports.slice(0, limit);
    }

    async getReportById(id) {
        return await this.service.getReportById(id);
    }

    async insertReport(filenameOrData, vulnerabilityCount, awsAccountId, reportRunDate = null, fileSize = null, status = 'PROCESSING', errorMessage = null) {
        if (this.service.insertReport) {
            if (filenameOrData && typeof filenameOrData === 'object' && !Array.isArray(filenameOrData)) {
                return await this.service.insertReport(filenameOrData);
            }

            const payload = {
                filename: filenameOrData,
                vulnerabilityCount: vulnerabilityCount ?? 0,
                awsAccountId: awsAccountId || null,
                reportRunDate: reportRunDate || null,
                fileSize: fileSize ?? null,
                status: status ?? 'PROCESSING',
                errorMessage: errorMessage ?? null
            };

            return await this.service.insertReport(payload);
        }

        throw new Error('insertReport not supported by current database service');
    }

    async updateReport(id, updates) {
        return await this.service.updateReport(id, updates);
    }

    async deleteReport(id) {
        return await this.service.deleteReport(id);
    }

    async getVulnerabilities(filters = {}, includeRelated = true, pagination = {}) {
        return await this.service.getVulnerabilities(filters, includeRelated, pagination);
    }

    async getVulnerabilitiesCount(filters = {}) {
        if (this.service.getVulnerabilitiesCount) {
            return await this.service.getVulnerabilitiesCount(filters);
        }
        // Fallback for SQLite: get all vulnerabilities and count them
        const vulnerabilities = await this.service.getVulnerabilities(filters);
        return vulnerabilities.length;
    }

    async getFilterOptions() {
        if (this.service.getFilterOptions) {
            return await this.service.getFilterOptions();
        }

        const vulnerabilities = await this.getVulnerabilities();
        const options = {
            statuses: new Set(),
            severities: new Set(),
            resourceTypes: new Set(),
            platforms: new Set(),
            awsAccountIds: new Set()
        };

        for (const vuln of vulnerabilities) {
            if (vuln.status) options.statuses.add(vuln.status);
            if (vuln.severity) options.severities.add(vuln.severity);
            if (vuln.resource_type) options.resourceTypes.add(vuln.resource_type);
            if (vuln.platform) options.platforms.add(vuln.platform);
            if (vuln.aws_account_id) options.awsAccountIds.add(vuln.aws_account_id);
        }

        return {
            statuses: Array.from(options.statuses),
            severities: Array.from(options.severities),
            resourceTypes: Array.from(options.resourceTypes),
            platforms: Array.from(options.platforms),
            awsAccountIds: Array.from(options.awsAccountIds)
        };
    }

    async getVulnerabilityById(id) {
        return await this.service.getVulnerabilityById(id);
    }

    async getVulnerabilitiesByIds(ids = []) {
        if (this.service.getVulnerabilitiesByIds) {
            return await this.service.getVulnerabilitiesByIds(ids);
        }

        if (!Array.isArray(ids) || ids.length === 0) {
            return [];
        }

        const allVulnerabilities = await this.getVulnerabilities();
        const idSet = new Set(ids.map(id => Number(id)));
        return allVulnerabilities.filter(vuln => idSet.has(Number(vuln.id)));
    }

    async getVulnerabilitiesGroupedByCVE(filters = {}) {
        if (this.service.getVulnerabilitiesGroupedByCVE) {
            return await this.service.getVulnerabilitiesGroupedByCVE(filters);
        }

        // Simple fallback: group in application memory
        const vulnerabilities = await this.getVulnerabilities(filters);
        const groups = {};

        for (const vuln of vulnerabilities) {
            const key = vuln.cve_id || vuln.vulnerability_id || 'UNKNOWN';
            if (!groups[key]) {
                groups[key] = {
                    cve_id: key,
                    vulnerabilities: []
                };
            }
            groups[key].vulnerabilities.push(vuln);
        }

        return Object.values(groups);
    }

    async getFixedVulnerabilities(filters = {}) {
        if (this.service.getFixedVulnerabilities) {
            return await this.service.getFixedVulnerabilities(filters);
        }

        return [];
    }

    async getVulnerabilityTimeline(findingArn) {
        if (this.service.getVulnerabilityTimeline) {
            return await this.service.getVulnerabilityTimeline(findingArn);
        }

        return {
            findingArn,
            current: null,
            history: []
        };
    }

    async insertVulnerability(reportId, vulnerability) {
        if (!this.service.insertVulnerability) {
            throw new Error('insertVulnerability not supported by current database service');
        }

        if (this.service.insertVulnerability.length >= 2) {
            return await this.service.insertVulnerability(reportId, vulnerability);
        }

        return await this.service.insertVulnerability({ reportId, vulnerability });
    }

    async insertResource(vulnerabilityId, resource) {
        if (this.service.insertResource) {
            return await this.service.insertResource(vulnerabilityId, resource);
        }

        throw new Error('insertResource not supported by current database service');
    }

    async insertPackage(vulnerabilityId, pkg) {
        if (this.service.insertPackage) {
            return await this.service.insertPackage(vulnerabilityId, pkg);
        }

        throw new Error('insertPackage not supported by current database service');
    }

    async insertReference(vulnerabilityId, url) {
        if (this.service.insertReference) {
            return await this.service.insertReference(vulnerabilityId, url);
        }

        throw new Error('insertReference not supported by current database service');
    }

    async insertVulnerabilities(vulnArray) {
        if (this.service.insertVulnerabilities) {
            return await this.service.insertVulnerabilities(vulnArray);
        } else {
            // Fallback for SQLite: insert one by one
            const ids = [];
            for (const vuln of vulnArray) {
                const id = await this.service.insertVulnerability(vuln);
                ids.push(id);
            }
            return ids;
        }
    }

    async updateVulnerability(id, updates) {
        return await this.service.updateVulnerability(id, updates);
    }

    async deleteVulnerability(id) {
        return await this.service.deleteVulnerability(id);
    }

    async archiveVulnerabilities(vulnerabilityIds) {
        if (this.service.archiveVulnerabilities) {
            return await this.service.archiveVulnerabilities(vulnerabilityIds);
        } else {
            // Fallback implementation for SQLite
            console.warn('Archive functionality not available in SQLite mode');
            return 0;
        }
    }

    async clearCurrentTables() {
        if (this.service.clearCurrentTables) {
            return await this.service.clearCurrentTables();
        }

        throw new Error('clearCurrentTables not supported by current database service');
    }

    async beginTransaction() {
        if (this.service.beginTransaction) {
            return await this.service.beginTransaction();
        }

        console.warn('beginTransaction not supported by current database service; operations will run without explicit transaction');
        return null;
    }

    async commitTransaction() {
        if (this.service.commitTransaction) {
            return await this.service.commitTransaction();
        }

        console.warn('commitTransaction not supported by current database service; assuming auto-commit');
        return null;
    }

    async rollbackTransaction() {
        if (this.service.rollbackTransaction) {
            return await this.service.rollbackTransaction();
        }

        console.warn('rollbackTransaction not supported by current database service; nothing to rollback');
        return null;
    }

    async createUploadEvent(filename) {
        if (this.service.createUploadEvent) {
            return await this.service.createUploadEvent(filename);
        }

        throw new Error('createUploadEvent not supported by current database service');
    }

    async updateUploadEvent(uploadId, status, metadata = {}) {
        if (this.service.updateUploadEvent) {
            return await this.service.updateUploadEvent(uploadId, status, metadata);
        }

        throw new Error('updateUploadEvent not supported by current database service');
    }

    async getUploadEvents(filters = {}) {
        if (this.service.getUploadEvents) {
            return await this.service.getUploadEvents(filters);
        }

        return [];
    }

    async getSummary(filters = {}) {
        if (this.service.getSummary) {
            return await this.service.getSummary(filters);
        }

        const summary = {
            total: 0,
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            active: 0,
            fixed: 0,
            fixable: 0
        };

        const vulnerabilities = await this.getVulnerabilities(filters);

        for (const vuln of vulnerabilities) {
            summary.total += 1;

            switch ((vuln.severity || '').toUpperCase()) {
                case 'CRITICAL':
                    summary.critical += 1;
                    break;
                case 'HIGH':
                    summary.high += 1;
                    break;
                case 'MEDIUM':
                    summary.medium += 1;
                    break;
                case 'LOW':
                    summary.low += 1;
                    break;
                default:
                    break;
            }

            const status = (vuln.status || '').toUpperCase();
            if (status === 'ACTIVE' || !status) {
                summary.active += 1;
            }
            if (status === 'FIXED') {
                summary.fixed += 1;
            }

            if ((vuln.fix_available || '').toUpperCase() === 'YES') {
                summary.fixable += 1;
            }
        }

        return summary;
    }

    // Settings operations (new for PostgreSQL)
    async getAllSettings() {
        if (this.service.getAllSettings) {
            return await this.service.getAllSettings();
        } else {
            return [];
        }
    }

    async getSettingByKey(key) {
        if (this.service.getSettingByKey) {
            return await this.service.getSettingByKey(key);
        } else {
            return null;
        }
    }

    async updateSetting(key, value, type = 'string') {
        if (this.service.updateSetting) {
            return await this.service.updateSetting(key, value, type);
        } else {
            return false;
        }
    }

    async insertSetting(settingData) {
        if (this.service.insertSetting) {
            return await this.service.insertSetting(settingData);
        } else {
            return 0;
        }
    }

    async deleteSetting(key) {
        if (this.service.deleteSetting) {
            return await this.service.deleteSetting(key);
        } else {
            return false;
        }
    }

    // Advanced query operations
    async getVulnerabilityStatistics() {
        if (this.service.getVulnerabilityStatistics) {
            return await this.service.getVulnerabilityStatistics();
        } else {
            // Fallback implementation
            const vulns = await this.service.getVulnerabilities();
            return {
                total: vulns.length,
                critical: vulns.filter(v => v.severity === 'CRITICAL').length,
                high: vulns.filter(v => v.severity === 'HIGH').length,
                medium: vulns.filter(v => v.severity === 'MEDIUM').length,
                low: vulns.filter(v => v.severity === 'LOW').length,
                active: vulns.filter(v => v.status === 'ACTIVE' || !v.status).length,
                fixed: vulns.filter(v => v.status === 'FIXED').length
            };
        }
    }

    async getHistoricalTrends(timeRange) {
        if (this.service.getHistoricalTrends) {
            return await this.service.getHistoricalTrends(timeRange);
        } else {
            return [];
        }
    }

    async searchVulnerabilities(searchTerm, filters = {}) {
        if (this.service.searchVulnerabilities) {
            return await this.service.searchVulnerabilities(searchTerm, filters);
        } else {
            // Simple fallback search
            const vulns = await this.service.getVulnerabilities(filters);
            return vulns.filter(v =>
                v.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                v.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                v.package_name?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
    }

    // Health and monitoring
    async healthCheck() {
        if (this.service.healthCheck) {
            return await this.service.healthCheck();
        } else {
            return { healthy: true, service: 'sqlite' };
        }
    }

    getPoolStats() {
        if (this.service.getPoolStats) {
            return this.service.getPoolStats();
        } else {
            return null;
        }
    }

    // Transaction support
    async executeTransaction(callback) {
        if (this.service.executeTransaction) {
            return await this.service.executeTransaction(callback);
        } else {
            // Simple fallback: execute without transaction for SQLite
            return await callback(this.service);
        }
    }

    // Raw query access
    async query(text, params = []) {
        if (this.service.query) {
            return await this.service.query(text, params);
        } else {
            throw new Error('Raw query not supported in SQLite mode');
        }
    }

    // Schema validation
    async validateSchema() {
        if (this.service.validateSchema) {
            return await this.service.validateSchema();
        } else {
            return { tables: { found: 0, missing: [] } };
        }
    }

    // Graceful shutdown
    async close() {
        if (this.service && this.service.close) {
            await this.service.close();
        }
        this.initialized = false;
    }

    // Compatibility methods for existing code
    isConnected() {
        if (this.service && this.service.isConnected) {
            return this.service.isConnected();
        }
        return this.initialized;
    }

    // Legacy SQLite methods (for backward compatibility)
    async run(query, params = []) {
        if (this.service.run) {
            return await this.service.run(query, params);
        } else if (this.service.query) {
            const result = await this.service.query(query, params);
            return {
                changes: result.rowCount || 0,
                lastID: result.rows?.[0]?.id || null
            };
        }
        throw new Error('Run method not supported');
    }

    async all(query, params = []) {
        if (this.service.all) {
            return await this.service.all(query, params);
        } else if (this.service.query) {
            const result = await this.service.query(query, params);
            return result.rows || [];
        }
        throw new Error('All method not supported');
    }

    async get(query, params = []) {
        if (this.service.get) {
            return await this.service.get(query, params);
        } else if (this.service.query) {
            const result = await this.service.query(query, params);
            return result.rows?.[0] || null;
        }
        throw new Error('Get method not supported');
    }

    // Settings & Database Management Methods
    async getConnectionInfo() {
        if (this.service.getConnectionInfo) {
            return await this.service.getConnectionInfo();
        }
        return {
            version: 'Unknown',
            connectionCount: 0
        };
    }

    async getTableCounts() {
        if (this.service.getTableCounts) {
            return await this.service.getTableCounts();
        }
        return {};
    }

    async clearDatabase() {
        if (this.service.clearDatabase) {
            return await this.service.clearDatabase();
        }
        throw new Error('Clear database method not supported');
    }

    async clearAllData() {
        if (this.service.clearAllData) {
            return await this.service.clearAllData();
        }
        throw new Error('Clear all data method not supported');
    }

    // Query method for direct database access (used by SettingsService)
    async query(text, params = []) {
        if (this.service.query) {
            return await this.service.query(text, params);
        }
        throw new Error('Direct query method not supported');
    }
}

module.exports = Database;
