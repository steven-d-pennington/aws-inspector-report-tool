const HistoryService = require('./historyService');
const { UploadEventService } = require('./uploadEventService');

class ReportService {
    constructor() {
        this.historyService = null;
        this.uploadEventService = null;
    }

    /**
     * Initialize services with database connection
     * @param {Database} db - Database instance
     */
    initialize(db) {
        this.historyService = new HistoryService(db);
        this.uploadEventService = new UploadEventService(db);
    }

    /**
     * Process a vulnerability report with history preservation workflow
     * This replaces the old processReport method with atomic history workflow
     *
     * @param {object} reportData - Parsed report data
     * @param {Database} db - Database instance
     * @param {string} filename - Original filename
     * @param {string} reportRunDate - Optional report run date (ISO string)
     * @returns {Promise<number>} Report ID
     */
    async processReportWithHistory(reportData, db, filename, reportRunDate = null) {
        // Initialize services if not already done
        if (!this.historyService) {
            this.initialize(db);
        }

        const uploadEvent = this.uploadEventService.createUploadEvent(filename);
        let reportId = null;

        try {
            // Step 1: Initialize upload tracking
            await uploadEvent.initialize();

            // Step 2: Begin database transaction for atomicity
            await db.beginTransaction();

            // Step 3: Archive current vulnerabilities to history
            await uploadEvent.startArchiving();
            const archivedCount = await this.historyService.archiveCurrentVulnerabilities(0, {
                triggeredByUploadId: uploadEvent.uploadId
            }); // Will get actual reportId later
            await uploadEvent.completeArchiving(archivedCount);

            // Step 4: Clear current tables
            await uploadEvent.startClearing();
            await db.clearCurrentTables();
            await uploadEvent.completeClearing();

            // Step 5: Import new data
            await uploadEvent.startImporting();
            reportId = await this._processReportData(reportData, db, filename, reportRunDate);
            await uploadEvent.completeImporting(reportData.findings?.length || 0);

            // Step 6: Commit transaction
            await db.commitTransaction();

            // Step 7: Mark upload as completed
            await uploadEvent.complete();

            console.log(`🎉 Report processed successfully with history workflow`);
            console.log(`   📄 File: ${filename}`);
            console.log(`   📊 Archived: ${archivedCount} vulnerabilities`);
            console.log(`   📥 Imported: ${reportData.findings?.length || 0} vulnerabilities`);

            return reportId;

        } catch (error) {
            console.error('❌ Report processing failed:', error);

            try {
                // Rollback transaction
                await db.rollbackTransaction();
                console.log('🔄 Transaction rolled back successfully');
            } catch (rollbackError) {
                console.error('Failed to rollback transaction:', rollbackError);
            }

            // Mark upload as failed
            await uploadEvent.fail(error);

            throw new Error(`Report processing failed: ${error.message}`);
        }
    }

    /**
     * Legacy method for backward compatibility
     * Routes to the new history-aware method
     *
     * @param {object} reportData - Parsed report data
     * @param {Database} db - Database instance
     * @param {string} filename - Original filename
     * @param {string} reportRunDate - Optional report run date (ISO string)
     * @returns {Promise<number>} Report ID
     */
    async processReport(reportData, db, filename, reportRunDate = null) {
        return await this.processReportWithHistory(reportData, db, filename, reportRunDate);
    }

    /**
     * Internal method to process report data (the actual data insertion)
     * This is the core logic extracted from the original processReport
     *
     * @param {object} reportData - Parsed report data
     * @param {Database} db - Database instance
     * @param {string} filename - Original filename
     * @param {string} reportRunDate - Optional report run date (ISO string)
     * @returns {Promise<number>} Report ID
     */
    async _processReportData(reportData, db, filename, reportRunDate = null) {
        try {
            const findings = reportData.findings || [];
            const awsAccountId = findings.length > 0 ? findings[0].awsAccountId : 'unknown';

            // Insert main report record
            const reportId = await db.insertReport({
                filename,
                vulnerabilityCount: findings.length,
                awsAccountId,
                reportRunDate
            });

            // Process each finding
            for (const finding of findings) {
                try {
                    // Insert vulnerability
                    const vulnerabilityId = await db.insertVulnerability(reportId, finding);

                    // Insert resources
                    if (finding.resources && finding.resources.length > 0) {
                        for (const resource of finding.resources) {
                            await db.insertResource(vulnerabilityId, resource);
                        }
                    }

                    // Insert vulnerable packages
                    if (finding.packageVulnerabilityDetails && finding.packageVulnerabilityDetails.vulnerablePackages) {
                        for (const pkg of finding.packageVulnerabilityDetails.vulnerablePackages) {
                            await db.insertPackage(vulnerabilityId, pkg);
                        }
                    }

                    // Insert reference URLs
                    if (finding.packageVulnerabilityDetails && finding.packageVulnerabilityDetails.referenceUrls) {
                        for (const url of finding.packageVulnerabilityDetails.referenceUrls) {
                            await db.insertReference(vulnerabilityId, url);
                        }
                    }
                } catch (err) {
                    console.error('Error processing finding:', err);
                    // Continue processing other findings
                }
            }

            return reportId;
        } catch (error) {
            console.error('Error processing report data:', error);
            throw error;
        }
    }

    /**
     * Get upload history and statistics
     * @param {object} filters - Filtering options
     * @returns {Promise<object>} Upload history data
     */
    async getUploadHistory(filters = {}) {
        if (!this.uploadEventService) {
            throw new Error('Upload event service not initialized');
        }

        const history = await this.uploadEventService.getUploadHistory(filters);
        const statistics = await this.uploadEventService.getUploadStatistics();

        return {
            events: history,
            statistics: statistics
        };
    }

    /**
     * Health check for the report service
     * @returns {Promise<object>} Health status
     */
    async healthCheck() {
        try {
            const checks = {
                report_service: 'healthy',
                history_service: 'unknown',
                upload_event_service: 'unknown'
            };

            if (this.historyService) {
                const historyHealth = await this.historyService.healthCheck();
                checks.history_service = historyHealth.status;
            }

            if (this.uploadEventService) {
                const uploadHealth = await this.uploadEventService.healthCheck();
                checks.upload_event_service = uploadHealth.status;
            }

            const allHealthy = Object.values(checks).every(status => status === 'healthy');

            return {
                status: allHealthy ? 'healthy' : 'degraded',
                message: allHealthy ? 'Report service is fully operational' : 'Some components have issues',
                timestamp: new Date().toISOString(),
                components: checks
            };
        } catch (error) {
            return {
                status: 'error',
                message: `Report service error: ${error.message}`,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Process report without history workflow (for testing or special cases)
     * This bypasses the history archiving process
     *
     * @param {object} reportData - Parsed report data
     * @param {Database} db - Database instance
     * @param {string} filename - Original filename
     * @param {string} reportRunDate - Optional report run date (ISO string)
     * @returns {Promise<number>} Report ID
     */
    async processReportDirectly(reportData, db, filename, reportRunDate = null) {
        console.log('⚠️ Processing report without history workflow');
        return await this._processReportData(reportData, db, filename, reportRunDate);
    }
}

module.exports = new ReportService();