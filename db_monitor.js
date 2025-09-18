const { Client } = require('pg');

class DatabaseMonitor {
    constructor(config) {
        this.config = {
            host: config.host || 'localhost',
            port: config.port || 5432,
            user: config.user || 'report_gen',
            password: config.password || 'StarDust',
            database: config.database || 'vulnerability_reports'
        };
        this.client = null;
    }

    async connect() {
        this.client = new Client(this.config);
        await this.client.connect();
    }

    async disconnect() {
        if (this.client) {
            await this.client.end();
        }
    }

    async getConnectionStats() {
        const query = `
            SELECT
                count(*) as total_connections,
                count(*) FILTER (WHERE state = 'active') as active_connections,
                count(*) FILTER (WHERE state = 'idle') as idle_connections,
                count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
            FROM pg_stat_activity
            WHERE datname = $1
        `;
        const result = await this.client.query(query, [this.config.database]);
        return result.rows[0];
    }

    async getDatabaseSize() {
        const query = `
            SELECT
                pg_size_pretty(pg_database_size($1)) as size,
                pg_database_size($1) as size_bytes
        `;
        const result = await this.client.query(query, [this.config.database]);
        return result.rows[0];
    }

    async getTableSizes() {
        const query = `
            SELECT
                schemaname,
                tablename,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
                pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        `;
        const result = await this.client.query(query);
        return result.rows;
    }

    async getLockStats() {
        const query = `
            SELECT
                mode,
                count(*) as lock_count
            FROM pg_locks
            WHERE database = (SELECT oid FROM pg_database WHERE datname = $1)
            GROUP BY mode
            ORDER BY count(*) DESC
        `;
        const result = await this.client.query(query, [this.config.database]);
        return result.rows;
    }

    async getSlowQueries(threshold_ms = 1000) {
        const query = `
            SELECT
                query,
                state,
                query_start,
                state_change,
                extract(epoch from (now() - query_start)) * 1000 as duration_ms
            FROM pg_stat_activity
            WHERE datname = $1
                AND state = 'active'
                AND extract(epoch from (now() - query_start)) * 1000 > $2
            ORDER BY query_start
        `;
        const result = await this.client.query(query, [this.config.database, threshold_ms]);
        return result.rows;
    }

    async getReplicationStatus() {
        // Only works if this is a master server with replicas
        const query = `
            SELECT
                client_addr,
                state,
                sent_lsn,
                write_lsn,
                flush_lsn,
                replay_lsn,
                sync_state,
                pg_wal_lsn_diff(sent_lsn, replay_lsn) as lag_bytes
            FROM pg_stat_replication
        `;
        try {
            const result = await this.client.query(query);
            return result.rows;
        } catch (error) {
            // Replication views might not be accessible
            return [];
        }
    }

    async getDetailedReport() {
        const report = {
            timestamp: new Date().toISOString(),
            connections: await this.getConnectionStats(),
            database_size: await this.getDatabaseSize(),
            table_sizes: await this.getTableSizes(),
            locks: await this.getLockStats(),
            slow_queries: await this.getSlowQueries(),
            replication: await this.getReplicationStatus()
        };
        return report;
    }

    async checkHealth() {
        const health = {
            healthy: true,
            issues: [],
            warnings: []
        };

        try {
            // Check connections
            const connections = await this.getConnectionStats();
            if (connections.total_connections > 80) {
                health.warnings.push(`High connection count: ${connections.total_connections}`);
            }
            if (connections.idle_in_transaction > 5) {
                health.issues.push(`Too many idle in transaction: ${connections.idle_in_transaction}`);
                health.healthy = false;
            }

            // Check slow queries
            const slowQueries = await this.getSlowQueries(5000); // 5 second threshold
            if (slowQueries.length > 0) {
                health.warnings.push(`${slowQueries.length} slow queries detected`);
            }

            // Check database size
            const dbSize = await this.getDatabaseSize();
            if (dbSize.size_bytes > 10 * 1024 * 1024 * 1024) { // 10GB
                health.warnings.push(`Large database size: ${dbSize.size}`);
            }

        } catch (error) {
            health.healthy = false;
            health.issues.push(`Monitor check failed: ${error.message}`);
        }

        return health;
    }
}

async function runMonitoring() {
    const monitor = new DatabaseMonitor({
        host: 'localhost',
        port: 5432,
        user: 'report_gen',
        password: 'StarDust',
        database: 'vulnerability_reports'
    });

    try {
        await monitor.connect();

        console.log('=== Database Health Check ===');
        const health = await monitor.checkHealth();
        console.log(`Status: ${health.healthy ? 'HEALTHY' : 'UNHEALTHY'}`);

        if (health.warnings.length > 0) {
            console.log('Warnings:');
            health.warnings.forEach(warning => console.log(`  - ${warning}`));
        }

        if (health.issues.length > 0) {
            console.log('Issues:');
            health.issues.forEach(issue => console.log(`  - ${issue}`));
        }

        console.log('\n=== Connection Stats ===');
        const connections = await monitor.getConnectionStats();
        console.log(connections);

        console.log('\n=== Database Size ===');
        const dbSize = await monitor.getDatabaseSize();
        console.log(dbSize);

        console.log('\n=== Table Sizes ===');
        const tableSizes = await monitor.getTableSizes();
        console.table(tableSizes);

    } catch (error) {
        console.error('Monitoring failed:', error.message);
    } finally {
        await monitor.disconnect();
    }
}

module.exports = { DatabaseMonitor, runMonitoring };

// Run monitoring if called directly
if (require.main === module) {
    runMonitoring();
}