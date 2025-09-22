/**
 * Environment Configuration Loader
 * Centralizes environment variable management for containerized deployment
 */

const path = require('path');
const fs = require('fs');

class EnvironmentConfig {
  constructor() {
    this.config = this.loadEnvironment();
  }

  loadEnvironment() {
    // Load .env file if it exists (for local development)
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
    }

    return {
      // Application Settings
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: parseInt(process.env.PORT) || 3010,
      HOST: process.env.HOST || '0.0.0.0',
      LOG_LEVEL: process.env.LOG_LEVEL || 'info',

      // Database Configuration
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'vulnerability_dashboard',
        user: process.env.DB_USER || 'appuser',
        password: process.env.DB_PASSWORD,
        ssl: this.getSSLConfig(),
        poolConfig: {
          min: parseInt(process.env.DB_POOL_MIN) || 2,
          max: parseInt(process.env.DB_POOL_MAX) || 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
          acquireTimeoutMillis: 60000,
          createTimeoutMillis: 3000,
          destroyTimeoutMillis: 5000,
          reapIntervalMillis: 1000,
          createRetryIntervalMillis: 200
        }
      },

      // Container Settings
      container: {
        name: process.env.CONTAINER_NAME || 'aws-inspector-app',
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30,
        healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 10,
        healthCheckRetries: parseInt(process.env.HEALTH_CHECK_RETRIES) || 3,
        healthCheckStartPeriod: parseInt(process.env.HEALTH_CHECK_START_PERIOD) || 60
      },

      // Feature Flags
      features: {
        hotReload: process.env.ENABLE_HOT_RELOAD === 'true',
        debugMode: process.env.DEBUG_MODE === 'true',
        configAPI: process.env.ENABLE_CONFIG_API !== 'false', // Enabled by default
        metrics: process.env.ENABLE_METRICS !== 'false'
      },

      // Security Settings
      security: {
        trustProxy: process.env.TRUST_PROXY === 'true',
        cors: {
          origin: process.env.CORS_ORIGIN || false,
          credentials: process.env.CORS_CREDENTIALS === 'true'
        }
      },

      // File Upload Settings
      upload: {
        directory: process.env.UPLOAD_DIR || './uploads',
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024, // 100MB
        allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'json,csv').split(',')
      }
    };
  }

  getSSLConfig() {
    const sslMode = process.env.DB_SSL_MODE || 'prefer';

    switch (sslMode) {
      case 'disable':
        return false;
      case 'require':
        return { rejectUnauthorized: false };
      case 'prefer':
      default:
        return process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;
    }
  }

  // Get database connection string
  getDatabaseConnectionString() {
    const { database } = this.config;
    const encodedUser = encodeURIComponent(database.user);
    const passwordSegment = database.password ? `:${encodeURIComponent(database.password)}` : '';
    const sslParam = database.ssl ? '?sslmode=require' : '';
    return `postgresql://${encodedUser}${passwordSegment}@${database.host}:${database.port}/${database.database}${sslParam}`;
  }

  // Validate required environment variables
  validateEnvironment() {
    const required = [];
    const warnings = [];

    // Check required variables
    if (!process.env.DB_PASSWORD) {
      required.push('DB_PASSWORD is required');
    }

    // Check production-specific requirements
    if (this.config.NODE_ENV === 'production') {
      if (this.config.LOG_LEVEL === 'debug') {
        warnings.push('DEBUG log level is not recommended for production');
      }

      if (!this.config.database.ssl) {
        warnings.push('SSL should be enabled for production database connections');
      }
    }

    return {
      isValid: required.length === 0,
      required,
      warnings
    };
  }

  // Get configuration for specific component
  getConfig(component) {
    switch (component) {
      case 'database':
        return this.config.database;
      case 'server':
        return {
          port: this.config.PORT,
          host: this.config.HOST,
          env: this.config.NODE_ENV
        };
      case 'container':
        return this.config.container;
      default:
        return this.config;
    }
  }

  // Check if running in container
  isContainer() {
    return fs.existsSync('/.dockerenv') ||
           process.env.KUBERNETES_SERVICE_HOST ||
           process.env.CONTAINER_NAME;
  }

  // Get deployment context
  getDeploymentContext() {
    return {
      isContainer: this.isContainer(),
      environment: this.config.NODE_ENV,
      platform: process.platform,
      nodeVersion: process.version,
      uptime: process.uptime()
    };
  }
}

// Export singleton instance
module.exports = new EnvironmentConfig();