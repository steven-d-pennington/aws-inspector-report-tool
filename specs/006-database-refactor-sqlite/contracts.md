# API Contracts: PostgreSQL Migration

**Phase 1 Output**: Service interfaces and integration contracts for PostgreSQL implementation
**Date**: 2025-09-18

## Contract Design Overview

**Strategy**: Maintain existing service interfaces while implementing PostgreSQL backend
**Compatibility**: Zero changes required in application code
**Performance**: Enhanced with connection pooling and optimized queries

## 1. Database Service Interface

### Core Database Service Contract
**File**: `src/models/database.js`
**Implementation**: Drop-in PostgreSQL replacement maintaining exact interface

```javascript
class DatabaseService {
  constructor() {
    // PostgreSQL connection pool initialization
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.DB_POOL_MAX) || 20,
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT) || 2000,
    });
  }

  // Connection management
  async initialize() { /* Pool initialization and health check */ }
  async close() { /* Graceful pool shutdown */ }
  async healthCheck() { /* Connection validation */ }

  // Report operations
  async getAllReports() { /* Returns: Array<Report> */ }
  async getReportById(id) { /* Returns: Report | null */ }
  async insertReport(reportData) { /* Returns: number (report_id) */ }
  async updateReport(id, updates) { /* Returns: boolean */ }
  async deleteReport(id) { /* Returns: boolean */ }

  // Vulnerability operations
  async getVulnerabilities(filters = {}) { /* Returns: Array<Vulnerability> */ }
  async getVulnerabilityById(id) { /* Returns: Vulnerability | null */ }
  async insertVulnerability(vulnData) { /* Returns: number (vulnerability_id) */ }
  async updateVulnerability(id, updates) { /* Returns: boolean */ }
  async deleteVulnerability(id) { /* Returns: boolean */ }

  // Bulk operations for performance
  async insertVulnerabilities(vulnArray) { /* Returns: Array<number> */ }
  async archiveVulnerabilities(vulnerabilityIds) { /* Returns: number (archived_count) */ }

  // Settings operations
  async getAllSettings() { /* Returns: Array<Setting> */ }
  async getSettingByKey(key) { /* Returns: Setting | null */ }
  async updateSetting(key, value, type = 'string') { /* Returns: boolean */ }
  async insertSetting(settingData) { /* Returns: number (setting_id) */ }
  async deleteSetting(key) { /* Returns: boolean */ }

  // Advanced query operations
  async getVulnerabilityStatistics() { /* Returns: VulnerabilityStats */ }
  async getHistoricalTrends(timeRange) { /* Returns: Array<TrendData> */ }
  async searchVulnerabilities(searchTerm, filters) { /* Returns: Array<Vulnerability> */ }

  // Transaction support
  async executeTransaction(callback) { /* Returns: T */ }
}
```

### Data Type Contracts

**Report Object**:
```typescript
interface Report {
  id: number;
  filename: string;
  upload_date: string; // ISO 8601 format
  file_size: number | null;
  vulnerabilities_count: number;
  status: 'UPLOADING' | 'PROCESSING' | 'PROCESSED' | 'ERROR';
  error_message: string | null;
}
```

**Vulnerability Object**:
```typescript
interface Vulnerability {
  id: number;
  report_id: number;
  vulnerability_id: string | null;
  title: string;
  description: string | null;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL' | 'UNTRIAGED';
  cvss_score: number | null; // 0.0 to 10.0
  cve_id: string | null;
  package_name: string | null;
  package_version: string | null;
  fix_available: 'YES' | 'NO' | null;
  fix_version: string | null;
  resource_id: string | null;
  first_observed: string; // ISO 8601 format
  last_observed: string; // ISO 8601 format
  status: 'ACTIVE' | 'FIXED' | 'IGNORED' | 'FALSE_POSITIVE';
}
```

**Setting Object**:
```typescript
interface Setting {
  id: number;
  key: string;
  value: string | null;
  type: 'string' | 'boolean' | 'number' | 'json';
  description: string | null;
  created_at: string; // ISO 8601 format
  updated_at: string; // ISO 8601 format
}
```

**Filter Object**:
```typescript
interface VulnerabilityFilter {
  severity?: string | string[];
  status?: string | string[];
  package_name?: string;
  cve_id?: string;
  last_observed_after?: string; // ISO 8601 format
  last_observed_before?: string; // ISO 8601 format
  limit?: number;
  offset?: number;
  sort_by?: 'severity' | 'last_observed' | 'package_name';
  sort_order?: 'ASC' | 'DESC';
}
```

## 2. Query Operation Contracts

### Read Operations

**getAllReports()**:
```javascript
// Input: None
// Output: Promise<Array<Report>>
// Performance: <500ms for typical datasets
// SQL: SELECT * FROM reports ORDER BY upload_date DESC

async getAllReports() {
  const client = await this.pool.connect();
  try {
    const result = await client.query(`
      SELECT id, filename, upload_date, file_size, vulnerabilities_count, status, error_message
      FROM reports
      ORDER BY upload_date DESC
    `);
    return result.rows;
  } finally {
    client.release();
  }
}
```

**getVulnerabilities(filters)**:
```javascript
// Input: VulnerabilityFilter
// Output: Promise<Array<Vulnerability>>
// Performance: <2s for filtered queries, supports pagination
// SQL: Complex query with dynamic WHERE clauses

async getVulnerabilities(filters = {}) {
  const client = await this.pool.connect();
  try {
    const { query, params } = this._buildVulnerabilityQuery(filters);
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}
```

**getSettingByKey(key)**:
```javascript
// Input: string (setting key)
// Output: Promise<Setting | null>
// Performance: <50ms (indexed lookup)
// SQL: SELECT with unique index on key

async getSettingByKey(key) {
  const client = await this.pool.connect();
  try {
    const result = await client.query(`
      SELECT id, key, value, type, description, created_at, updated_at
      FROM settings
      WHERE key = $1
    `, [key]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}
```

**getAllSettings()**:
```javascript
// Input: None
// Output: Promise<Array<Setting>>
// Performance: <100ms (small table, indexed)
// SQL: Simple SELECT with ORDER BY

async getAllSettings() {
  const client = await this.pool.connect();
  try {
    const result = await client.query(`
      SELECT id, key, value, type, description, created_at, updated_at
      FROM settings
      ORDER BY key ASC
    `);
    return result.rows;
  } finally {
    client.release();
  }
}
```

### Write Operations

**insertReport(reportData)**:
```javascript
// Input: Partial<Report>
// Output: Promise<number> (new report ID)
// Performance: <100ms
// SQL: INSERT with RETURNING clause

async insertReport(reportData) {
  const client = await this.pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO reports (filename, file_size, status)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [reportData.filename, reportData.file_size, reportData.status || 'PROCESSING']);

    return result.rows[0].id;
  } finally {
    client.release();
  }
}
```

**insertVulnerabilities(vulnArray)**:
```javascript
// Input: Array<Partial<Vulnerability>>
// Output: Promise<Array<number>> (new vulnerability IDs)
// Performance: Optimized bulk insert for >1000 records
// SQL: Multi-row INSERT with batch processing

async insertVulnerabilities(vulnArray) {
  const client = await this.pool.connect();
  try {
    await client.query('BEGIN');

    const insertedIds = [];
    const batchSize = 100; // Optimal batch size for PostgreSQL

    for (let i = 0; i < vulnArray.length; i += batchSize) {
      const batch = vulnArray.slice(i, i + batchSize);
      const values = batch.map((vuln, index) => {
        const baseIndex = i * 11; // 11 parameters per vulnerability
        return `($${baseIndex + index * 11 + 1}, $${baseIndex + index * 11 + 2}, ..., $${baseIndex + index * 11 + 11})`;
      }).join(', ');

      const params = batch.flatMap(vuln => [
        vuln.report_id, vuln.title, vuln.severity, vuln.package_name,
        vuln.package_version, vuln.fix_available, vuln.cve_id,
        vuln.cvss_score, vuln.description, vuln.vulnerability_id, vuln.resource_id
      ]);

      const result = await client.query(`
        INSERT INTO vulnerabilities
        (report_id, title, severity, package_name, package_version, fix_available,
         cve_id, cvss_score, description, vulnerability_id, resource_id)
        VALUES ${values}
        RETURNING id
      `, params);

      insertedIds.push(...result.rows.map(row => row.id));
    }

    await client.query('COMMIT');
    return insertedIds;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

**updateSetting(key, value, type)**:
```javascript
// Input: string, string, string (key, value, type)
// Output: Promise<boolean>
// Performance: <50ms (indexed update)
// SQL: UPDATE with WHERE on unique key

async updateSetting(key, value, type = 'string') {
  const client = await this.pool.connect();
  try {
    const result = await client.query(`
      UPDATE settings
      SET value = $2, type = $3, updated_at = CURRENT_TIMESTAMP
      WHERE key = $1
    `, [key, value, type]);

    return result.rowCount > 0;
  } finally {
    client.release();
  }
}
```

**insertSetting(settingData)**:
```javascript
// Input: Partial<Setting>
// Output: Promise<number> (new setting ID)
// Performance: <50ms
// SQL: INSERT with RETURNING clause

async insertSetting(settingData) {
  const client = await this.pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO settings (key, value, type, description)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [
      settingData.key,
      settingData.value,
      settingData.type || 'string',
      settingData.description || null
    ]);

    return result.rows[0].id;
  } finally {
    client.release();
  }
}
```

## 3. Transaction Management Contract

### Transaction Interface
```javascript
// Generic transaction wrapper
// Input: async callback function
// Output: Promise<T> where T is callback return type
// Guarantees: ACID compliance, automatic rollback on error

async executeTransaction(callback) {
  const client = await this.pool.connect();
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
```

### Usage Examples
```javascript
// Archive vulnerabilities (complex transaction)
async archiveVulnerabilities(vulnerabilityIds) {
  return await this.executeTransaction(async (client) => {
    // 1. Copy to history table
    await client.query(`
      INSERT INTO vulnerability_history
      (original_vulnerability_id, vulnerability_id, title, severity, package_name, package_version, fix_version)
      SELECT id, vulnerability_id, title, severity, package_name, package_version, fix_version
      FROM vulnerabilities
      WHERE id = ANY($1)
    `, [vulnerabilityIds]);

    // 2. Delete from active table
    const result = await client.query(`
      DELETE FROM vulnerabilities
      WHERE id = ANY($1)
    `, [vulnerabilityIds]);

    // 3. Update report counts
    await client.query(`
      UPDATE reports
      SET vulnerabilities_count = (
        SELECT COUNT(*) FROM vulnerabilities WHERE report_id = reports.id
      )
    `);

    return result.rowCount;
  });
}
```

## 4. Error Handling Contracts

### Error Types and Responses
```javascript
// Database connection errors
class DatabaseConnectionError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'DatabaseConnectionError';
    this.originalError = originalError;
    this.retryable = true;
  }
}

// Constraint violation errors
class DatabaseConstraintError extends Error {
  constructor(message, constraint, value) {
    super(message);
    this.name = 'DatabaseConstraintError';
    this.constraint = constraint;
    this.value = value;
    this.retryable = false;
  }
}

// Data not found errors
class DatabaseNotFoundError extends Error {
  constructor(resource, id) {
    super(`${resource} with id ${id} not found`);
    this.name = 'DatabaseNotFoundError';
    this.resource = resource;
    this.id = id;
    this.retryable = false;
  }
}
```

### Error Handling Patterns
```javascript
// Standard error handling for all database operations
async safeExecute(operation, errorContext) {
  try {
    return await operation();
  } catch (error) {
    // PostgreSQL specific error mapping
    if (error.code === '23505') { // Unique violation
      throw new DatabaseConstraintError('Duplicate record', error.constraint, error.detail);
    }
    if (error.code === '23503') { // Foreign key violation
      throw new DatabaseConstraintError('Referenced record not found', error.constraint, error.detail);
    }
    if (error.code === 'ECONNREFUSED') { // Connection refused
      throw new DatabaseConnectionError('Cannot connect to database', error);
    }

    // Log and re-throw for unknown errors
    console.error(`Database error in ${errorContext}:`, error);
    throw error;
  }
}
```

## 5. Performance Contracts

### Response Time Guarantees
```javascript
// Performance monitoring wrapper
class PerformanceMonitor {
  static async measureQuery(queryName, operation) {
    const startTime = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      // Log slow queries for optimization
      if (duration > 2000) {
        console.warn(`Slow query detected: ${queryName} took ${duration}ms`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Query failed: ${queryName} after ${duration}ms`, error);
      throw error;
    }
  }
}

// Usage in database methods
async getVulnerabilities(filters) {
  return await PerformanceMonitor.measureQuery('getVulnerabilities', async () => {
    // Implementation here
  });
}
```

### Connection Pool Contracts
```javascript
// Pool health monitoring
async getPoolStats() {
  return {
    total_connections: this.pool.totalCount,
    idle_connections: this.pool.idleCount,
    waiting_clients: this.pool.waitingCount,
    max_connections: this.pool.options.max
  };
}

// Connection health check
async healthCheck() {
  const client = await this.pool.connect();
  try {
    const result = await client.query('SELECT 1 as health');
    return result.rows[0].health === 1;
  } finally {
    client.release();
  }
}
```

## 6. Migration Support Contracts

### Schema Validation Interface
```javascript
// Validate PostgreSQL schema matches expectations
async validateSchema() {
  const client = await this.pool.connect();
  try {
    const expectedTables = [
      'reports', 'vulnerabilities', 'resources', 'packages',
      'references', 'vulnerability_history', 'resource_history', 'upload_events'
    ];

    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

    const actualTables = result.rows.map(row => row.table_name);
    const missingTables = expectedTables.filter(table => !actualTables.includes(table));

    if (missingTables.length > 0) {
      throw new Error(`Missing required tables: ${missingTables.join(', ')}`);
    }

    return { valid: true, tables: actualTables };
  } finally {
    client.release();
  }
}
```

### Compatibility Layer
```javascript
// Ensure backward compatibility during migration
class SQLiteCompatibilityLayer {
  constructor(postgresService) {
    this.postgres = postgresService;
  }

  // Map SQLite-specific behaviors to PostgreSQL
  async all(query, params = []) {
    // SQLite db.all() equivalent
    const client = await this.postgres.pool.connect();
    try {
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async get(query, params = []) {
    // SQLite db.get() equivalent
    const client = await this.postgres.pool.connect();
    try {
      const result = await client.query(query, params);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async run(query, params = []) {
    // SQLite db.run() equivalent
    const client = await this.postgres.pool.connect();
    try {
      const result = await client.query(query, params);
      return {
        changes: result.rowCount,
        lastID: result.rows[0]?.id || null
      };
    } finally {
      client.release();
    }
  }
}
```

## 7. Testing Contracts

### Unit Test Interface
```javascript
// Mock database service for testing
class MockDatabaseService {
  constructor() {
    this.data = {
      reports: [],
      vulnerabilities: [],
      nextId: 1
    };
  }

  // Implement same interface as real service
  async getAllReports() {
    return [...this.data.reports];
  }

  async insertReport(reportData) {
    const report = { id: this.nextId++, ...reportData };
    this.data.reports.push(report);
    return report.id;
  }

  // Reset for test isolation
  reset() {
    this.data = { reports: [], vulnerabilities: [], nextId: 1 };
  }
}
```

### Integration Test Interface
```javascript
// Database integration test helpers
class DatabaseTestHelper {
  constructor(databaseService) {
    this.db = databaseService;
  }

  async setupTestData() {
    // Create test reports and vulnerabilities
    const reportId = await this.db.insertReport({
      filename: 'test-report.json',
      file_size: 1024,
      status: 'PROCESSED'
    });

    const vulnIds = await this.db.insertVulnerabilities([
      {
        report_id: reportId,
        title: 'Test Vulnerability',
        severity: 'HIGH',
        package_name: 'test-package'
      }
    ]);

    return { reportId, vulnIds };
  }

  async cleanupTestData() {
    // Clean up test data
    await this.db.executeTransaction(async (client) => {
      await client.query('DELETE FROM vulnerabilities WHERE package_name LIKE $1', ['test-%']);
      await client.query('DELETE FROM reports WHERE filename LIKE $1', ['test-%']);
    });
  }
}
```

## 8. Configuration Contracts

### Environment Configuration
```javascript
// Required environment variables
const requiredEnvVars = {
  DATABASE_URL: 'postgresql://user:password@host:port/database',
  DB_POOL_MAX: '20',
  DB_POOL_IDLE_TIMEOUT: '30000',
  DB_POOL_CONNECTION_TIMEOUT: '2000'
};

// Validation function
function validateDatabaseConfig() {
  const missing = Object.keys(requiredEnvVars).filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

### Service Initialization Contract
```javascript
// Standardized service initialization
async function initializeDatabaseService() {
  validateDatabaseConfig();

  const service = new DatabaseService();
  await service.initialize();

  // Validate schema exists and is correct
  await service.validateSchema();

  // Health check
  const isHealthy = await service.healthCheck();
  if (!isHealthy) {
    throw new Error('Database health check failed');
  }

  return service;
}
```

## 9. Migration Validation Contracts

### Pre-Migration Checks
```javascript
async validateMigrationReadiness() {
  const checks = {
    postgresql_connection: false,
    schema_exists: false,
    pool_configuration: false,
    performance_baseline: false
  };

  try {
    // Test PostgreSQL connection
    await this.healthCheck();
    checks.postgresql_connection = true;

    // Validate schema
    await this.validateSchema();
    checks.schema_exists = true;

    // Check pool configuration
    const poolStats = await this.getPoolStats();
    checks.pool_configuration = poolStats.max_connections > 0;

    // Basic performance test
    const start = Date.now();
    await this.getAllReports();
    const duration = Date.now() - start;
    checks.performance_baseline = duration < 1000;

  } catch (error) {
    console.error('Migration readiness validation failed:', error);
  }

  return checks;
}
```

### Post-Migration Validation
```javascript
async validateMigrationSuccess() {
  const validations = {
    all_crud_operations: false,
    transaction_support: false,
    constraint_enforcement: false,
    performance_improvement: false
  };

  try {
    // Test CRUD operations
    const testReport = await this.insertReport({ filename: 'migration-test.json' });
    const retrieved = await this.getReportById(testReport);
    await this.deleteReport(testReport);
    validations.all_crud_operations = retrieved !== null;

    // Test transaction support
    await this.executeTransaction(async (client) => {
      await client.query('SELECT 1');
    });
    validations.transaction_support = true;

    // Test constraint enforcement
    try {
      await this.insertVulnerability({ severity: 'INVALID' });
      validations.constraint_enforcement = false; // Should have failed
    } catch (error) {
      validations.constraint_enforcement = true; // Correctly rejected
    }

    // Performance benchmark
    const largeBatch = Array(1000).fill(null).map((_, i) => ({
      report_id: 1,
      title: `Perf Test ${i}`,
      severity: 'MEDIUM'
    }));

    const start = Date.now();
    await this.insertVulnerabilities(largeBatch);
    const duration = Date.now() - start;
    validations.performance_improvement = duration < 5000; // 5s target

  } catch (error) {
    console.error('Migration validation failed:', error);
  }

  return validations;
}
```

**Phase 1 API Contracts Complete** ✅