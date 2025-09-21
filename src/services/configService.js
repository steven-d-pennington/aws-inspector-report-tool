const os = require('os');

class ConfigService {
  constructor() {
    this.currentConfig = this.loadConfiguration();
  }

  // Load configuration from environment variables
  loadConfiguration() {
    return {
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      application: {
        port: parseInt(process.env.PORT) || 3000,
        host: process.env.HOST || '0.0.0.0',
        logLevel: process.env.LOG_LEVEL || 'info'
      },
      database: {
        host: this.maskSensitive(process.env.DB_HOST || 'localhost'),
        port: parseInt(process.env.DB_PORT) || 5432,
        name: process.env.DB_NAME || 'vulnerability_dashboard',
        ssl: process.env.DB_SSL_MODE === 'require',
        poolSize: {
          min: parseInt(process.env.DB_POOL_MIN) || 2,
          max: parseInt(process.env.DB_POOL_MAX) || 20
        }
      },
      container: {
        hostname: os.hostname(),
        platform: os.platform(),
        memory: this.getMemoryInfo()
      }
    };
  }

  // Get current configuration (non-sensitive values only)
  getCurrentConfiguration() {
    this.currentConfig.timestamp = new Date().toISOString();
    this.currentConfig.container.memory = this.getMemoryInfo();
    return this.currentConfig;
  }

  // Validate configuration object
  validateConfiguration(config) {
    const errors = [];
    const warnings = [];

    // Validate database configuration
    if (config.database) {
      if (config.database.port && (config.database.port < 1 || config.database.port > 65535)) {
        errors.push({
          field: 'database.port',
          message: 'Port must be between 1 and 65535',
          value: config.database.port
        });
      }

      if (config.database.poolMin && config.database.poolMax) {
        if (config.database.poolMax <= config.database.poolMin) {
          errors.push({
            field: 'database.poolMax',
            message: 'Pool max must be greater than pool min',
            value: config.database.poolMax
          });
        }
      }
    }

    // Validate application configuration
    if (config.application) {
      if (config.application.port && (config.application.port < 1 || config.application.port > 65535)) {
        errors.push({
          field: 'application.port',
          message: 'Port must be between 1 and 65535',
          value: config.application.port
        });
      }

      if (config.application.logLevel &&
          !['error', 'warn', 'info', 'debug'].includes(config.application.logLevel)) {
        errors.push({
          field: 'application.logLevel',
          message: 'Log level must be one of: error, warn, info, debug',
          value: config.application.logLevel
        });
      }
    }

    // Add warnings for production considerations
    if (process.env.NODE_ENV === 'production') {
      if (config.application && config.application.logLevel === 'debug') {
        warnings.push({
          field: 'application.logLevel',
          message: 'Debug log level is not recommended for production'
        });
      }

      if (config.database && !config.database.ssl) {
        warnings.push({
          field: 'database.ssl',
          message: 'SSL is recommended for production database connections'
        });
      }
    }

    return {
      valid: errors.length === 0,
      timestamp: new Date().toISOString(),
      errors,
      warnings
    };
  }

  // Reload configuration from environment
  reloadConfiguration() {
    const oldConfig = { ...this.currentConfig };
    this.currentConfig = this.loadConfiguration();

    // Detect changes
    const changes = this.detectChanges(oldConfig, this.currentConfig);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      changes
    };
  }

  // Helper: Mask sensitive information
  maskSensitive(value) {
    if (!value || typeof value !== 'string') return value;

    // Don't mask localhost or common service names
    if (['localhost', 'postgres', '127.0.0.1', '::1'].includes(value)) {
      return value;
    }

    // Mask IP addresses partially
    if (value.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      const parts = value.split('.');
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }

    // Mask hostnames partially
    if (value.length > 8) {
      return value.substring(0, 4) + '****' + value.substring(value.length - 2);
    }

    return '****';
  }

  // Helper: Get memory information
  getMemoryInfo() {
    const memUsage = process.memoryUsage();
    return {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      limit: Math.round(memUsage.heapTotal / 1024 / 1024)
    };
  }

  // Helper: Detect configuration changes
  detectChanges(oldConfig, newConfig) {
    const changes = [];

    // Compare application settings
    if (oldConfig.application.port !== newConfig.application.port) {
      changes.push({
        field: 'application.port',
        oldValue: oldConfig.application.port.toString(),
        newValue: newConfig.application.port.toString()
      });
    }

    if (oldConfig.application.logLevel !== newConfig.application.logLevel) {
      changes.push({
        field: 'application.logLevel',
        oldValue: oldConfig.application.logLevel,
        newValue: newConfig.application.logLevel
      });
    }

    // Compare database settings (mask sensitive values)
    if (oldConfig.database.host !== newConfig.database.host) {
      changes.push({
        field: 'database.host',
        oldValue: this.maskSensitive(oldConfig.database.host),
        newValue: this.maskSensitive(newConfig.database.host)
      });
    }

    if (oldConfig.database.poolSize.max !== newConfig.database.poolSize.max) {
      changes.push({
        field: 'database.poolSize.max',
        oldValue: oldConfig.database.poolSize.max.toString(),
        newValue: newConfig.database.poolSize.max.toString()
      });
    }

    return changes;
  }
}

module.exports = new ConfigService();