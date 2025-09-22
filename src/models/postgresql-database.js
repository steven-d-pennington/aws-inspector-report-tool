/**
 * PostgreSQL Database Service Implementation
 * Provides the concrete implementation for the database facade
 */

const { randomUUID } = require('crypto');
const { getPool } = require('../config/database-pool');

class PostgreSQLDatabaseService {
    constructor() {
        this.pool = null;
        this.transactionClient = null;
        this.initialized = false;
    }

    async initialize() {
        this.pool = await getPool();
        this.initialized = true;
        return this;
    }

    isConnected() {
        return this.initialized && !!this.pool && this.pool.isConnected;
    }

    getPoolStats() {
        if (!this.pool || !this.pool.getPoolStats) {
            return null;
        }
        return this.pool.getPoolStats();
    }

    async healthCheck() {
        try {
            await this.query('SELECT 1 AS ok');
            return { healthy: true, service: 'postgresql' };
        } catch (error) {
            return { healthy: false, service: 'postgresql', error: error.message };
        }
    }

    async query(text, params = []) {
        if (!this.pool) {
            throw new Error('Database not initialized');
        }

        if (this.transactionClient) {
            return await this.transactionClient.query(text, params);
        }

        return await this.pool.query(text, params);
    }

    async beginTransaction() {
        if (!this.pool) {
            throw new Error('Database not initialized');
        }

        if (this.transactionClient) {
            throw new Error('Transaction already in progress');
        }

        this.transactionClient = await this.pool.getClient();
        await this.transactionClient.query('BEGIN');
    }

    async commitTransaction() {
        if (!this.transactionClient) {
            return;
        }

        try {
            await this.transactionClient.query('COMMIT');
        } finally {
            this.transactionClient.release();
            this.transactionClient = null;
        }
    }

    async rollbackTransaction() {
        if (!this.transactionClient) {
            return;
        }

        try {
            await this.transactionClient.query('ROLLBACK');
        } finally {
            this.transactionClient.release();
            this.transactionClient = null;
        }
    }

    async executeTransaction(callback) {
        await this.beginTransaction();
        try {
            const result = await callback(this.transactionClient);
            await this.commitTransaction();
            return result;
        } catch (error) {
            await this.rollbackTransaction();
            throw error;
        }
    }

    async close() {
        if (this.pool && this.pool.close) {
            await this.pool.close();
        }
        this.transactionClient = null;
        this.pool = null;
        this.initialized = false;
    }

    // ===== Reports =====

    async getAllReports() {
        const result = await this.query(`
            SELECT id, filename, upload_date, report_run_date, file_size,
                   vulnerability_count, aws_account_id, status, error_message
            FROM reports
            ORDER BY upload_date DESC
        `);
        return result.rows;
    }

    async getRecentReports(limit = 5) {
        const result = await this.query(`
            SELECT id, filename, upload_date, report_run_date, file_size,
                   vulnerability_count, aws_account_id, status, error_message
            FROM reports
            ORDER BY upload_date DESC
            LIMIT $1
        `, [limit]);
        return result.rows;
    }

    async getReportById(id) {
        const result = await this.query(`
            SELECT id, filename, upload_date, report_run_date, file_size,
                   vulnerability_count, aws_account_id, status, error_message
            FROM reports
            WHERE id = $1
        `, [id]);
        return result.rows[0] || null;
    }

    async insertReport(reportData, legacyVulnerabilityCount, legacyAwsAccountId, legacyReportRunDate, legacyFileSize, legacyStatus = 'PROCESSING', legacyErrorMessage = null) {
        let normalized = reportData;

        if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
            normalized = {
                filename: typeof reportData === 'string' ? reportData : null,
                vulnerabilityCount: legacyVulnerabilityCount ?? 0,
                awsAccountId: legacyAwsAccountId ?? null,
                reportRunDate: legacyReportRunDate ?? null,
                fileSize: legacyFileSize ?? null,
                status: legacyStatus ?? 'PROCESSING',
                errorMessage: legacyErrorMessage
            };
        }

        const filename = normalized.filename;

        if (!filename) {
            throw new Error('Report filename is required');
        }

        const vulnerabilityCount = normalized.vulnerabilityCount ?? normalized.vulnerability_count ?? 0;
        const awsAccountId = normalized.awsAccountId ?? normalized.aws_account_id ?? null;
        const reportRunDate = normalized.reportRunDate ?? normalized.report_run_date ?? null;
        const fileSize = normalized.fileSize ?? normalized.file_size ?? null;
        const status = normalized.status ?? 'PROCESSING';
        const errorMessage = normalized.errorMessage ?? normalized.error_message ?? null;

        const result = await this.query(`
            INSERT INTO reports (
                filename,
                vulnerability_count,
                aws_account_id,
                report_run_date,
                file_size,
                status,
                error_message
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [
            filename,
            vulnerabilityCount,
            awsAccountId,
            reportRunDate,
            fileSize,
            status,
            errorMessage
        ]);

        return result.rows[0].id;
    }

    async updateReport(id, updates = {}) {
        const allowed = {
            filename: 'filename',
            vulnerabilityCount: 'vulnerability_count',
            vulnerability_count: 'vulnerability_count',
            awsAccountId: 'aws_account_id',
            aws_account_id: 'aws_account_id',
            reportRunDate: 'report_run_date',
            report_run_date: 'report_run_date',
            fileSize: 'file_size',
            file_size: 'file_size',
            status: 'status',
            errorMessage: 'error_message',
            error_message: 'error_message'
        };

        const setClauses = [];
        const params = [];
        let paramIndex = 1;

        for (const [key, column] of Object.entries(allowed)) {
            if (Object.prototype.hasOwnProperty.call(updates, key)) {
                setClauses.push(`${column} = $${paramIndex++}`);
                params.push(updates[key]);
            }
        }

        if (setClauses.length === 0) {
            return false;
        }

        params.push(id);
        const result = await this.query(`
            UPDATE reports
            SET ${setClauses.join(', ')}
            WHERE id = $${paramIndex}
        `, params);

        return result.rowCount > 0;
    }

    async deleteReport(id) {
        const result = await this.query('DELETE FROM reports WHERE id = $1', [id]);
        return result.rowCount > 0;
    }

    // ===== Vulnerabilities =====

    async getVulnerabilities(filters = {}, includeRelated = true, pagination = {}) {
        const conditions = ['1=1'];
        const params = [];
        let paramIndex = 1;

        if (filters.ids && Array.isArray(filters.ids) && filters.ids.length > 0) {
            conditions.push(`v.id = ANY($${paramIndex++}::int[])`);
            params.push(filters.ids.map(Number));
        }

        if (filters.status) {
            conditions.push(`v.status = $${paramIndex++}`);
            params.push(filters.status);
        }

        if (filters.severity) {
            conditions.push(`v.severity = $${paramIndex++}`);
            params.push(filters.severity);
        }

        if (filters.fixAvailable) {
            conditions.push(`v.fix_available = $${paramIndex++}`);
            params.push(filters.fixAvailable);
        }

        if (filters.vulnerabilityId) {
            conditions.push(`v.vulnerability_id ILIKE $${paramIndex++}`);
            params.push(`%${filters.vulnerabilityId}%`);
        }

        if (filters.resourceId) {
            conditions.push(`res.resource_id ILIKE $${paramIndex++}`);
            params.push(`%${filters.resourceId}%`);
        }

        if (filters.awsAccountId) {
            conditions.push(`v.aws_account_id = $${paramIndex++}`);
            params.push(filters.awsAccountId);
        }

        if (filters.resourceType) {
            conditions.push(`res.resource_type = $${paramIndex++}`);
            params.push(filters.resourceType);
        }

        if (filters.platform) {
            conditions.push(`res.platform ILIKE $${paramIndex++}`);
            params.push(`%${filters.platform}%`);
        }

        if (filters.search) {
            conditions.push(`(v.title ILIKE $${paramIndex} OR v.description ILIKE $${paramIndex + 1} OR v.vulnerability_id ILIKE $${paramIndex + 2})`);
            params.push(`%${filters.search}%`);
            params.push(`%${filters.search}%`);
            params.push(`%${filters.search}%`);
            paramIndex += 3;
        }

        if (filters.lastObservedAt) {
            conditions.push(`v.last_observed_at IS NOT NULL AND v.last_observed_at <= $${paramIndex++}`);
            params.push(filters.lastObservedAt);
        }

        // Add pagination if specified
        const { page = 1, limit = 50 } = pagination;
        const offset = (page - 1) * limit;


        const query = `
            SELECT
                v.id,
                v.report_id,
                v.aws_account_id,
                v.finding_arn,
                v.vulnerability_id,
                v.title,
                v.description,
                v.severity,
                v.status,
                v.fix_available,
                v.inspector_score,
                v.epss_score,
                v.exploit_available,
                v.first_observed_at,
                v.last_observed_at,
                v.updated_at,
                v.cvss_score,
                v.cve_id,
                v.package_name,
                v.package_version,
                v.fix_version,
                v.resource_id,
                res.resource_type,
                res.platform,
                res.resource_id AS joined_resource_id,
                res.details AS resource_details,
                res.tags AS resource_tags
            FROM vulnerabilities v
            LEFT JOIN resources res ON res.vulnerability_id = v.id
            WHERE ${conditions.join(' AND ')}
            ORDER BY v.severity DESC, v.inspector_score DESC NULLS LAST, v.id DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        params.push(limit, offset);


        const result = await this.query(query, params);

        const vulnerabilities = [];
        for (const row of result.rows) {
            // Only fetch packages and references if explicitly requested (for performance)
            let packages = [];
            let references = [];

            if (includeRelated) {
                packages = await this.getPackagesByVulnerabilityId(row.id);
                references = await this.getReferencesByVulnerabilityId(row.id);
            }

            // JSONB fields are already parsed by PostgreSQL, no need to JSON.parse()
            const details = row.resource_details || null;
            const tags = row.resource_tags || null;

            vulnerabilities.push({
                ...row,
                resource_id: row.joined_resource_id || row.resource_id,
                details,
                tags,
                packages,
                references
            });
        }

        return vulnerabilities;
    }

    async getVulnerabilitiesCount(filters = {}) {
        const conditions = ['1=1'];
        const params = [];
        let paramIndex = 1;

        if (filters.ids && Array.isArray(filters.ids) && filters.ids.length > 0) {
            conditions.push(`v.id = ANY($${paramIndex++}::int[])`);
            params.push(filters.ids.map(Number));
        }

        if (filters.status) {
            conditions.push(`v.status = $${paramIndex++}`);
            params.push(filters.status);
        }

        if (filters.severity) {
            conditions.push(`v.severity = $${paramIndex++}`);
            params.push(filters.severity);
        }

        if (filters.fixAvailable) {
            conditions.push(`v.fix_available = $${paramIndex++}`);
            params.push(filters.fixAvailable);
        }

        if (filters.resourceType) {
            conditions.push(`res.resource_type = $${paramIndex++}`);
            params.push(filters.resourceType);
        }

        if (filters.platform) {
            conditions.push(`res.platform = $${paramIndex++}`);
            params.push(filters.platform);
        }

        if (filters.vulnerabilityId) {
            conditions.push(`v.vulnerability_id = $${paramIndex++}`);
            params.push(filters.vulnerabilityId);
        }

        if (filters.resourceId) {
            conditions.push(`res.resource_id ILIKE $${paramIndex++}`);
            params.push(`%${filters.resourceId}%`);
        }

        if (filters.search) {
            conditions.push(`(v.title ILIKE $${paramIndex} OR v.description ILIKE $${paramIndex + 1} OR v.vulnerability_id ILIKE $${paramIndex + 2})`);
            params.push(`%${filters.search}%`);
            params.push(`%${filters.search}%`);
            params.push(`%${filters.search}%`);
            paramIndex += 3;
        }

        if (filters.lastObservedAt) {
            conditions.push(`v.last_observed_at IS NOT NULL AND v.last_observed_at <= $${paramIndex++}`);
            params.push(filters.lastObservedAt);
        }

        const result = await this.query(`
            SELECT COUNT(DISTINCT v.id) as total
            FROM vulnerabilities v
            LEFT JOIN resources res ON res.vulnerability_id = v.id
            WHERE ${conditions.join(' AND ')}
        `, params);

        return parseInt(result.rows[0].total);
    }

    async getVulnerabilityById(id) {
        const results = await this.getVulnerabilities({ ids: [id] });
        return results[0] || null;
    }

    async getVulnerabilitiesByIds(ids = []) {
        if (!Array.isArray(ids) || ids.length === 0) {
            return [];
        }
        return await this.getVulnerabilities({ ids });
    }

    async getVulnerabilitiesGroupedByCVE(filters = {}) {
        const vulnerabilities = await this.getVulnerabilities(filters);
        const groups = new Map();

        for (const vuln of vulnerabilities) {
            const key = vuln.cve_id || vuln.vulnerability_id || 'UNKNOWN';
            if (!groups.has(key)) {
                groups.set(key, {
                    cve_id: key,
                    vulnerabilities: []
                });
            }
            groups.get(key).vulnerabilities.push(vuln);
        }

        return Array.from(groups.values());
    }

    async insertVulnerability(reportId, vulnerability) {
        const epssScore = vulnerability.epss ? vulnerability.epss.score : null;
        const packageDetails = vulnerability.packageVulnerabilityDetails || {};
        const primaryPackage = Array.isArray(packageDetails.vulnerablePackages) && packageDetails.vulnerablePackages.length > 0
            ? packageDetails.vulnerablePackages[0]
            : null;

        const result = await this.query(`
            INSERT INTO vulnerabilities (
                report_id,
                aws_account_id,
                finding_arn,
                vulnerability_id,
                title,
                description,
                severity,
                status,
                fix_available,
                inspector_score,
                epss_score,
                exploit_available,
                first_observed_at,
                last_observed_at,
                updated_at,
                cvss_score,
                cve_id,
                package_name,
                package_version,
                fix_version,
                resource_id
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21
            )
            RETURNING id
        `, [
            reportId,
            vulnerability.awsAccountId || null,
            vulnerability.findingArn || null,
            packageDetails.vulnerabilityId || vulnerability.vulnerabilityId || vulnerability.title || null,
            vulnerability.title || null,
            vulnerability.description || null,
            vulnerability.severity || null,
            vulnerability.status || 'ACTIVE',
            vulnerability.fixAvailable || null,
            vulnerability.inspectorScore || null,
            epssScore,
            vulnerability.exploitAvailable || null,
            vulnerability.firstObservedAt || null,
            vulnerability.lastObservedAt || null,
            vulnerability.updatedAt || null,
            vulnerability.cvss?.baseScore || vulnerability.cvssScore || null,
            vulnerability.cveId || packageDetails.cveId || null,
            primaryPackage ? (primaryPackage.packageName || primaryPackage.name || null) : null,
            primaryPackage ? (primaryPackage.packageVersion || primaryPackage.version || null) : null,
            primaryPackage ? (primaryPackage.fixedVersion || primaryPackage.remediation || null) : null,
            vulnerability.resourceId || null
        ]);

        return result.rows[0].id;
    }

    async insertVulnerabilities(vulnArray) {
        if (!Array.isArray(vulnArray) || vulnArray.length === 0) {
            return [];
        }

        const ids = [];
        for (const vuln of vulnArray) {
            const reportId = vuln.reportId ?? vuln.report_id;
            const inserted = await this.insertVulnerability(reportId, vuln);
            ids.push(inserted);
        }
        return ids;
    }

    async insertResource(vulnerabilityId, resource) {
        const details = resource.details ?? null;
        const tags = resource.tags ?? null;
        let platform = null;

        if (details) {
            if (details.awsEc2Instance && details.awsEc2Instance.platform) {
                platform = details.awsEc2Instance.platform;
            } else if (details.awsEcrContainerImage && details.awsEcrContainerImage.platform) {
                platform = details.awsEcrContainerImage.platform;
            }
        }

        await this.query(`
            INSERT INTO resources (
                vulnerability_id,
                resource_id,
                resource_type,
                resource_arn,
                platform,
                region,
                details,
                tags,
                account_id
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9
            )
        `, [
            vulnerabilityId,
            resource.id || resource.resourceId || null,
            resource.type || resource.resourceType || null,
            resource.arn || resource.resourceArn || resource.id || null,
            platform,
            resource.region || null,
            details ? JSON.stringify(details) : null,
            tags ? JSON.stringify(tags) : null,
            resource.accountId || null
        ]);
    }

    async insertPackage(vulnerabilityId, pkg) {
        const fixAvailable = typeof pkg.fixAvailable === 'boolean'
            ? pkg.fixAvailable
            : (pkg.fixAvailable ? String(pkg.fixAvailable).toUpperCase() === 'YES' : null);

        await this.query(`
            INSERT INTO packages (
                vulnerability_id,
                name,
                version,
                ecosystem,
                installed_version,
                fix_available,
                fix_version,
                dependency_path,
                package_manager,
                file_path
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10
            )
        `, [
            vulnerabilityId,
            pkg.packageName || pkg.name || null,
            pkg.packageVersion || pkg.version || null,
            pkg.ecosystem || null,
            pkg.installedVersion || null,
            fixAvailable,
            pkg.fixedVersion || pkg.remediation || null,
            Array.isArray(pkg.paths) ? pkg.paths.join(' -> ') : pkg.dependencyPath || null,
            pkg.packageManager || pkg.manager || null,
            pkg.filePath || null
        ]);
    }

    async insertReference(vulnerabilityId, reference) {
        const ref = typeof reference === 'string' ? { url: reference } : reference;

        await this.query(`
            INSERT INTO "references" (
                vulnerability_id,
                url,
                reference_type,
                source,
                title,
                description
            ) VALUES (
                $1, $2, $3, $4, $5, $6
            )
        `, [
            vulnerabilityId,
            ref.url || null,
            ref.referenceType || ref.type || null,
            ref.source || null,
            ref.title || null,
            ref.description || null
        ]);
    }

    async getPackagesByVulnerabilityId(vulnerabilityId) {
        const result = await this.query(`
            SELECT id, name, version, ecosystem, installed_version, fix_available,
                   fix_version, dependency_path, package_manager, file_path
            FROM packages
            WHERE vulnerability_id = $1
            ORDER BY name ASC
        `, [vulnerabilityId]);
        return result.rows;
    }

    async getReferencesByVulnerabilityId(vulnerabilityId) {
        const result = await this.query(`
            SELECT id, url, reference_type, source, title, description
            FROM "references"
            WHERE vulnerability_id = $1
            ORDER BY id ASC
        `, [vulnerabilityId]);
        return result.rows;
    }

    async getFilterOptions() {
        const options = {
            statuses: [],
            severities: [],
            resourceTypes: [],
            platforms: [],
            awsAccountIds: []
        };

        const statusResult = await this.query(`
            SELECT DISTINCT status FROM vulnerabilities WHERE status IS NOT NULL ORDER BY status
        `);
        options.statuses = statusResult.rows.map(row => row.status);

        const severityResult = await this.query(`
            SELECT DISTINCT severity FROM vulnerabilities WHERE severity IS NOT NULL ORDER BY severity
        `);
        options.severities = severityResult.rows.map(row => row.severity);

        const resourceTypeResult = await this.query(`
            SELECT DISTINCT resource_type FROM resources WHERE resource_type IS NOT NULL ORDER BY resource_type
        `);
        options.resourceTypes = resourceTypeResult.rows.map(row => row.resource_type);

        const platformsResult = await this.query(`
            SELECT DISTINCT platform FROM resources WHERE platform IS NOT NULL ORDER BY platform
        `);
        options.platforms = platformsResult.rows.map(row => row.platform);

        const accountResult = await this.query(`
            SELECT DISTINCT aws_account_id FROM vulnerabilities WHERE aws_account_id IS NOT NULL AND aws_account_id <> '' ORDER BY aws_account_id
        `);
        options.awsAccountIds = accountResult.rows.map(row => row.aws_account_id);

        return options;
    }

    async getSummary(filters = {}) {
        const params = [];
        const conditions = ['1=1'];
        let paramIndex = 1;

        if (filters.awsAccountId) {
            conditions.push(`v.aws_account_id = $${paramIndex++}`);
            params.push(filters.awsAccountId);
        }

        const result = await this.query(`
            WITH filtered AS (
                SELECT v.*
                FROM vulnerabilities v
                WHERE ${conditions.join(' AND ')}
            )
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE severity = 'CRITICAL') AS critical,
                COUNT(*) FILTER (WHERE severity = 'HIGH') AS high,
                COUNT(*) FILTER (WHERE severity = 'MEDIUM') AS medium,
                COUNT(*) FILTER (WHERE severity = 'LOW') AS low,
                COUNT(*) FILTER (WHERE status = 'ACTIVE' OR status IS NULL) AS active,
                COUNT(*) FILTER (WHERE status = 'FIXED') AS fixed,
                COUNT(*) FILTER (WHERE fix_available = 'YES') AS fixable
            FROM filtered
        `, params);

        const row = result.rows[0] || {};
        return {
            total: Number(row.total) || 0,
            critical: Number(row.critical) || 0,
            high: Number(row.high) || 0,
            medium: Number(row.medium) || 0,
            low: Number(row.low) || 0,
            active: Number(row.active) || 0,
            fixed: Number(row.fixed) || 0,
            fixable: Number(row.fixable) || 0
        };
    }

    async clearCurrentTables() {
        await this.query('DELETE FROM "references"');
        await this.query('DELETE FROM packages');
        await this.query('DELETE FROM resources');
        await this.query('DELETE FROM vulnerabilities');
        await this.query('DELETE FROM reports');
    }

    async archiveVulnerabilities(reportId = 0) {
        try {
            // First, get count of current vulnerabilities to archive
            const countResult = await this.query('SELECT COUNT(*) as count FROM vulnerabilities');
            const archiveCount = parseInt(countResult.rows[0].count);

            if (archiveCount === 0) {
                console.log('📊 No vulnerabilities to archive');
                return 0;
            }

            console.log(`📦 Archiving ${archiveCount} vulnerabilities to history...`);
            // Archive vulnerabilities to history table (matching PostgreSQL schema)
            await this.query(`
                INSERT INTO vulnerability_history (
                    original_vulnerability_id,
                    vulnerability_id,
                    finding_arn,
                    aws_account_id,
                    title,
                    severity,
                    status,
                    fix_available,
                    inspector_score,
                    epss_score,
                    exploit_available,
                    package_name,
                    package_version,
                    fix_version,
                    first_observed_at,
                    last_observed_at,
                    archived_date,
                    resolution_type
                )
                SELECT
                    v.id,
                    v.vulnerability_id,
                    v.finding_arn,
                    v.aws_account_id,
                    v.title,
                    v.severity,
                    v.status,
                    v.fix_available,
                    v.inspector_score,
                    v.epss_score,
                    v.exploit_available,
                    v.package_name,
                    v.package_version,
                    v.fix_version,
                    v.first_observed_at,
                    v.last_observed_at,
                    CURRENT_TIMESTAMP,
                    'ARCHIVED'
                FROM vulnerabilities v
            `);


            // Archive associated resources to resource_history table
            await this.query(`
                INSERT INTO resource_history
                (original_resource_id, vulnerability_history_id, resource_type,
                 resource_identifier, region, archived_date)
                SELECT
                    r.id, h.id, r.resource_type, r.resource_id, r.region, CURRENT_TIMESTAMP
                FROM resources r
                JOIN vulnerabilities v ON v.id = r.vulnerability_id
                JOIN vulnerability_history h ON h.original_vulnerability_id = v.id
                WHERE h.archived_date >= CURRENT_TIMESTAMP - INTERVAL '1 minute'
            `);

            console.log(`✅ Successfully archived ${archiveCount} vulnerabilities to history`);
            return archiveCount;

        } catch (error) {
            console.error('❌ Failed to archive vulnerabilities:', error);
            throw error;
        }
    }

    async getVulnerabilityStatistics() {
        const summary = await this.getSummary();
        return summary;
    }

    async getHistoricalTrends() {
        return [];
    }

    async searchVulnerabilities(searchTerm, filters = {}) {
        return await this.getVulnerabilities({ ...filters, search: searchTerm });
    }

    async getFixedVulnerabilities(filters = {}) {
        try {
            const conditions = ['1=1'];
            const params = [];
            let paramIndex = 1;

            if (filters.severity) {
                conditions.push(`h.severity = $${paramIndex++}`);
                params.push(filters.severity);
            }

            if (filters.fixedAfter) {
                conditions.push(`h.archived_date >= $${paramIndex++}::date`);
                params.push(filters.fixedAfter);
            }

            if (filters.fixedBefore) {
                conditions.push(`h.archived_date <= $${paramIndex++}::date`);
                params.push(filters.fixedBefore);
            }

            if (filters.resourceType) {
                conditions.push(`EXISTS (
                    SELECT 1 FROM resource_history rh_filter
                    WHERE rh_filter.vulnerability_history_id = h.id
                      AND rh_filter.resource_type = $${paramIndex++}
                )`);
                params.push(filters.resourceType);
            }

            if (filters.resourceId) {
                conditions.push(`EXISTS (
                    SELECT 1 FROM resource_history rh_filter
                    WHERE rh_filter.vulnerability_history_id = h.id
                      AND rh_filter.resource_identifier = $${paramIndex++}
                )`);
                params.push(filters.resourceId);
            }

            let limitClause = '';
            if (filters.limit) {
                limitClause = ` LIMIT $${paramIndex++}`;
                params.push(filters.limit);
            }

            let offsetClause = '';
            if (filters.offset) {
                offsetClause = ` OFFSET $${paramIndex++}`;
                params.push(filters.offset);
            }

            const query = `
                WITH base AS (
                    SELECT
                        h.id,
                        COALESCE(h.finding_arn, h.vulnerability_id) AS finding_arn,
                        h.vulnerability_id,
                        h.aws_account_id,
                        h.title,
                        h.severity,
                        COALESCE(h.status, 'FIXED') AS status,
                        h.package_name,
                        h.package_version,
                        h.fix_version,
                        h.first_observed_at,
                        h.last_observed_at,
                        h.archived_date AS fixed_date,
                        h.resolution_type,
                        COALESCE(h.fix_available, CASE WHEN h.fix_version IS NOT NULL THEN 'Yes' ELSE 'No' END) AS fix_available,
                        h.inspector_score,
                        h.epss_score,
                        h.exploit_available,
                        GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (h.archived_date - COALESCE(h.first_observed_at, h.archived_date))) / 86400))::int AS days_active
                    FROM vulnerability_history h
                    WHERE NOT EXISTS (
                        SELECT 1 FROM vulnerabilities v
                        WHERE v.vulnerability_id = h.vulnerability_id
                          AND v.vulnerability_id IS NOT NULL
                          AND h.vulnerability_id IS NOT NULL
                    )
                      AND ${conditions.join(' AND ')}
                )
                SELECT
                    b.id,
                    b.finding_arn,
                    b.vulnerability_id,
                    b.aws_account_id,
                    b.title,
                    b.severity,
                    b.status,
                    b.package_name,
                    b.package_version,
                    b.fix_version,
                    b.first_observed_at,
                    b.last_observed_at,
                    b.fixed_date,
                    b.resolution_type,
                    b.fix_available,
                    b.inspector_score,
                    b.epss_score,
                    b.exploit_available,
                    b.days_active,
                    COALESCE(string_agg(DISTINCT rh.resource_identifier, ','), '') AS affected_resources,
                    COALESCE(string_agg(DISTINCT rh.resource_type, ','), '') AS resource_types
                FROM base b
                LEFT JOIN resource_history rh ON rh.vulnerability_history_id = b.id
                GROUP BY b.id, b.finding_arn, b.vulnerability_id, b.aws_account_id, b.title, b.severity, b.status,
                         b.package_name, b.package_version, b.fix_version, b.first_observed_at, b.last_observed_at,
                         b.fixed_date, b.resolution_type, b.fix_available, b.inspector_score, b.epss_score,
                         b.exploit_available, b.days_active
                ORDER BY b.fixed_date DESC, b.severity DESC
                ${limitClause}${offsetClause}
            `;

            const result = await this.query(query, params);

            const processedRows = result.rows.map(row => ({
                ...row,
                affected_resources: row.affected_resources ? row.affected_resources.split(',').filter(r => r) : [],
                resource_types: row.resource_types ? row.resource_types.split(',').filter(r => r) : [],
                fix_was_available: /^yes$/i.test(row.fix_available) ? 1 : 0,
                days_active: row.days_active !== null ? Number(row.days_active) : null
            }));

            return processedRows;

        } catch (error) {
            console.error('Failed to get fixed vulnerabilities:', error);
            throw error;
        }
    }

    async getVulnerabilityTimeline(identifier, options = {}) {
        if (!identifier || typeof identifier !== 'string') {
            throw new Error('Identifier is required for vulnerability timeline lookup');
        }

        const trimmedIdentifier = identifier.trim();
        if (!trimmedIdentifier) {
            throw new Error('Identifier is required for vulnerability timeline lookup');
        }

        const requestedLookup = options.lookupType;
        const lookupType = requestedLookup || (trimmedIdentifier.startsWith('arn:aws:inspector2:') ? 'findingArn' : 'vulnerabilityId');

        const resourceIdFilter = typeof options.resourceId === 'string'
            ? options.resourceId.trim() || null
            : null;
        const resourceTypeFilter = typeof options.resourceType === 'string'
            ? options.resourceType.trim() || null
            : null;

        let current = null;
        let vulnerabilityId = null;
        let findingArn = null;

        if (lookupType === 'findingArn') {
            const currentResult = await this.query(`
                SELECT
                    finding_arn,
                    vulnerability_id,
                    aws_account_id,
                    title,
                    severity,
                    status,
                    fix_available,
                    inspector_score,
                    epss_score,
                    exploit_available,
                    package_name,
                    package_version,
                    fix_version,
                    first_observed_at,
                    last_observed_at,
                    updated_at
                FROM vulnerabilities
                WHERE finding_arn = $1
                LIMIT 1
            `, [trimmedIdentifier]);

            if (currentResult.rows.length) {
                current = currentResult.rows[0];
                vulnerabilityId = current.vulnerability_id;
                findingArn = current.finding_arn;
            } else {
                findingArn = trimmedIdentifier;
            }
        } else {
            const currentResult = await this.query(`
                SELECT
                    finding_arn,
                    vulnerability_id,
                    aws_account_id,
                    title,
                    severity,
                    status,
                    fix_available,
                    inspector_score,
                    epss_score,
                    exploit_available,
                    package_name,
                    package_version,
                    fix_version,
                    first_observed_at,
                    last_observed_at,
                    updated_at
                FROM vulnerabilities
                WHERE vulnerability_id = $1
                LIMIT 1
            `, [trimmedIdentifier]);

            if (currentResult.rows.length) {
                current = currentResult.rows[0];
                vulnerabilityId = current.vulnerability_id;
                findingArn = current.finding_arn;
            } else {
                vulnerabilityId = trimmedIdentifier;
            }
        }

        if (!vulnerabilityId && lookupType === 'findingArn') {
            const historyMatch = await this.query(`
                SELECT vulnerability_id
                FROM vulnerability_history
                WHERE finding_arn = $1
                ORDER BY archived_date DESC
                LIMIT 1
            `, [trimmedIdentifier]);

            if (historyMatch.rows.length) {
                vulnerabilityId = historyMatch.rows[0].vulnerability_id;
            }
        }

        if (!vulnerabilityId) {
            const notFoundError = new Error('Timeline not found');
            notFoundError.code = 'NOT_FOUND';
            throw notFoundError;
        }

        const historyWhereClause = lookupType === 'findingArn'
            ? '(h.vulnerability_id = $1 OR h.finding_arn = $2)'
            : 'h.vulnerability_id = $1';
        const historyParams = lookupType === 'findingArn'
            ? [vulnerabilityId, trimmedIdentifier]
            : [vulnerabilityId];

        const historyResult = await this.query(`
            SELECT
                h.id,
                COALESCE(h.finding_arn, h.vulnerability_id) AS finding_arn,
                h.vulnerability_id,
                h.aws_account_id,
                h.title,
                h.severity,
                COALESCE(h.status, h.resolution_type, 'ARCHIVED') AS status,
                COALESCE(h.fix_available, CASE WHEN h.fix_version IS NOT NULL THEN 'Yes' ELSE 'No' END) AS fix_available,
                h.inspector_score,
                h.epss_score,
                h.exploit_available,
                h.package_name,
                h.package_version,
                h.fix_version,
                h.first_observed_at,
                h.last_observed_at,
                h.archived_date AS archived_at,
                h.resolution_type
            FROM vulnerability_history h
            WHERE ${historyWhereClause}
            ORDER BY h.archived_date DESC
        `, historyParams);

        if (!current && historyResult.rows.length === 0) {
            const notFoundError = new Error('Timeline not found');
            notFoundError.code = 'NOT_FOUND';
            throw notFoundError;
        }

        const historyIds = historyResult.rows.map(row => row.id);
        const resourceMap = new Map();

        if (historyIds.length > 0) {
            const resourceResult = await this.query(`
                SELECT
                    vulnerability_history_id,
                    resource_type,
                    resource_identifier,
                    region
                FROM resource_history
                WHERE vulnerability_history_id = ANY($1::int[])
            `, [historyIds]);

            for (const resource of resourceResult.rows) {
                if (resourceTypeFilter && resource.resource_type !== resourceTypeFilter) {
                    continue;
                }

                if (resourceIdFilter && resource.resource_identifier !== resourceIdFilter) {
                    continue;
                }

                if (!resourceMap.has(resource.vulnerability_history_id)) {
                    resourceMap.set(resource.vulnerability_history_id, []);
                }
                resourceMap.get(resource.vulnerability_history_id).push({
                    resource_type: resource.resource_type,
                    resource_identifier: resource.resource_identifier,
                    region: resource.region
                });
            }
        }

        const hadHistoricalRecords = historyResult.rows.length > 0;
        const history = [];
        for (const row of historyResult.rows) {
            let resources = resourceMap.has(row.id)
                ? [...resourceMap.get(row.id)]
                : [];

            if (resourceTypeFilter) {
                resources = resources.filter(resource => resource.resource_type === resourceTypeFilter);
            }

            if (resourceIdFilter) {
                resources = resources.filter(resource => resource.resource_identifier === resourceIdFilter);
            }

            if ((resourceTypeFilter || resourceIdFilter) && resources.length === 0) {
                continue;
            }

            history.push({
                id: row.id,
                finding_arn: row.finding_arn,
                vulnerability_id: row.vulnerability_id,
                aws_account_id: row.aws_account_id,
                title: row.title,
                severity: row.severity,
                status: row.status ? row.status.toUpperCase() : 'ARCHIVED',
                fix_available: row.fix_available,
                inspector_score: row.inspector_score,
                epss_score: row.epss_score,
                exploit_available: row.exploit_available,
                package_name: row.package_name,
                package_version: row.package_version,
                fix_version: row.fix_version,
                first_observed_at: row.first_observed_at,
                last_observed_at: row.last_observed_at,
                archived_at: row.archived_at,
                resolution_type: row.resolution_type,
                resources
            });
        }

        const currentStatus = current
            ? (current.status || 'ACTIVE').toUpperCase()
            : (hadHistoricalRecords ? 'FIXED' : 'UNKNOWN');

        const resolvedFindingArn = findingArn
            || historyResult.rows[0]?.finding_arn
            || (lookupType === 'findingArn' ? trimmedIdentifier : null)
            || null;

        return {
            finding_arn: resolvedFindingArn,
            vulnerability_id: vulnerabilityId,
            current_status: currentStatus,
            current: current
                ? {
                    finding_arn: current.finding_arn,
                    vulnerability_id: current.vulnerability_id,
                    aws_account_id: current.aws_account_id,
                    title: current.title,
                    severity: current.severity,
                    status: current.status,
                    fix_available: current.fix_available,
                    inspector_score: current.inspector_score,
                    epss_score: current.epss_score,
                    exploit_available: current.exploit_available,
                    package_name: current.package_name,
                    package_version: current.package_version,
                    fix_version: current.fix_version,
                    first_observed_at: current.first_observed_at,
                    last_observed_at: current.last_observed_at,
                    updated_at: current.updated_at
                }
                : null,
            history
        };
    }

    // ===== Upload events =====

    async createUploadEvent(filename) {
        const uploadId = randomUUID();
        await this.query(`
            INSERT INTO upload_events (
                upload_id,
                filename,
                status,
                started_at
            ) VALUES ($1, $2, 'STARTED', CURRENT_TIMESTAMP)
        `, [uploadId, filename]);
        return uploadId;
    }

    async updateUploadEvent(uploadId, status, metadata = {}) {
        const clauses = ['status = $1'];
        const params = [status];
        let index = 2;

        if (metadata.records_archived !== undefined) {
            clauses.push(`records_archived = $${index++}`);
            params.push(metadata.records_archived);
        }

        if (metadata.records_imported !== undefined) {
            clauses.push(`records_imported = $${index++}`);
            params.push(metadata.records_imported);
        }

        if (metadata.error_message) {
            clauses.push(`error_message = $${index++}`);
            params.push(metadata.error_message);
        }

        if (status === 'COMPLETED' || status === 'FAILED') {
            clauses.push('completed_at = CURRENT_TIMESTAMP');
        }

        params.push(uploadId);

        await this.query(`
            UPDATE upload_events
            SET ${clauses.join(', ')}
            WHERE upload_id = $${index}
        `, params);
    }

    async getUploadEvents(filters = {}) {
        const conditions = ['1=1'];
        const params = [];
        let idx = 1;

        if (filters.status) {
            if (Array.isArray(filters.status)) {
                conditions.push(`status = ANY($${idx++}::text[])`);
                params.push(filters.status);
            } else {
                conditions.push(`status = $${idx++}`);
                params.push(filters.status);
            }
        }

        if (filters.since) {
            conditions.push(`started_at >= $${idx++}`);
            params.push(filters.since);
        }

        let query = `
            SELECT upload_id, filename, status, started_at, completed_at,
                   records_archived, records_imported, error_message
            FROM upload_events
            WHERE ${conditions.join(' AND ')}
            ORDER BY started_at DESC
        `;

        if (filters.limit) {
            query += ` LIMIT $${idx++}`;
            params.push(filters.limit);
        }

        const result = await this.query(query, params);
        return result.rows;
    }

    // ===== Settings =====

    async getAllSettings() {
        const result = await this.query(`
            SELECT id, key, value, type, description, created_at, updated_at
            FROM settings
            ORDER BY key ASC
        `);
        return result.rows;
    }

    async getSettingByKey(key) {
        const result = await this.query(`
            SELECT id, key, value, type, description, created_at, updated_at
            FROM settings
            WHERE key = $1
        `, [key]);
        return result.rows[0] || null;
    }

    async updateSetting(key, value, type = 'string') {
        const result = await this.query(`
            UPDATE settings
            SET value = $1, type = $2, updated_at = CURRENT_TIMESTAMP
            WHERE key = $3
        `, [value, type, key]);
        return result.rowCount > 0;
    }

    async insertSetting(settingData) {
        const result = await this.query(`
            INSERT INTO settings (key, value, type, description)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [
            settingData.key,
            settingData.value,
            settingData.type || 'string',
            settingData.description || null
        ]);
        return result.rows[0].id;
    }

    async deleteSetting(key) {
        const result = await this.query(`
            DELETE FROM settings WHERE key = $1
        `, [key]);
        return result.rowCount > 0;
    }

    async validateSchema() {
        const result = await this.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
        `);
        return {
            tables: {
                found: result.rows.length,
                list: result.rows.map(row => row.table_name)
            }
        };
    }

    // ===== Settings & Database Management =====

    async getConnectionInfo() {
        try {
            const versionResult = await this.query('SELECT version()');
            const connectionsResult = await this.query(`
                SELECT count(*) as connection_count
                FROM pg_stat_activity
                WHERE state = 'active'
            `);

            return {
                version: versionResult.rows[0]?.version || 'Unknown',
                connectionCount: parseInt(connectionsResult.rows[0]?.connection_count || '0')
            };
        } catch (error) {
            console.warn('Failed to get connection info:', error.message);
            return {
                version: 'Unknown',
                connectionCount: 0
            };
        }
    }

    async getTableCounts() {
        try {
            // First check which tables exist
            const existingTablesResult = await this.query(`
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_type = 'BASE TABLE'
            `);

            const existingTables = existingTablesResult.rows.map(row => row.table_name);
            const tables = [
                'reports',
                'vulnerabilities',
                'resources',
                'packages',
                'references',
                'upload_events',
                'vulnerability_history',
                'resource_history'
            ];
            const counts = {};

            for (const table of tables) {
                if (existingTables.includes(table)) {
                    const identifier = table === 'references' ? '"references"' : table;
                    try {
                        const result = await this.query(`SELECT COUNT(*) as count FROM ${identifier}`);
                        counts[table] = parseInt(result.rows[0]?.count || '0');
                    } catch (error) {
                        console.warn(`Failed to count ${table}:`, error.message);
                        counts[table] = 0;
                    }
                } else {
                    counts[table] = 0; // Table doesn't exist
                }
            }

            return counts;
        } catch (error) {
            console.warn('Failed to get table counts:', error.message);
            return {};
        }
    }

    async clearDatabase() {
        if (!this.pool) {
            throw new Error('Database not initialized');
        }

        const quoteIdent = (name) => `"${name.replace(/"/g, '""')}"`;

        const results = {
            recordsCleared: 0,
            tablesCleared: [],
            preservedTables: [],
            errors: []
        };

        const existingTablesResult = await this.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
        `);

        const existingTables = existingTablesResult.rows.map(row => row.table_name);

        if (existingTables.length === 0) {
            console.log('ℹ️ No tables detected in public schema; nothing to clear.');
            return results;
        }

        console.log(`📋 Found tables in scope: ${existingTables.join(', ')}`);

        const tableCounts = await Promise.all(existingTables.map(async (table) => {
            try {
                const identifier = quoteIdent(table);
                const countResult = await this.query(`SELECT COUNT(*) AS count FROM ${identifier}`);
                const count = parseInt(countResult.rows[0]?.count || '0', 10);
                return { table, count };
            } catch (error) {
                console.warn(`⚠️ Unable to count rows for ${table}: ${error.message}`);
                return { table, count: 0 };
            }
        }));

        results.recordsCleared = tableCounts.reduce((sum, entry) => sum + entry.count, 0);
        results.tablesCleared = [...existingTables];

        const truncateList = existingTables.map(quoteIdent).join(', ');
        console.log(`🔄 Truncating all user tables with RESTART IDENTITY CASCADE.`);
        await this.query(`TRUNCATE TABLE ${truncateList} RESTART IDENTITY CASCADE`);

        console.log(`✅ Completed database clear; removed approximately ${results.recordsCleared} rows.`);

        return results;
    }

    async clearAllData() {
        return await this.clearDatabase();
    }
}

module.exports = { PostgreSQLDatabaseService };


