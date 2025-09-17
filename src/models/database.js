const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, '../../db/vulnerabilities.db');
        this.db = null;
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Reports table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS reports (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        filename TEXT,
                        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                        vulnerability_count INTEGER,
                        aws_account_id TEXT
                    )
                `);

                // Vulnerabilities table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS vulnerabilities (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        report_id INTEGER,
                        aws_account_id TEXT,
                        finding_arn TEXT UNIQUE,
                        vulnerability_id TEXT,
                        title TEXT,
                        description TEXT,
                        severity TEXT,
                        status TEXT,
                        fix_available TEXT,
                        inspector_score REAL,
                        epss_score REAL,
                        exploit_available TEXT,
                        first_observed_at DATETIME,
                        last_observed_at DATETIME,
                        updated_at DATETIME,
                        FOREIGN KEY (report_id) REFERENCES reports(id)
                    )
                `);

                // Resources table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS resources (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        vulnerability_id INTEGER,
                        resource_id TEXT,
                        resource_type TEXT,
                        resource_arn TEXT,
                        platform TEXT,
                        region TEXT,
                        details TEXT,
                        tags TEXT,
                        FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities(id)
                    )
                `);

                // Packages table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS packages (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        vulnerability_id INTEGER,
                        name TEXT,
                        version TEXT,
                        fixed_version TEXT,
                        package_manager TEXT,
                        file_path TEXT,
                        FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities(id)
                    )
                `);

                // References table (using quotes to avoid SQL keyword conflict)
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS "references" (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        vulnerability_id INTEGER,
                        url TEXT,
                        FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities(id)
                    )
                `, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    }

    async insertReport(filename, vulnerabilityCount, awsAccountId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO reports (filename, vulnerability_count, aws_account_id)
                 VALUES (?, ?, ?)`,
                [filename, vulnerabilityCount, awsAccountId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async insertVulnerability(reportId, vuln) {
        return new Promise((resolve, reject) => {
            const epssScore = vuln.epss ? vuln.epss.score : null;

            this.db.run(
                `INSERT OR REPLACE INTO vulnerabilities
                 (report_id, aws_account_id, finding_arn, vulnerability_id, title,
                  description, severity, status, fix_available, inspector_score,
                  epss_score, exploit_available, first_observed_at, last_observed_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    reportId,
                    vuln.awsAccountId,
                    vuln.findingArn,
                    vuln.packageVulnerabilityDetails?.vulnerabilityId || vuln.title,
                    vuln.title,
                    vuln.description,
                    vuln.severity,
                    vuln.status,
                    vuln.fixAvailable,
                    vuln.inspectorScore,
                    epssScore,
                    vuln.exploitAvailable,
                    vuln.firstObservedAt,
                    vuln.lastObservedAt,
                    vuln.updatedAt
                ],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async insertResource(vulnerabilityId, resource) {
        return new Promise((resolve, reject) => {
            let platform = '';
            let resourceArn = resource.id;

            if (resource.details) {
                if (resource.details.awsEc2Instance) {
                    platform = resource.details.awsEc2Instance.platform;
                } else if (resource.details.awsEcrContainerImage) {
                    platform = resource.details.awsEcrContainerImage.platform;
                }
            }

            this.db.run(
                `INSERT INTO resources
                 (vulnerability_id, resource_id, resource_type, resource_arn,
                  platform, region, details, tags)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    vulnerabilityId,
                    resource.id,
                    resource.type,
                    resourceArn,
                    platform,
                    resource.region,
                    JSON.stringify(resource.details),
                    JSON.stringify(resource.tags)
                ],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async insertPackage(vulnerabilityId, pkg) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO packages
                 (vulnerability_id, name, version, fixed_version, package_manager, file_path)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    vulnerabilityId,
                    pkg.name,
                    pkg.version,
                    pkg.fixedInVersion || pkg.fixedVersion,
                    pkg.packageManager,
                    pkg.filePath
                ],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async insertReference(vulnerabilityId, url) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO "references" (vulnerability_id, url) VALUES (?, ?)`,
                [vulnerabilityId, url],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async getSummary() {
        return new Promise((resolve, reject) => {
            const summary = {};

            this.db.get(
                `SELECT COUNT(*) as total FROM vulnerabilities`,
                (err, row) => {
                    if (err) return reject(err);
                    summary.total = row.total;

                    this.db.get(
                        `SELECT COUNT(*) as critical FROM vulnerabilities WHERE severity = 'CRITICAL'`,
                        (err, row) => {
                            if (err) return reject(err);
                            summary.critical = row.critical;

                            this.db.get(
                                `SELECT COUNT(*) as high FROM vulnerabilities WHERE severity = 'HIGH'`,
                                (err, row) => {
                                    if (err) return reject(err);
                                    summary.high = row.high;

                                    this.db.get(
                                        `SELECT COUNT(*) as medium FROM vulnerabilities WHERE severity = 'MEDIUM'`,
                                        (err, row) => {
                                            if (err) return reject(err);
                                            summary.medium = row.medium;

                                            this.db.get(
                                                `SELECT COUNT(*) as low FROM vulnerabilities WHERE severity = 'LOW'`,
                                                (err, row) => {
                                                    if (err) return reject(err);
                                                    summary.low = row.low;

                                                    this.db.get(
                                                        `SELECT COUNT(*) as fixable FROM vulnerabilities WHERE fix_available = 'YES'`,
                                                        (err, row) => {
                                                            if (err) return reject(err);
                                                            summary.fixable = row.fixable;
                                                            resolve(summary);
                                                        }
                                                    );
                                                }
                                            );
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        });
    }

    async getRecentReports(limit = 5) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM reports ORDER BY upload_date DESC LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async getVulnerabilities(filters = {}) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT DISTINCT v.*, r.resource_type, r.platform, r.resource_id, r.details, r.tags
                FROM vulnerabilities v
                LEFT JOIN resources r ON v.id = r.vulnerability_id
                WHERE 1=1
            `;
            const params = [];

            if (filters.status) {
                query += ' AND v.status = ?';
                params.push(filters.status);
            }

            if (filters.severity) {
                query += ' AND v.severity = ?';
                params.push(filters.severity);
            }

            if (filters.resourceType) {
                query += ' AND r.resource_type = ?';
                params.push(filters.resourceType);
            }

            if (filters.platform) {
                query += ' AND r.platform LIKE ?';
                params.push(`%${filters.platform}%`);
            }

            if (filters.fixAvailable) {
                query += ' AND v.fix_available = ?';
                params.push(filters.fixAvailable);
            }

            if (filters.vulnerabilityId) {
                query += ' AND v.vulnerability_id LIKE ?';
                params.push(`%${filters.vulnerabilityId}%`);
            }

            if (filters.resourceId) {
                query += ' AND r.resource_id LIKE ?';
                params.push(`%${filters.resourceId}%`);
            }

            if (filters.search) {
                query += ' AND (v.title LIKE ? OR v.description LIKE ? OR v.vulnerability_id LIKE ?)';
                params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
            }

            if (filters.lastObservedAt) {
                query += ' AND v.last_observed_at IS NOT NULL AND v.last_observed_at <= ?';
                params.push(filters.lastObservedAt);
            }

            query += ' ORDER BY v.severity DESC, v.inspector_score DESC';

            this.db.all(query, params, async (err, rows) => {
                if (err) return reject(err);

                // Get packages and references for each vulnerability
                const enrichedRows = await Promise.all(rows.map(async (row) => {
                    const packages = await this.getPackagesByVulnerabilityId(row.id);
                    const references = await this.getReferencesByVulnerabilityId(row.id);

                    return {
                        ...row,
                        packages,
                        references,
                        details: row.details ? JSON.parse(row.details) : null,
                        tags: row.tags ? JSON.parse(row.tags) : null
                    };
                }));

                resolve(enrichedRows);
            });
        });
    }

    async getPackagesByVulnerabilityId(vulnerabilityId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM packages WHERE vulnerability_id = ?`,
                [vulnerabilityId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async getReferencesByVulnerabilityId(vulnerabilityId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT url FROM "references" WHERE vulnerability_id = ?`,
                [vulnerabilityId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.map(r => r.url));
                }
            );
        });
    }

    async getVulnerabilitiesByIds(ids) {
        if (!ids || ids.length === 0) {
            return [];
        }

        const placeholders = ids.map(() => '?').join(',');

        return new Promise((resolve, reject) => {
            const query = `
                SELECT v.*, r.resource_type, r.platform, r.resource_id, r.details, r.tags
                FROM vulnerabilities v
                LEFT JOIN resources r ON v.id = r.vulnerability_id
                WHERE v.id IN (${placeholders})
            `;

            this.db.all(query, ids, async (err, rows) => {
                if (err) return reject(err);

                const enrichedRows = await Promise.all(rows.map(async (row) => {
                    const packages = await this.getPackagesByVulnerabilityId(row.id);
                    const references = await this.getReferencesByVulnerabilityId(row.id);

                    return {
                        ...row,
                        packages,
                        references,
                        details: row.details ? JSON.parse(row.details) : null,
                        tags: row.tags ? JSON.parse(row.tags) : null
                    };
                }));

                resolve(enrichedRows);
            });
        });
    }

    async getVulnerabilitiesGroupedByCVE(filters = {}) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT
                    v.vulnerability_id,
                    v.title,
                    v.description,
                    v.severity,
                    v.status,
                    v.fix_available,
                    v.inspector_score,
                    v.epss_score,
                    v.exploit_available,
                    COUNT(DISTINCT r.resource_id) as affected_resources_count,
                    GROUP_CONCAT(DISTINCT r.resource_id) as resource_ids,
                    GROUP_CONCAT(DISTINCT r.resource_type) as resource_types,
                    GROUP_CONCAT(DISTINCT r.platform) as platforms,
                    MIN(v.first_observed_at) as first_observed_at,
                    MAX(v.last_observed_at) as last_observed_at,
                    MAX(v.id) as id
                FROM vulnerabilities v
                LEFT JOIN resources r ON v.id = r.vulnerability_id
                WHERE 1=1
            `;
            const params = [];

            if (filters.status) {
                query += ' AND v.status = ?';
                params.push(filters.status);
            }

            if (filters.severity) {
                query += ' AND v.severity = ?';
                params.push(filters.severity);
            }

            if (filters.resourceType) {
                query += ' AND r.resource_type = ?';
                params.push(filters.resourceType);
            }

            if (filters.platform) {
                query += ' AND r.platform LIKE ?';
                params.push(`%${filters.platform}%`);
            }

            if (filters.fixAvailable) {
                query += ' AND v.fix_available = ?';
                params.push(filters.fixAvailable);
            }

            if (filters.vulnerabilityId) {
                query += ' AND v.vulnerability_id LIKE ?';
                params.push(`%${filters.vulnerabilityId}%`);
            }

            if (filters.resourceId) {
                query += ' AND r.resource_id LIKE ?';
                params.push(`%${filters.resourceId}%`);
            }

            if (filters.search) {
                query += ' AND (v.title LIKE ? OR v.description LIKE ? OR v.vulnerability_id LIKE ?)';
                params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
            }

            if (filters.lastObservedAt) {
                query += ' AND v.last_observed_at IS NOT NULL AND v.last_observed_at <= ?';
                params.push(filters.lastObservedAt);
            }

            query += ' GROUP BY v.vulnerability_id, v.title, v.description, v.severity, v.status, v.fix_available, v.inspector_score, v.epss_score, v.exploit_available';
            query += ' ORDER BY v.severity DESC, v.inspector_score DESC';

            this.db.all(query, params, async (err, rows) => {
                if (err) return reject(err);

                // Get detailed resource information and packages for each grouped vulnerability
                const enrichedRows = await Promise.all(rows.map(async (row) => {
                    // Get all resources for this CVE
                    const resources = await this.getResourcesByCVE(row.vulnerability_id);

                    // Get packages (from the first matching vulnerability)
                    const packages = await this.getPackagesByVulnerabilityId(row.id);

                    // Get references
                    const references = await this.getReferencesByVulnerabilityId(row.id);

                    return {
                        ...row,
                        resources,
                        packages,
                        references,
                        resource_ids: row.resource_ids ? row.resource_ids.split(',') : [],
                        resource_types: row.resource_types ? row.resource_types.split(',') : [],
                        platforms: row.platforms ? row.platforms.split(',').filter(p => p && p !== 'null') : []
                    };
                }));

                resolve(enrichedRows);
            });
        });
    }

    async getResourcesByCVE(vulnerabilityId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT DISTINCT
                    r.resource_id,
                    r.resource_type,
                    r.platform,
                    r.region,
                    r.details,
                    r.tags,
                    v.last_observed_at
                FROM resources r
                JOIN vulnerabilities v ON r.vulnerability_id = v.id
                WHERE v.vulnerability_id = ?
            `;

            this.db.all(query, [vulnerabilityId], (err, rows) => {
                if (err) reject(err);
                else {
                    const processedRows = rows.map(row => ({
                        ...row,
                        details: row.details ? JSON.parse(row.details) : null,
                        tags: row.tags ? JSON.parse(row.tags) : null
                    }));
                    resolve(processedRows);
                }
            });
        });
    }

    async getFilterOptions() {
        return new Promise((resolve, reject) => {
            const options = {};

            this.db.all(
                `SELECT DISTINCT status FROM vulnerabilities WHERE status IS NOT NULL`,
                (err, rows) => {
                    if (err) return reject(err);
                    options.statuses = rows.map(r => r.status);

                    this.db.all(
                        `SELECT DISTINCT severity FROM vulnerabilities WHERE severity IS NOT NULL`,
                        (err, rows) => {
                            if (err) return reject(err);
                            options.severities = rows.map(r => r.severity);

                            this.db.all(
                                `SELECT DISTINCT resource_type FROM resources WHERE resource_type IS NOT NULL`,
                                (err, rows) => {
                                    if (err) return reject(err);
                                    options.resourceTypes = rows.map(r => r.resource_type);

                                    this.db.all(
                                        `SELECT DISTINCT platform FROM resources WHERE platform IS NOT NULL AND platform != ''`,
                                        (err, rows) => {
                                            if (err) return reject(err);
                                            options.platforms = rows.map(r => r.platform);
                                            resolve(options);
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        });
    }

    async getAllReports() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM reports ORDER BY upload_date DESC`,
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async deleteReport(reportId) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                // Delete references
                this.db.run(
                    `DELETE FROM "references" WHERE vulnerability_id IN
                     (SELECT id FROM vulnerabilities WHERE report_id = ?)`,
                    [reportId]
                );

                // Delete packages
                this.db.run(
                    `DELETE FROM packages WHERE vulnerability_id IN
                     (SELECT id FROM vulnerabilities WHERE report_id = ?)`,
                    [reportId]
                );

                // Delete resources
                this.db.run(
                    `DELETE FROM resources WHERE vulnerability_id IN
                     (SELECT id FROM vulnerabilities WHERE report_id = ?)`,
                    [reportId]
                );

                // Delete vulnerabilities
                this.db.run(
                    `DELETE FROM vulnerabilities WHERE report_id = ?`,
                    [reportId]
                );

                // Delete report
                this.db.run(
                    `DELETE FROM reports WHERE id = ?`,
                    [reportId],
                    (err) => {
                        if (err) {
                            this.db.run('ROLLBACK');
                            reject(err);
                        } else {
                            this.db.run('COMMIT');
                            resolve();
                        }
                    }
                );
            });
        });
    }

    // ============================================================================
    // HISTORY TRACKING METHODS
    // ============================================================================

    /**
     * Archive current vulnerabilities to history tables before clearing them
     * @param {number} reportId - Report ID that vulnerabilities came from
     * @param {object} transaction - Optional transaction context
     * @returns {Promise<number>} Count of archived records
     */
    async archiveVulnerabilities(reportId, transaction = null) {
        return new Promise((resolve, reject) => {
            const db = transaction || this.db;

            // First, get count of current vulnerabilities to archive
            db.get('SELECT COUNT(*) as count FROM vulnerabilities', [], (err, result) => {
                if (err) return reject(err);

                const archiveCount = result.count;

                if (archiveCount === 0) {
                    return resolve(0);
                }

                // Archive vulnerabilities to history table
                db.run(`
                    INSERT INTO vulnerability_history
                    (finding_arn, vulnerability_id, title, severity, status, fix_available,
                     inspector_score, first_observed_at, last_observed_at, archived_at,
                     original_report_id, archived_from_report_id)
                    SELECT
                        finding_arn, vulnerability_id, title, severity, status, fix_available,
                        inspector_score, first_observed_at, last_observed_at, CURRENT_TIMESTAMP,
                        report_id, ?
                    FROM vulnerabilities
                `, [reportId], (err) => {
                    if (err) return reject(err);

                    // Archive associated resources
                    db.run(`
                        INSERT INTO resource_history
                        (history_id, resource_id, resource_type, platform, archived_at)
                        SELECT
                            h.id, r.resource_id, r.resource_type, r.platform, CURRENT_TIMESTAMP
                        FROM vulnerability_history h
                        JOIN vulnerabilities v ON v.finding_arn = h.finding_arn
                            AND h.archived_from_report_id = ?
                        JOIN resources r ON r.vulnerability_id = v.id
                    `, [reportId], (err) => {
                        if (err) return reject(err);
                        resolve(archiveCount);
                    });
                });
            });
        });
    }

    /**
     * Get fixed vulnerabilities (those in history but not in current data)
     * @param {object} filters - Filtering options
     * @returns {Promise<array>} Array of fixed vulnerabilities with derived fields
     */
    async getFixedVulnerabilities(filters = {}) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT DISTINCT
                    h.finding_arn,
                    h.vulnerability_id,
                    h.title,
                    h.severity,
                    h.status,
                    h.fix_available,
                    h.inspector_score,
                    h.first_observed_at,
                    h.last_observed_at,
                    h.archived_at as fixed_date,
                    CASE
                        WHEN h.first_observed_at IS NOT NULL
                        THEN ROUND((julianday(h.archived_at) - julianday(h.first_observed_at)))
                        ELSE NULL
                    END as days_active,
                    CASE WHEN h.fix_available = 'YES' THEN 1 ELSE 0 END as fix_was_available,
                    GROUP_CONCAT(DISTINCT rh.resource_id) as affected_resources,
                    GROUP_CONCAT(DISTINCT rh.resource_type) as resource_types
                FROM vulnerability_history h
                LEFT JOIN resource_history rh ON rh.history_id = h.id
                WHERE NOT EXISTS (
                    SELECT 1 FROM vulnerabilities v
                    WHERE v.finding_arn = h.finding_arn
                       OR (v.vulnerability_id = h.vulnerability_id
                           AND v.vulnerability_id IS NOT NULL
                           AND h.vulnerability_id IS NOT NULL)
                )
            `;
            const params = [];

            if (filters.severity) {
                query += ' AND h.severity = ?';
                params.push(filters.severity);
            }

            if (filters.fixedAfter) {
                query += ' AND h.archived_at >= ?';
                params.push(filters.fixedAfter);
            }

            if (filters.fixedBefore) {
                query += ' AND h.archived_at <= ?';
                params.push(filters.fixedBefore);
            }

            if (filters.resourceType) {
                query += ' AND EXISTS (SELECT 1 FROM resource_history rh2 WHERE rh2.history_id = h.id AND rh2.resource_type = ?)';
                params.push(filters.resourceType);
            }

            query += ' GROUP BY h.finding_arn, h.vulnerability_id, h.title, h.severity, h.status, h.fix_available, h.inspector_score, h.first_observed_at, h.last_observed_at, h.archived_at';
            query += ' ORDER BY h.archived_at DESC, h.severity DESC';

            // Add pagination
            const limit = filters.limit || 50;
            const offset = filters.offset || 0;
            query += ` LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            this.db.all(query, params, (err, rows) => {
                if (err) return reject(err);

                // Process results to convert string arrays and parse data
                const processedRows = rows.map(row => ({
                    ...row,
                    affected_resources: row.affected_resources ? row.affected_resources.split(',') : [],
                    resource_types: row.resource_types ? row.resource_types.split(',') : [],
                    fix_was_available: Boolean(row.fix_was_available)
                }));

                resolve(processedRows);
            });
        });
    }

    /**
     * Get historical timeline for a specific vulnerability
     * @param {string} findingArn - AWS Inspector finding ARN
     * @returns {Promise<object>} Vulnerability history timeline
     */
    async getVulnerabilityTimeline(findingArn) {
        return new Promise((resolve, reject) => {
            // First check if vulnerability exists in current data
            this.db.get(
                'SELECT finding_arn FROM vulnerabilities WHERE finding_arn = ?',
                [findingArn],
                (err, currentRow) => {
                    if (err) return reject(err);

                    const currentStatus = currentRow ? 'ACTIVE' : 'FIXED';

                    // Get historical records
                    this.db.all(`
                        SELECT
                            h.vulnerability_id,
                            h.title,
                            h.severity,
                            h.status,
                            h.fix_available,
                            h.inspector_score,
                            h.first_observed_at,
                            h.last_observed_at,
                            h.archived_at,
                            h.archived_from_report_id
                        FROM vulnerability_history h
                        WHERE h.finding_arn = ?
                        ORDER BY h.archived_at DESC
                    `, [findingArn], (err, historyRows) => {
                        if (err) return reject(err);

                        if (historyRows.length === 0 && !currentRow) {
                            return reject(new Error('Vulnerability not found in history or current data'));
                        }

                        resolve({
                            finding_arn: findingArn,
                            current_status: currentStatus,
                            history: historyRows
                        });
                    });
                }
            );
        });
    }

    /**
     * Create a new upload event for tracking workflow state
     * @param {string} filename - Original filename of uploaded report
     * @returns {Promise<string>} Upload ID
     */
    async createUploadEvent(filename) {
        return new Promise((resolve, reject) => {
            const uploadId = require('crypto').randomUUID();

            this.db.run(`
                INSERT INTO upload_events (upload_id, filename, status, started_at)
                VALUES (?, ?, 'STARTED', CURRENT_TIMESTAMP)
            `, [uploadId, filename], function(err) {
                if (err) reject(err);
                else resolve(uploadId);
            });
        });
    }

    /**
     * Update upload event status and metadata
     * @param {string} uploadId - Upload ID to update
     * @param {string} status - New status
     * @param {object} metadata - Additional metadata (records_archived, records_imported, error_message)
     * @returns {Promise<void>}
     */
    async updateUploadEvent(uploadId, status, metadata = {}) {
        return new Promise((resolve, reject) => {
            let updateFields = ['status = ?'];
            let params = [status];

            if (metadata.records_archived !== undefined) {
                updateFields.push('records_archived = ?');
                params.push(metadata.records_archived);
            }

            if (metadata.records_imported !== undefined) {
                updateFields.push('records_imported = ?');
                params.push(metadata.records_imported);
            }

            if (metadata.error_message) {
                updateFields.push('error_message = ?');
                params.push(metadata.error_message);
            }

            if (status === 'COMPLETED' || status === 'FAILED') {
                updateFields.push('completed_at = CURRENT_TIMESTAMP');
            }

            params.push(uploadId);

            this.db.run(`
                UPDATE upload_events
                SET ${updateFields.join(', ')}
                WHERE upload_id = ?
            `, params, function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Clear current vulnerability data tables (for upload workflow)
     * @param {object} transaction - Optional transaction context
     * @returns {Promise<void>}
     */
    async clearCurrentTables(transaction = null) {
        return new Promise((resolve, reject) => {
            const db = transaction || this.db;

            db.serialize(() => {
                // Clear in reverse dependency order
                db.run('DELETE FROM "references"', (err) => {
                    if (err) return reject(err);

                    db.run('DELETE FROM packages', (err) => {
                        if (err) return reject(err);

                        db.run('DELETE FROM resources', (err) => {
                            if (err) return reject(err);

                            db.run('DELETE FROM vulnerabilities', (err) => {
                                if (err) return reject(err);
                                resolve();
                            });
                        });
                    });
                });
            });
        });
    }

    /**
     * Get upload events history
     * @param {object} filters - Filtering options
     * @returns {Promise<array>} Upload events
     */
    async getUploadEvents(filters = {}) {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM upload_events WHERE 1=1';
            const params = [];

            if (filters.status) {
                query += ' AND status = ?';
                params.push(filters.status);
            }

            if (filters.since) {
                query += ' AND started_at >= ?';
                params.push(filters.since);
            }

            query += ' ORDER BY started_at DESC';

            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(filters.limit);
            }

            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // ============================================================================
    // TRANSACTION SUPPORT METHODS
    // ============================================================================

    /**
     * Begin a database transaction
     * @returns {Promise<void>}
     */
    async beginTransaction() {
        return new Promise((resolve, reject) => {
            this.db.run('BEGIN TRANSACTION', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Commit current transaction
     * @returns {Promise<void>}
     */
    async commitTransaction() {
        return new Promise((resolve, reject) => {
            this.db.run('COMMIT', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Rollback current transaction
     * @returns {Promise<void>}
     */
    async rollbackTransaction() {
        return new Promise((resolve, reject) => {
            this.db.run('ROLLBACK', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

module.exports = Database;