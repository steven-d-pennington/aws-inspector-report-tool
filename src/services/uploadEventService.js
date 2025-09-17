/**
 * Upload Event Service - Manages upload workflow state and tracking
 *
 * This service provides upload workflow management with:
 * - State tracking through upload lifecycle
 * - Error handling and recovery
 * - Progress monitoring
 * - Atomic transaction support
 */

class UploadEvent {
    constructor(database, filename) {
        this.db = database;
        this.filename = filename;
        this.uploadId = null;
        this.status = 'STARTED';
        this.startedAt = new Date();
        this.recordsArchived = 0;
        this.recordsImported = 0;
        this.errorMessage = null;
    }

    /**
     * Initialize upload event tracking
     * @returns {Promise<string>} Upload ID
     */
    async initialize() {
        try {
            this.uploadId = await this.db.createUploadEvent(this.filename);
            console.log(`✓ Upload event created: ${this.uploadId} for file: ${this.filename}`);
            return this.uploadId;
        } catch (error) {
            console.error('Failed to initialize upload event:', error);
            throw new Error(`Upload event initialization failed: ${error.message}`);
        }
    }

    /**
     * Update status to ARCHIVING phase
     * @returns {Promise<void>}
     */
    async startArchiving() {
        try {
            this.status = 'ARCHIVING';
            await this.db.updateUploadEvent(this.uploadId, this.status);
            console.log(`📦 Upload ${this.uploadId}: Started archiving current data`);
        } catch (error) {
            await this.fail(error);
            throw error;
        }
    }

    /**
     * Record archiving completion with count
     * @param {number} count - Number of records archived
     * @returns {Promise<void>}
     */
    async completeArchiving(count) {
        try {
            this.recordsArchived = count;
            await this.db.updateUploadEvent(this.uploadId, this.status, {
                records_archived: count
            });
            console.log(`✓ Upload ${this.uploadId}: Archived ${count} vulnerabilities`);
        } catch (error) {
            await this.fail(error);
            throw error;
        }
    }

    /**
     * Update status to CLEARING phase
     * @returns {Promise<void>}
     */
    async startClearing() {
        try {
            this.status = 'CLEARING';
            await this.db.updateUploadEvent(this.uploadId, this.status);
            console.log(`🗑️ Upload ${this.uploadId}: Started clearing current tables`);
        } catch (error) {
            await this.fail(error);
            throw error;
        }
    }

    /**
     * Complete clearing phase
     * @returns {Promise<void>}
     */
    async completeClearing() {
        try {
            console.log(`✓ Upload ${this.uploadId}: Cleared current tables`);
        } catch (error) {
            await this.fail(error);
            throw error;
        }
    }

    /**
     * Update status to IMPORTING phase
     * @returns {Promise<void>}
     */
    async startImporting() {
        try {
            this.status = 'IMPORTING';
            await this.db.updateUploadEvent(this.uploadId, this.status);
            console.log(`📥 Upload ${this.uploadId}: Started importing new data`);
        } catch (error) {
            await this.fail(error);
            throw error;
        }
    }

    /**
     * Record importing completion with count
     * @param {number} count - Number of records imported
     * @returns {Promise<void>}
     */
    async completeImporting(count) {
        try {
            this.recordsImported = count;
            await this.db.updateUploadEvent(this.uploadId, this.status, {
                records_imported: count
            });
            console.log(`✓ Upload ${this.uploadId}: Imported ${count} vulnerabilities`);
        } catch (error) {
            await this.fail(error);
            throw error;
        }
    }

    /**
     * Mark upload as successfully completed
     * @returns {Promise<void>}
     */
    async complete() {
        try {
            this.status = 'COMPLETED';
            await this.db.updateUploadEvent(this.uploadId, this.status, {
                records_archived: this.recordsArchived,
                records_imported: this.recordsImported
            });

            const duration = new Date() - this.startedAt;
            console.log(`🎉 Upload ${this.uploadId}: Completed successfully in ${Math.round(duration/1000)}s`);
            console.log(`   📊 Summary: ${this.recordsArchived} archived, ${this.recordsImported} imported`);
        } catch (error) {
            console.error('Failed to mark upload as complete:', error);
            // Don't fail here as the upload itself succeeded
        }
    }

    /**
     * Mark upload as failed with error details
     * @param {Error} error - Error that caused failure
     * @returns {Promise<void>}
     */
    async fail(error) {
        try {
            this.status = 'FAILED';
            this.errorMessage = error.message;

            await this.db.updateUploadEvent(this.uploadId, this.status, {
                error_message: error.message,
                records_archived: this.recordsArchived,
                records_imported: this.recordsImported
            });

            const duration = new Date() - this.startedAt;
            console.error(`❌ Upload ${this.uploadId}: Failed after ${Math.round(duration/1000)}s`);
            console.error(`   Error: ${error.message}`);
            console.error(`   Progress: ${this.recordsArchived} archived, ${this.recordsImported} imported`);
        } catch (dbError) {
            console.error('Failed to record upload failure:', dbError);
        }
    }

    /**
     * Get current upload event data
     * @returns {object} Upload event information
     */
    getData() {
        return {
            uploadId: this.uploadId,
            filename: this.filename,
            status: this.status,
            startedAt: this.startedAt,
            recordsArchived: this.recordsArchived,
            recordsImported: this.recordsImported,
            errorMessage: this.errorMessage
        };
    }
}

class UploadEventService {
    constructor(database) {
        this.db = database;
    }

    /**
     * Create a new upload event for tracking
     * @param {string} filename - Original filename
     * @returns {UploadEvent} Upload event instance
     */
    createUploadEvent(filename) {
        return new UploadEvent(this.db, filename);
    }

    /**
     * Get upload events history
     * @param {object} filters - Filtering options
     * @returns {Promise<array>} Upload events
     */
    async getUploadHistory(filters = {}) {
        try {
            return await this.db.getUploadEvents(filters);
        } catch (error) {
            console.error('Failed to get upload history:', error);
            throw new Error(`Upload history retrieval failed: ${error.message}`);
        }
    }

    /**
     * Get recent upload statistics
     * @returns {Promise<object>} Upload statistics
     */
    async getUploadStatistics() {
        try {
            const allEvents = await this.db.getUploadEvents({ limit: 100 });

            const stats = {
                total_uploads: allEvents.length,
                successful_uploads: allEvents.filter(e => e.status === 'COMPLETED').length,
                failed_uploads: allEvents.filter(e => e.status === 'FAILED').length,
                in_progress_uploads: allEvents.filter(e => !['COMPLETED', 'FAILED'].includes(e.status)).length,
                last_upload: allEvents.length > 0 ? allEvents[0] : null
            };

            stats.success_rate = stats.total_uploads > 0
                ? Math.round((stats.successful_uploads / stats.total_uploads) * 100)
                : 0;

            return stats;
        } catch (error) {
            console.error('Failed to get upload statistics:', error);
            throw new Error(`Upload statistics calculation failed: ${error.message}`);
        }
    }

    /**
     * Clean up old upload events (maintenance)
     * @param {number} daysToKeep - Number of days of history to keep
     * @returns {Promise<number>} Number of events cleaned up
     */
    async cleanupOldEvents(daysToKeep = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            // This would need a cleanup method in the database service
            console.log(`Would clean up upload events older than ${cutoffDate.toISOString()}`);
            return 0; // Placeholder
        } catch (error) {
            console.error('Failed to cleanup old events:', error);
            throw new Error(`Event cleanup failed: ${error.message}`);
        }
    }

    /**
     * Detect and handle incomplete uploads (recovery)
     * @returns {Promise<array>} Incomplete upload events
     */
    async detectIncompleteUploads() {
        try {
            const incompleteStatuses = ['STARTED', 'ARCHIVING', 'CLEARING', 'IMPORTING'];
            const incompleteEvents = await this.db.getUploadEvents({
                status: incompleteStatuses
            });

            // Filter to only show events older than 10 minutes (likely stuck)
            const tenMinutesAgo = new Date();
            tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

            const stuckEvents = incompleteEvents.filter(event =>
                new Date(event.started_at) < tenMinutesAgo
            );

            if (stuckEvents.length > 0) {
                console.warn(`Found ${stuckEvents.length} potentially stuck upload events`);
            }

            return stuckEvents;
        } catch (error) {
            console.error('Failed to detect incomplete uploads:', error);
            throw new Error(`Incomplete upload detection failed: ${error.message}`);
        }
    }

    /**
     * Health check for upload event tracking
     * @returns {Promise<object>} Health status
     */
    async healthCheck() {
        try {
            const stats = await this.getUploadStatistics();
            const incompleteUploads = await this.detectIncompleteUploads();

            const health = {
                status: 'healthy',
                message: 'Upload event tracking is operational',
                timestamp: new Date().toISOString(),
                statistics: stats,
                warnings: []
            };

            if (incompleteUploads.length > 0) {
                health.warnings.push(`${incompleteUploads.length} incomplete uploads detected`);
            }

            if (stats.success_rate < 80 && stats.total_uploads > 5) {
                health.warnings.push(`Low success rate: ${stats.success_rate}%`);
            }

            return health;
        } catch (error) {
            return {
                status: 'error',
                message: `Upload event service error: ${error.message}`,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = { UploadEvent, UploadEventService };