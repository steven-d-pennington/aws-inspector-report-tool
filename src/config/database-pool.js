/**
 * PostgreSQL Database Connection Pool Configuration
 * Provides connection pooling, health checks, and transaction support
 */

const { Pool } = require('pg');

class DatabasePool {
    constructor() {
        this.pool = null;
        this.isConnected = false;
        this.connectionRetries = 0;
        this.maxRetries = 5;
        this.retryDelay = 2000; // 2 seconds
    }

    /**
     * Initialize connection pool with configuration from environment
     */
    async initialize() {
        const parseBoolean = (value, defaultValue = false) => {
            if (value === undefined || value === null) {
                return defaultValue;
            }

            if (typeof value === 'boolean') {
                return value;
            }

            return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase().trim());
        };

        const sslEnabled = parseBoolean(process.env.DB_SSL, false);
        const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED;

        const config = {
            host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT, 10) || 5432,
            database: process.env.DB_NAME || process.env.POSTGRES_DB || 'vulnerability_reports',
            user: process.env.DB_USER || process.env.POSTGRES_USER || 'report_gen',
            password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'StarDust',
            max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
            idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 10) || 30000,
            connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT, 10) || 2000,
            // Additional PostgreSQL-specific optimizations
            keepAlive: true,
            keepAliveInitialDelayMillis: 10000,
            ssl: sslEnabled
                ? (rejectUnauthorized !== undefined
                    ? { rejectUnauthorized: parseBoolean(rejectUnauthorized, true) }
                    : true)
                : false
        };

        console.log('🔄 Initializing PostgreSQL connection pool...');
        const safeConfig = {
            ...config,
            password: config.password ? '***' : undefined,
            ssl: config.ssl ? (typeof config.ssl === 'object' ? { ...config.ssl } : config.ssl) : false
        };
        console.log(
            `📊 Pool config: host=${safeConfig.host}, port=${safeConfig.port}, db=${safeConfig.database}, user=${safeConfig.user}, max=${safeConfig.max}, idle=${safeConfig.idleTimeoutMillis}ms, timeout=${safeConfig.connectionTimeoutMillis}ms, ssl=${sslEnabled}`
        );

        this.pool = new Pool(config);

        // Set up event handlers
        this.pool.on('connect', (client) => {
            console.log('🔗 New PostgreSQL client connected');
        });

        this.pool.on('error', (err, client) => {
            console.error('💥 PostgreSQL pool error:', err);
            this.isConnected = false;
        });

        this.pool.on('remove', (client) => {
            console.log('🗑️ PostgreSQL client removed from pool');
        });

        // Test initial connection
        await this.testConnection();

        console.log('✅ PostgreSQL connection pool initialized successfully');
        return this;
    }

    /**
     * Test database connection and retry if needed
     */
    async testConnection() {
        try {
            const client = await this.pool.connect();
            const result = await client.query('SELECT NOW(), version()');
            client.release();

            this.isConnected = true;
            this.connectionRetries = 0;

            console.log('✅ Database connection test successful');
            console.log(`🕐 Server time: ${result.rows[0].now}`);
            console.log(`🔧 PostgreSQL version: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);

            return true;
        } catch (error) {
            this.isConnected = false;
            this.connectionRetries++;

            console.error(`❌ Database connection test failed (attempt ${this.connectionRetries}/${this.maxRetries}):`, error.message);

            if (this.connectionRetries < this.maxRetries) {
                console.log(`⏳ Retrying in ${this.retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return await this.testConnection();
            } else {
                throw new Error(`Failed to connect to PostgreSQL after ${this.maxRetries} attempts: ${error.message}`);
            }
        }
    }

    /**
     * Get a client from the pool
     */
    async getClient() {
        if (!this.isConnected) {
            await this.testConnection();
        }
        return await this.pool.connect();
    }

    /**
     * Execute a query with automatic client management
     */
    async query(text, params = []) {
        const client = await this.getClient();
        try {
            const start = Date.now();
            const result = await client.query(text, params);
            const duration = Date.now() - start;

            // Log slow queries
            if (duration > 1000) {
                console.warn(`🐌 Slow query detected (${duration}ms): ${text.substring(0, 100)}...`);
            }

            return result;
        } finally {
            client.release();
        }
    }

    /**
     * Execute multiple queries in a transaction
     */
    async executeTransaction(callback) {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('🔄 Transaction rolled back due to error:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get current pool statistics
     */
    getPoolStats() {
        if (!this.pool) {
            return null;
        }

        return {
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount,
            maxCount: this.pool.options.max,
            isConnected: this.isConnected
        };
    }

    /**
     * Health check for monitoring
     */
    async healthCheck() {
        try {
            const stats = this.getPoolStats();
            if (!stats) {
                return { healthy: false, error: 'Pool not initialized' };
            }

            // Quick query test
            const result = await this.query('SELECT 1 as health_check');
            const isHealthy = result.rows[0]?.health_check === 1;

            return {
                healthy: isHealthy,
                stats: stats,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Graceful shutdown
     */
    async close() {
        if (this.pool) {
            console.log('🔄 Closing PostgreSQL connection pool...');
            await this.pool.end();
            this.isConnected = false;
            console.log('✅ PostgreSQL connection pool closed');
        }
    }
}

// Singleton instance
let dbPool = null;

/**
 * Get or create the database pool instance
 */
async function getPool() {
    if (!dbPool) {
        dbPool = new DatabasePool();
        await dbPool.initialize();
    }
    return dbPool;
}

/**
 * Close the database pool (for graceful shutdown)
 */
async function closePool() {
    if (dbPool) {
        await dbPool.close();
        dbPool = null;
    }
}

module.exports = {
    DatabasePool,
    getPool,
    closePool
};