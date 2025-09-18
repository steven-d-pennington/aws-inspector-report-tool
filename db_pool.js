const { Pool } = require('pg');

class DatabasePool {
    constructor(config = {}) {
        this.poolConfig = {
            host: config.host || 'localhost',
            port: config.port || 5432,
            user: config.user || 'report_gen',
            password: config.password || 'StarDust',
            database: config.database || 'vulnerability_reports',

            // Connection pool settings
            max: config.max || 10,           // Maximum number of connections
            min: config.min || 2,            // Minimum number of connections
            idleTimeoutMillis: config.idleTimeoutMillis || 30000,  // 30 seconds
            connectionTimeoutMillis: config.connectionTimeoutMillis || 5000,  // 5 seconds
            acquireTimeoutMillis: config.acquireTimeoutMillis || 10000,  // 10 seconds

            // SSL configuration (adjust for production)
            ssl: config.ssl || false,

            // Application name for monitoring
            application_name: config.application_name || 'vulnerability_dashboard'
        };

        this.pool = new Pool(this.poolConfig);

        // Event handlers for monitoring
        this.pool.on('connect', (client) => {
            console.log('New client connected to database');
        });

        this.pool.on('acquire', (client) => {
            console.log('Client acquired from pool');
        });

        this.pool.on('error', (err, client) => {
            console.error('Unexpected error on idle client', err);
        });

        this.pool.on('remove', (client) => {
            console.log('Client removed from pool');
        });
    }

    async query(text, params) {
        const start = Date.now();
        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;

            // Log slow queries
            if (duration > 1000) {
                console.warn(`Slow query detected (${duration}ms):`, text);
            }

            return result;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    async getClient() {
        return await this.pool.connect();
    }

    async transaction(callback) {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async getPoolStats() {
        return {
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount
        };
    }

    async healthCheck() {
        try {
            const result = await this.query('SELECT NOW() as current_time');
            return {
                healthy: true,
                timestamp: result.rows[0].current_time,
                poolStats: await this.getPoolStats()
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                poolStats: await this.getPoolStats()
            };
        }
    }

    async close() {
        await this.pool.end();
        console.log('Database pool closed');
    }
}

// Singleton instance for application use
let dbPool = null;

function getPool(config) {
    if (!dbPool) {
        dbPool = new DatabasePool(config);
    }
    return dbPool;
}

// Graceful shutdown handler
process.on('SIGINT', async () => {
    console.log('Received SIGINT, closing database pool...');
    if (dbPool) {
        await dbPool.close();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, closing database pool...');
    if (dbPool) {
        await dbPool.close();
    }
    process.exit(0);
});

module.exports = { DatabasePool, getPool };

// Example usage
if (require.main === module) {
    async function demo() {
        const pool = new DatabasePool();

        try {
            // Test basic query
            const result = await pool.query('SELECT version()');
            console.log('PostgreSQL version:', result.rows[0].version);

            // Test health check
            const health = await pool.healthCheck();
            console.log('Health check:', health);

            // Test transaction
            await pool.transaction(async (client) => {
                await client.query('CREATE TABLE IF NOT EXISTS test_table (id SERIAL, name TEXT)');
                await client.query('INSERT INTO test_table (name) VALUES ($1)', ['test']);
                console.log('Transaction completed successfully');
            });

        } catch (error) {
            console.error('Demo failed:', error);
        } finally {
            await pool.close();
        }
    }

    demo();
}