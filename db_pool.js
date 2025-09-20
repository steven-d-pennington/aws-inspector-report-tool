const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Load environment variables from the project root .env file
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

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
        const sslParam = parsed.searchParams.get('ssl');
        const sslMode = parsed.searchParams.get('sslmode');

        let ssl;
        if (sslParam !== null) {
            ssl = parseBoolean(sslParam, undefined);
        } else if (sslMode) {
            const normalized = sslMode.toLowerCase();
            ssl = ['require', 'verify-ca', 'verify-full'].includes(normalized);
        }

        return {
            connectionString: url,
            host: parsed.hostname || undefined,
            port: parsed.port ? parseInteger(parsed.port, undefined) : undefined,
            user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
            password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
            database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : undefined,
            ssl
        };
    } catch (error) {
        console.warn('DATABASE_URL parse error:', error.message);
        return {};
    }
}

const databaseUrlConfig = parseDatabaseUrl(
    process.env.DATABASE_URL || process.env.DB_URL || process.env.PG_URL
);

const envDefaults = {
    connectionString:
        process.env.PG_CONNECTION_STRING ||
        process.env.POSTGRES_CONNECTION_STRING ||
        databaseUrlConfig.connectionString,
    host:
        process.env.POSTGRES_HOST ||
        process.env.DB_HOST ||
        databaseUrlConfig.host,
    port: parseInteger(
        process.env.POSTGRES_PORT || process.env.DB_PORT,
        databaseUrlConfig.port ?? 5432
    ),
    user:
        process.env.POSTGRES_USER ||
        process.env.DB_USER ||
        databaseUrlConfig.user,
    password:
        process.env.POSTGRES_PASSWORD ||
        process.env.DB_PASSWORD ||
        databaseUrlConfig.password,
    database:
        process.env.POSTGRES_DB ||
        process.env.DB_NAME ||
        databaseUrlConfig.database,
    max: parseInteger(process.env.DB_POOL_MAX, 10),
    min: parseInteger(process.env.DB_POOL_MIN, 2),
    idleTimeoutMillis: parseInteger(process.env.DB_POOL_IDLE_TIMEOUT, 30000),
    connectionTimeoutMillis: parseInteger(process.env.DB_POOL_CONNECTION_TIMEOUT, 5000),
    acquireTimeoutMillis: parseInteger(process.env.DB_POOL_ACQUIRE_TIMEOUT, 10000),
    ssl: (() => {
        if (process.env.DB_SSL !== undefined) {
            return parseBoolean(process.env.DB_SSL, false);
        }
        if (process.env.PGSSL !== undefined) {
            return parseBoolean(process.env.PGSSL, false);
        }
        if (typeof databaseUrlConfig.ssl === 'boolean') {
            return databaseUrlConfig.ssl;
        }
        return false;
    })(),
    application_name: process.env.DB_APP_NAME || process.env.PGAPPNAME || 'vulnerability_dashboard'
};

class DatabasePool {
    constructor(config = {}) {
        const connectionString = config.connectionString ?? envDefaults.connectionString;

        this.poolConfig = {
            max: config.max ?? envDefaults.max ?? 10,
            min: config.min ?? envDefaults.min ?? 2,
            idleTimeoutMillis:
                config.idleTimeoutMillis ?? envDefaults.idleTimeoutMillis ?? 30000,
            connectionTimeoutMillis:
                config.connectionTimeoutMillis ?? envDefaults.connectionTimeoutMillis ?? 5000,
            acquireTimeoutMillis:
                config.acquireTimeoutMillis ?? envDefaults.acquireTimeoutMillis ?? 10000,
            ssl: config.ssl ?? envDefaults.ssl,
            application_name: config.application_name ?? envDefaults.application_name
        };

        if (connectionString) {
            this.poolConfig.connectionString = connectionString;
        } else {
            this.poolConfig.host = config.host ?? envDefaults.host ?? 'localhost';
            this.poolConfig.port = config.port ?? envDefaults.port ?? 5432;
            this.poolConfig.user = config.user ?? envDefaults.user ?? 'report_gen';
            this.poolConfig.password = config.password ?? envDefaults.password ?? 'StarDust';
            this.poolConfig.database = config.database ?? envDefaults.database ?? 'vulnerability_reports';
        }

        this.pool = new Pool(this.poolConfig);

        // Event handlers for monitoring
        this.pool.on('connect', () => {
            console.log('New client connected to database');
        });

        this.pool.on('acquire', () => {
            console.log('Client acquired from pool');
        });

        this.pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
        });

        this.pool.on('remove', () => {
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
