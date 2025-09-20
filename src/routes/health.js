const express = require('express');
const router = express.Router();
const os = require('os');
const { Pool } = require('pg');

// Create database pool for health checks
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'vulnerability_dashboard',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL_MODE === 'require' ? { rejectUnauthorized: false } : false,
  max: 2, // Small pool for health checks
  connectionTimeoutMillis: 5000,
  query_timeout: 5000
});

// Helper function to check database connection
async function checkDatabase() {
  try {
    const result = await pool.query('SELECT 1');
    return result.rows.length > 0 ? 'connected' : 'error';
  } catch (error) {
    console.error('Database health check failed:', error.message);
    return 'disconnected';
  }
}

// Helper function to check memory usage
function checkMemory() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const usagePercent = (usedMemory / totalMemory) * 100;

  if (usagePercent > 90) return 'critical';
  if (usagePercent > 75) return 'warning';
  return 'ok';
}

// Helper function to check disk usage (simplified)
function checkDisk() {
  // In a container environment, this would check the container's filesystem
  // For now, return ok as a placeholder
  return 'ok';
}

// GET /health - Basic health check
router.get('/health', async (req, res) => {
  const timestamp = new Date().toISOString();
  const dbStatus = await checkDatabase();
  const memoryStatus = checkMemory();
  const diskStatus = checkDisk();

  const isHealthy = dbStatus === 'connected' &&
                    memoryStatus !== 'critical' &&
                    diskStatus !== 'critical';

  const response = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp,
    checks: {
      database: dbStatus,
      memory: memoryStatus,
      disk: diskStatus
    }
  };

  res.status(isHealthy ? 200 : 503).json(response);
});

// GET /health/ready - Readiness check
router.get('/health/ready', async (req, res) => {
  const timestamp = new Date().toISOString();

  // Check if database is ready
  const dbReady = await checkDatabase() === 'connected';

  // Check if migrations are complete (simplified check)
  let migrationsComplete = true;
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'vulnerabilities'
      )
    `);
    migrationsComplete = result.rows[0].exists;
  } catch (error) {
    migrationsComplete = false;
  }

  // Cache is considered warmed up after startup
  const cacheReady = process.uptime() > 10; // After 10 seconds

  const isReady = dbReady && migrationsComplete && cacheReady;

  const response = {
    ready: isReady,
    timestamp,
    checks: {
      database: dbReady,
      migrations: migrationsComplete,
      cache: cacheReady
    },
    message: isReady ? 'Application is ready to serve traffic' : 'Application is not ready'
  };

  res.status(isReady ? 200 : 503).json(response);
});

// GET /health/live - Liveness check
router.get('/health/live', async (req, res) => {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();

  // Get memory usage
  const memUsage = process.memoryUsage();
  const memoryMB = {
    used: Math.round(memUsage.heapUsed / 1024 / 1024),
    limit: Math.round(memUsage.heapTotal / 1024 / 1024),
    percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
  };

  // Application is considered alive if it can respond
  const isAlive = true;

  const response = {
    alive: isAlive,
    timestamp,
    uptime,
    memory: memoryMB
  };

  res.status(isAlive ? 200 : 503).json(response);
});

// Cleanup on shutdown
process.on('SIGTERM', () => {
  pool.end();
});

module.exports = router;