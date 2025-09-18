const cron = require('node-cron');
const { DatabaseMonitor } = require('./db_monitor');
const { runBackup } = require('./backup_script');
const { getPool } = require('./db_pool');

class MaintenanceScheduler {
    constructor(config = {}) {
        this.config = {
            host: config.host || 'localhost',
            port: config.port || 5432,
            user: config.user || 'report_gen',
            password: config.password || 'StarDust',
            database: config.database || 'vulnerability_reports'
        };

        this.monitor = new DatabaseMonitor(this.config);
        this.pool = getPool(this.config);
        this.jobs = new Map();
    }

    async runVacuum() {
        console.log('[MAINTENANCE] Starting VACUUM operation...');
        try {
            await this.pool.query('VACUUM ANALYZE;');
            console.log('[MAINTENANCE] VACUUM completed successfully');
        } catch (error) {
            console.error('[MAINTENANCE] VACUUM failed:', error.message);
        }
    }

    async runReindex() {
        console.log('[MAINTENANCE] Starting REINDEX operation...');
        try {
            await this.pool.query('REINDEX DATABASE vulnerability_reports;');
            console.log('[MAINTENANCE] REINDEX completed successfully');
        } catch (error) {
            console.error('[MAINTENANCE] REINDEX failed:', error.message);
        }
    }

    async updateStatistics() {
        console.log('[MAINTENANCE] Updating table statistics...');
        try {
            await this.pool.query('ANALYZE;');
            console.log('[MAINTENANCE] Statistics updated successfully');
        } catch (error) {
            console.error('[MAINTENANCE] Statistics update failed:', error.message);
        }
    }

    async cleanupOldConnections() {
        console.log('[MAINTENANCE] Cleaning up old connections...');
        try {
            const result = await this.pool.query(`
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = $1
                    AND state = 'idle'
                    AND state_change < NOW() - INTERVAL '1 hour'
                    AND pid != pg_backend_pid()
            `, [this.config.database]);

            console.log(`[MAINTENANCE] Terminated ${result.rowCount} idle connections`);
        } catch (error) {
            console.error('[MAINTENANCE] Connection cleanup failed:', error.message);
        }
    }

    async performHealthCheck() {
        console.log('[MAINTENANCE] Performing health check...');
        try {
            await this.monitor.connect();
            const health = await this.monitor.checkHealth();

            if (health.healthy) {
                console.log('[MAINTENANCE] Health check: HEALTHY');
            } else {
                console.error('[MAINTENANCE] Health check: UNHEALTHY');
                console.error('Issues:', health.issues);
                console.error('Warnings:', health.warnings);

                // Send alert (implement your alerting mechanism)
                await this.sendAlert('Database health check failed', health);
            }

            await this.monitor.disconnect();
        } catch (error) {
            console.error('[MAINTENANCE] Health check failed:', error.message);
        }
    }

    async sendAlert(subject, data) {
        // Implement your alerting mechanism here
        // This could be email, Slack, PagerDuty, etc.
        console.log(`[ALERT] ${subject}:`, JSON.stringify(data, null, 2));
    }

    async performDailyMaintenance() {
        console.log('\n=== Starting Daily Maintenance ===');
        const startTime = Date.now();

        try {
            // 1. Health check
            await this.performHealthCheck();

            // 2. Backup
            console.log('[MAINTENANCE] Running daily backup...');
            await runBackup();

            // 3. Update statistics
            await this.updateStatistics();

            // 4. Cleanup old connections
            await this.cleanupOldConnections();

            // 5. Log completion
            const duration = Date.now() - startTime;
            console.log(`=== Daily Maintenance Completed in ${duration}ms ===\n`);

        } catch (error) {
            console.error('[MAINTENANCE] Daily maintenance failed:', error.message);
            await this.sendAlert('Daily maintenance failed', { error: error.message });
        }
    }

    async performWeeklyMaintenance() {
        console.log('\n=== Starting Weekly Maintenance ===');
        const startTime = Date.now();

        try {
            // 1. Full vacuum
            await this.runVacuum();

            // 2. Reindex
            await this.runReindex();

            // 3. Detailed monitoring report
            await this.monitor.connect();
            const report = await this.monitor.getDetailedReport();
            await this.monitor.disconnect();

            console.log('[MAINTENANCE] Weekly report generated');
            console.log('Database size:', report.database_size);
            console.log('Table count:', report.table_sizes.length);

            const duration = Date.now() - startTime;
            console.log(`=== Weekly Maintenance Completed in ${duration}ms ===\n`);

        } catch (error) {
            console.error('[MAINTENANCE] Weekly maintenance failed:', error.message);
            await this.sendAlert('Weekly maintenance failed', { error: error.message });
        }
    }

    scheduleJobs() {
        // Daily backup at 2:00 AM
        const dailyBackup = cron.schedule('0 2 * * *', async () => {
            await this.performDailyMaintenance();
        }, { scheduled: false });

        // Weekly maintenance on Sunday at 3:00 AM
        const weeklyMaintenance = cron.schedule('0 3 * * 0', async () => {
            await this.performWeeklyMaintenance();
        }, { scheduled: false });

        // Health check every 15 minutes during business hours (9-17)
        const healthCheck = cron.schedule('*/15 9-17 * * 1-5', async () => {
            await this.performHealthCheck();
        }, { scheduled: false });

        // Statistics update every 6 hours
        const statsUpdate = cron.schedule('0 */6 * * *', async () => {
            await this.updateStatistics();
        }, { scheduled: false });

        this.jobs.set('dailyBackup', dailyBackup);
        this.jobs.set('weeklyMaintenance', weeklyMaintenance);
        this.jobs.set('healthCheck', healthCheck);
        this.jobs.set('statsUpdate', statsUpdate);

        console.log('Maintenance jobs scheduled:');
        console.log('- Daily backup: 2:00 AM every day');
        console.log('- Weekly maintenance: 3:00 AM every Sunday');
        console.log('- Health checks: Every 15 minutes (9-17, Mon-Fri)');
        console.log('- Statistics update: Every 6 hours');
    }

    start() {
        this.scheduleJobs();

        // Start all scheduled jobs
        this.jobs.forEach((job, name) => {
            job.start();
            console.log(`Started job: ${name}`);
        });
    }

    stop() {
        // Stop all scheduled jobs
        this.jobs.forEach((job, name) => {
            job.stop();
            console.log(`Stopped job: ${name}`);
        });

        // Close database connections
        this.pool.close();
    }

    // Manual maintenance commands
    async runManualMaintenance() {
        console.log('\n=== Running Manual Maintenance ===');
        await this.performDailyMaintenance();
        await this.performWeeklyMaintenance();
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, stopping maintenance scheduler...');
    if (global.maintenanceScheduler) {
        global.maintenanceScheduler.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, stopping maintenance scheduler...');
    if (global.maintenanceScheduler) {
        global.maintenanceScheduler.stop();
    }
    process.exit(0);
});

module.exports = { MaintenanceScheduler };

// Run scheduler if called directly
if (require.main === module) {
    const scheduler = new MaintenanceScheduler();
    global.maintenanceScheduler = scheduler;

    // Check if --manual flag is provided
    if (process.argv.includes('--manual')) {
        scheduler.runManualMaintenance().then(() => {
            console.log('Manual maintenance completed');
            process.exit(0);
        }).catch(error => {
            console.error('Manual maintenance failed:', error);
            process.exit(1);
        });
    } else {
        console.log('Starting maintenance scheduler...');
        scheduler.start();

        // Keep the process running
        console.log('Maintenance scheduler is running. Press Ctrl+C to stop.');
    }
}