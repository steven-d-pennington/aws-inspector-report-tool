/**
 * PostgreSQL Database Connection Pool Configuration
 * Provides connection pooling, health checks, and transaction support
 */

const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Ensure environment variables from the project root .env file are loaded
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Import our centralized environment configuration
const environmentConfig = require('./environment');

function parseBoolean(value, fallback = false) {
    if (value === undefined || value === null) {
        return fallback;
    }
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
        return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
        return false;
    }
    return fallback;
}

function parseInteger(value, fallback) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

function parseDatabaseUrl(url) {
    if (!url) {
        return {};
    }

    try {
        const parsed = new URL(url);
        const result = {
            host: parsed.hostname || undefined,
            port: parsed.port ? parseInteger(parsed.port, undefined) : undefined,
            user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
            password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
            database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : undefined
        };

        const sslParam = parsed.searchParams.get('ssl');
        const sslMode = parsed.searchParams.get('sslmode');
        if (sslParam !== null) {
            result.ssl = parseBoolean(sslParam, undefined);
        } else if (sslMode) {
            const normalized = sslMode.toLowerCase();
            if (['require', 'verify-ca', 'verify-full'].includes(normalized)) {
                result.ssl = true;
            } else if (['disable', 'allow', 'prefer'].includes(normalized)) {
                result.ssl = false;
            }
        }

        return result;
    } catch (error) {
        console.warn('[db] DATABASE_URL parse error:', error.message);
        return {};
    }
}

class DatabasePool {
    constructor() {
        this.pool = null;
        this.poolConfig = null;
        this.connectionInfo = null;
        this.isConnected = false;
        this.connectionRetries = 0;
        this.maxRetries = 5;
        this.retryDelay = 2000; // 2 seconds
    }

    buildConfig() {
        // Use centralized environment configuration
        const dbConfig = environmentConfig.getConfig('database');

        const connectionString =
            process.env.DATABASE_URL ||
            process.env.DB_URL ||
            process.env.PG_URL ||
            process.env.PG_CONNECTION_STRING ||
            process.env.POSTGRES_CONNECTION_STRING;

        const parsedUrlConfig = parseDatabaseUrl(connectionString);

        const host = dbConfig.host || parsedUrlConfig.host || 'localhost';
        const port = parseInteger(
            process.env.POSTGRES_PORT || process.env.DB_PORT,
            parsedUrlConfig.port ?? 5432
        );
        const user =
            process.env.POSTGRES_USER ||
            process.env.DB_USER ||
            parsedUrlConfig.user ||
            'report_gen';
        const password =
            process.env.POSTGRES_PASSWORD ||
            process.env.DB_PASSWORD ||
            parsedUrlConfig.password ||
            'StarDust';
        const database =
            process.env.POSTGRES_DB ||
            process.env.DB_NAME ||
            parsedUrlConfig.database ||
            'vulnerability_reports';

        const sslEnv =
            process.env.DB_SSL !== undefined
                ? parseBoolean(process.env.DB_SSL, false)
                : process.env.PGSSL !== undefined
                    ? parseBoolean(process.env.PGSSL, false)
                    : parsedUrlConfig.ssl;

        const poolConfig = {
            host,
            port,
            database,
            user,
            password,
            max: parseInteger(process.env.DB_POOL_MAX, 20),
            idleTimeoutMillis: parseInteger(process.env.DB_POOL_IDLE_TIMEOUT, 30000),
            connectionTimeoutMillis: parseInteger(process.env.DB_POOL_CONNECTION_TIMEOUT, 2000),
            keepAlive: true,
            keepAliveInitialDelayMillis: parseInteger(process.env.DB_POOL_KEEPALIVE_DELAY, 10000)
        };

        if (sslEnv !== undefined) {
            poolConfig.ssl = sslEnv;
        }

        const applicationName = process.env.DB_APP_NAME || process.env.PGAPPNAME;
        if (applicationName) {
            poolConfig.application_name = applicationName;
        }

        if (connectionString) {
            poolConfig.connectionString = connectionString;
        }

        const connectionInfo = {
            host,
            port,
            database,
            user,
            ssl: poolConfig.ssl === true || (poolConfig.ssl && poolConfig.ssl.ssl === true)
        };

        return { poolConfig, connectionInfo };
    }

    /**
     * Initialize connection pool with configuration from environment
     */
    async initialize() {
        const { poolConfig, connectionInfo } = this.buildConfig();
        this.poolConfig = poolConfig;
        this.connectionInfo = connectionInfo;

        console.log('[db] Initializing PostgreSQL connection pool...');
        console.log(
            `[db] Host=${connectionInfo.host} Port=${connectionInfo.port} Database=${connectionInfo.database} User=${connectionInfo.user} SSL=${connectionInfo.ssl}`
        );

        this.pool = new Pool(this.poolConfig);

        // Set up event handlers
        this.pool.on('connect', () => {
            console.log('[db] New PostgreSQL client connected');
        });

        this.pool.on('error', (err) => {
            console.error('[db] PostgreSQL pool error:', err);
            this.isConnected = false;
        });

        this.pool.on('remove', () => {
            console.log('[db] PostgreSQL client removed from pool');
        });

        // Test initial connection
        await this.testConnection();

        console.log('[db] PostgreSQL connection pool initialized successfully');
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

            console.log('[db] Database connection test successful');
            console.log(`[db] Server time: ${result.rows[0].now}`);
            console.log(`[db] PostgreSQL version: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);

            return true;
        } catch (error) {
            this.isConnected = false;
            this.connectionRetries++;

            console.error(
                `[db] Database connection test failed (attempt ${this.connectionRetries}/${this.maxRetries}):`,
                error.message
            );

            if (this.connectionRetries < this.maxRetries) {
                console.log(`[db] Retrying in ${this.retryDelay}ms...`);
                await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
                return await this.testConnection();
            }

            throw new Error(
                `Failed to connect to PostgreSQL after ${this.maxRetries} attempts: ${error.message}`
            );
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

            if (duration > 1000) {
                console.warn(`[db] Slow query detected (${duration}ms): ${text.substring(0, 100)}...`);
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
            console.error('[db] Transaction rolled back due to error:', error.message);
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
            isConnected: this.isConnected,
            host: this.connectionInfo?.host,
            database: this.connectionInfo?.database
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

            const result = await this.query('SELECT 1 as health_check');
            const isHealthy = result.rows[0]?.health_check === 1;

            return {
                healthy: isHealthy,
                stats,
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
            console.log('[db] Closing PostgreSQL connection pool...');
            await this.pool.end();
            this.isConnected = false;
            console.log('[db] PostgreSQL connection pool closed');
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
