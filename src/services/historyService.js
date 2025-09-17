/**
 * History Service - Business logic for vulnerability history tracking and fixed vulnerability analysis
 *
 * This service provides high-level operations for:
 * - Archiving current vulnerabilities to history
 * - Finding vulnerabilities that have been fixed
 * - Analyzing vulnerability timelines and lifecycle
 * - Managing upload workflow with history preservation
 */

class HistoryService {
    constructor(database) {
        this.db = database;
    }

    /**
     * Archive current vulnerabilities to history before new report upload
     * This is the first step in the upload workflow
     *
     * @param {number} reportId - Report ID that vulnerabilities will be archived from
     * @returns {Promise<number>} Count of vulnerabilities archived
     */
    async archiveCurrentVulnerabilities(reportId) {
        try {
            console.log(`Archiving current vulnerabilities from report ${reportId}...`);

            const archivedCount = await this.db.archiveVulnerabilities(reportId);

            console.log(`✓ Archived ${archivedCount} vulnerabilities to history`);
            return archivedCount;
        } catch (error) {
            console.error('Failed to archive current vulnerabilities:', error);
            throw new Error(`History archiving failed: ${error.message}`);
        }
    }

    /**
     * Find vulnerabilities that have been fixed (exist in history but not in current data)
     * Implements vulnerability matching logic with primary and secondary matching
     *
     * @param {object} filters - Filtering and pagination options
     * @param {string} filters.severity - Filter by severity (CRITICAL, HIGH, MEDIUM, LOW)
     * @param {string} filters.fixedAfter - Show vulnerabilities fixed after this date (ISO 8601)
     * @param {string} filters.fixedBefore - Show vulnerabilities fixed before this date (ISO 8601)
     * @param {string} filters.resourceType - Filter by affected resource type
     * @param {number} filters.limit - Maximum results to return (default: 50)
     * @param {number} filters.offset - Results to skip for pagination (default: 0)
     * @returns {Promise<object>} Object with data, pagination, and summary
     */
    async findFixedVulnerabilities(filters = {}) {
        try {
            console.log('Finding fixed vulnerabilities with filters:', filters);

            // Get fixed vulnerabilities from database
            const fixedVulnerabilities = await this.db.getFixedVulnerabilities(filters);

            // Get total count for pagination (run same query without limit/offset)
            const countFilters = { ...filters };
            delete countFilters.limit;
            delete countFilters.offset;
            const allFixed = await this.db.getFixedVulnerabilities(countFilters);
            const totalCount = allFixed.length;

            // Calculate pagination metadata
            const limit = filters.limit || 50;
            const offset = filters.offset || 0;
            const hasMore = (offset + fixedVulnerabilities.length) < totalCount;

            // Calculate summary statistics
            const summary = this._calculateFixedVulnerabilitiesSummary(allFixed);

            console.log(`✓ Found ${fixedVulnerabilities.length} fixed vulnerabilities (${totalCount} total)`);

            return {
                data: fixedVulnerabilities,
                pagination: {
                    total: totalCount,
                    limit: limit,
                    offset: offset,
                    has_more: hasMore
                },
                summary: summary
            };
        } catch (error) {
            console.error('Failed to find fixed vulnerabilities:', error);
            throw new Error(`Fixed vulnerability analysis failed: ${error.message}`);
        }
    }

    /**
     * Get complete historical timeline for a specific vulnerability
     * Shows all archived versions and current status
     *
     * @param {string} findingArn - AWS Inspector finding ARN
     * @returns {Promise<object>} Timeline with current status and history array
     */
    async getVulnerabilityHistory(findingArn) {
        try {
            console.log(`Getting vulnerability history for: ${findingArn}`);

            const timeline = await this.db.getVulnerabilityTimeline(findingArn);

            console.log(`✓ Retrieved ${timeline.history.length} historical records, status: ${timeline.current_status}`);
            return timeline;
        } catch (error) {
            console.error('Failed to get vulnerability history:', error);
            throw new Error(`Vulnerability timeline retrieval failed: ${error.message}`);
        }
    }

    /**
     * Validate vulnerability matching logic for fixed vulnerability detection
     * This method implements the primary and secondary matching rules
     *
     * @param {object} historyVuln - Vulnerability from history
     * @param {array} currentVulns - Current vulnerabilities to match against
     * @returns {boolean} True if vulnerability is still active, false if fixed
     */
    _isVulnerabilityStillActive(historyVuln, currentVulns) {
        // Primary matching: finding_arn (most reliable)
        if (historyVuln.finding_arn) {
            const arnMatch = currentVulns.find(v => v.finding_arn === historyVuln.finding_arn);
            if (arnMatch) return true;
        }

        // Secondary matching: CVE + resource overlap (fallback)
        if (historyVuln.vulnerability_id) {
            const cveMatches = currentVulns.filter(v => v.vulnerability_id === historyVuln.vulnerability_id);

            for (const cveMatch of cveMatches) {
                // Check if there's resource overlap
                // This would require comparing affected resources
                // For now, we consider CVE match as potential match
                if (this._hasResourceOverlap(historyVuln, cveMatch)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if two vulnerabilities have overlapping affected resources
     * Used for secondary matching logic
     *
     * @param {object} vuln1 - First vulnerability
     * @param {object} vuln2 - Second vulnerability
     * @returns {boolean} True if resources overlap
     */
    _hasResourceOverlap(vuln1, vuln2) {
        // This is a simplified implementation
        // In practice, you'd want to compare actual resource IDs
        // For now, we use CVE match as sufficient
        return true;
    }

    /**
     * Calculate summary statistics for fixed vulnerabilities
     *
     * @param {array} fixedVulnerabilities - Array of fixed vulnerabilities
     * @returns {object} Summary statistics
     */
    _calculateFixedVulnerabilitiesSummary(fixedVulnerabilities) {
        const summary = {
            total_fixed: fixedVulnerabilities.length,
            critical_fixed: 0,
            high_fixed: 0,
            medium_fixed: 0,
            low_fixed: 0,
            avg_days_active: 0
        };

        if (fixedVulnerabilities.length === 0) {
            return summary;
        }

        let totalDaysActive = 0;
        let vulnerabilitiesWithDays = 0;

        for (const vuln of fixedVulnerabilities) {
            // Count by severity
            switch (vuln.severity) {
                case 'CRITICAL':
                    summary.critical_fixed++;
                    break;
                case 'HIGH':
                    summary.high_fixed++;
                    break;
                case 'MEDIUM':
                    summary.medium_fixed++;
                    break;
                case 'LOW':
                    summary.low_fixed++;
                    break;
            }

            // Calculate average days active
            if (vuln.days_active !== null && vuln.days_active >= 0) {
                totalDaysActive += vuln.days_active;
                vulnerabilitiesWithDays++;
            }
        }

        // Calculate average days active
        if (vulnerabilitiesWithDays > 0) {
            summary.avg_days_active = Math.round((totalDaysActive / vulnerabilitiesWithDays) * 10) / 10;
        }

        return summary;
    }

    /**
     * Get upload events history for monitoring and debugging
     *
     * @param {object} filters - Filtering options
     * @returns {Promise<array>} Upload events
     */
    async getUploadHistory(filters = {}) {
        try {
            const events = await this.db.getUploadEvents(filters);
            console.log(`✓ Retrieved ${events.length} upload events`);
            return events;
        } catch (error) {
            console.error('Failed to get upload history:', error);
            throw new Error(`Upload history retrieval failed: ${error.message}`);
        }
    }

    /**
     * Validate that a vulnerability has been properly archived
     * Used for testing and validation
     *
     * @param {string} findingArn - Finding ARN to validate
     * @returns {Promise<boolean>} True if properly archived
     */
    async validateArchival(findingArn) {
        try {
            const timeline = await this.db.getVulnerabilityTimeline(findingArn);
            return timeline.history.length > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get comprehensive fixed vulnerability report data
     * Combines multiple data sources for reporting dashboard
     *
     * @param {object} filters - Filtering options
     * @returns {Promise<object>} Complete report data
     */
    async getFixedVulnerabilityReport(filters = {}) {
        try {
            // Get main fixed vulnerabilities data
            const fixedData = await this.findFixedVulnerabilities(filters);

            // Get recent upload events for context
            const recentUploads = await this.getUploadHistory({ limit: 5 });

            // Add trend analysis if we have enough data
            const trendData = await this._calculateTrends(filters);

            return {
                ...fixedData,
                recent_uploads: recentUploads,
                trends: trendData
            };
        } catch (error) {
            console.error('Failed to generate fixed vulnerability report:', error);
            throw new Error(`Report generation failed: ${error.message}`);
        }
    }

    /**
     * Calculate trend data for fixed vulnerabilities over time
     *
     * @param {object} filters - Base filters
     * @returns {Promise<object>} Trend analysis data
     */
    async _calculateTrends(filters) {
        // This is a simplified implementation
        // In practice, you'd want to analyze trends over time periods
        try {
            const last30Days = new Date();
            last30Days.setDate(last30Days.getDate() - 30);

            const recentFixed = await this.findFixedVulnerabilities({
                ...filters,
                fixedAfter: last30Days.toISOString().split('T')[0],
                limit: 1000  // Get more data for trend analysis
            });

            return {
                fixed_last_30_days: recentFixed.data.length,
                avg_fix_time_last_30_days: recentFixed.summary.avg_days_active
            };
        } catch (error) {
            console.warn('Failed to calculate trends:', error);
            return {
                fixed_last_30_days: 0,
                avg_fix_time_last_30_days: 0
            };
        }
    }

    /**
     * Health check for the history service
     * Validates database connectivity and basic functionality
     *
     * @returns {Promise<object>} Health status
     */
    async healthCheck() {
        try {
            // Test basic database connectivity
            await this.db.getUploadEvents({ limit: 1 });

            // Test history table access
            await this.db.getFixedVulnerabilities({ limit: 1 });

            return {
                status: 'healthy',
                message: 'History service is operational',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'error',
                message: `History service error: ${error.message}`,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = HistoryService;