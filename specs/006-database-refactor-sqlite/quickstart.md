# Quickstart Guide: PostgreSQL Migration Validation

**Phase 1 Output**: Step-by-step validation scenarios for PostgreSQL migration
**Date**: 2025-09-18

## Overview
This guide provides comprehensive validation scenarios for the PostgreSQL migration. Each scenario validates specific functional requirements and ensures the migration delivers the expected performance improvements.

## Prerequisites

### Environment Setup
- PostgreSQL server running on localhost:5432
- Database `alb_logs` created with user `alb_user`
- Environment variables configured in `.env`
- Node.js dependencies installed (`npm install pg`)
- Vulnerability dashboard application ready for testing

### Pre-Migration Checklist
```bash
# 1. Verify PostgreSQL connection
psql postgresql://alb_user:alb_password@localhost:5432/alb_logs -c "SELECT version();"

# 2. Check environment configuration
cat .env | grep DATABASE

# 3. Backup current SQLite database (if needed)
cp db/vulnerabilities.db db/vulnerabilities.db.backup

# 4. Install PostgreSQL dependencies
npm install pg
```

## Test Scenarios

### Scenario 1: Database Connection and Schema Creation
**Validates**: FR-009, FR-010 - PostgreSQL connection and schema creation
**Expected Duration**: <30 seconds

**Steps**:
1. Start the application with PostgreSQL configuration
2. Verify database service initializes correctly
3. Check that all required tables are created
4. Validate table structure matches specifications

**Validation Commands**:
```bash
# Check PostgreSQL connection
npm start
# Look for: "Database connected successfully" or similar

# Verify schema creation
psql postgresql://alb_user:alb_password@localhost:5432/alb_logs -c "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name;
"

# Expected tables:
# - packages
# - references
# - reports
# - resource_history
# - resources
# - upload_events
# - vulnerabilities
# - vulnerability_history
```

**Expected Results**:
- ✅ Application starts without database errors
- ✅ All 8 required tables created
- ✅ Foreign key constraints properly established
- ✅ Indexes created for performance optimization
- ✅ Connection pool initialized with correct configuration

**Acceptance Criteria**: PostgreSQL schema created successfully with all required tables and constraints

### Scenario 2: Basic CRUD Operations Validation
**Validates**: FR-002 - Identical functionality after migration
**Expected Duration**: <2 minutes

**Steps**:
1. Navigate to http://localhost:3010
2. Verify dashboard loads without errors
3. Upload a test vulnerability report
4. Check that vulnerabilities are displayed correctly
5. Test filtering and search functionality
6. Verify navigation between pages works

**Test Data**:
Create test file `test-vulnerabilities.json`:
```json
{
  "findings": [
    {
      "title": "Test Critical Vulnerability",
      "severity": "CRITICAL",
      "package": { "name": "test-package", "version": "1.0.0" },
      "description": "PostgreSQL migration test vulnerability"
    },
    {
      "title": "Test Medium Vulnerability",
      "severity": "MEDIUM",
      "package": { "name": "another-package", "version": "2.1.0" },
      "description": "Second test vulnerability for migration"
    }
  ]
}
```

**Validation Steps**:
```bash
# 1. Upload test file through web interface
# 2. Check database directly
psql postgresql://alb_user:alb_password@localhost:5432/alb_logs -c "
  SELECT COUNT(*) as report_count FROM reports;
  SELECT COUNT(*) as vulnerability_count FROM vulnerabilities;
  SELECT severity, COUNT(*) as count FROM vulnerabilities GROUP BY severity;
"

# Expected results:
# report_count: 1
# vulnerability_count: 2
# severity counts: CRITICAL=1, MEDIUM=1
```

**Expected Results**:
- ✅ File upload processes without errors
- ✅ Vulnerabilities appear in dashboard
- ✅ Severity filtering works correctly
- ✅ Package information displays properly
- ✅ Database contains expected records
- ✅ All navigation functions normally

**Acceptance Criteria**: All CRUD operations work identically to SQLite version

### Scenario 3: Performance Improvement Validation
**Validates**: PR-001 - 50% faster processing for large datasets
**Expected Duration**: <5 minutes

**Performance Test Setup**:
```bash
# Create large test dataset (1000+ vulnerabilities)
node scripts/generate-test-data.js --size=1500 --output=large-test-dataset.json
```

**Test Script** (`scripts/generate-test-data.js`):
```javascript
const fs = require('fs');
const { performance } = require('perf_hooks');

function generateTestData(size) {
  const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'];
  const packages = ['react', 'lodash', 'axios', 'express', 'moment', 'uuid', 'bcrypt'];

  const findings = Array(size).fill(null).map((_, i) => ({
    title: `Performance Test Vulnerability ${i + 1}`,
    severity: severities[i % severities.length],
    package: {
      name: packages[i % packages.length],
      version: `${Math.floor(i/100)}.${i % 10}.${i % 3}`
    },
    description: `Generated vulnerability for PostgreSQL performance testing - record ${i + 1}`,
    cve_id: i % 10 === 0 ? `CVE-2023-${10000 + i}` : null
  }));

  return { findings };
}

const size = parseInt(process.argv[3]) || 1000;
const output = process.argv[5] || 'performance-test-data.json';
const data = generateTestData(size);

fs.writeFileSync(output, JSON.stringify(data, null, 2));
console.log(`Generated ${size} test vulnerabilities in ${output}`);
```

**Performance Measurement**:
```bash
# 1. Time the upload process
START_TIME=$(date +%s%3N)
# Upload large-test-dataset.json through web interface
END_TIME=$(date +%s%3N)
UPLOAD_DURATION=$((END_TIME - START_TIME))
echo "Upload duration: ${UPLOAD_DURATION}ms"

# 2. Time database queries
psql postgresql://alb_user:alb_password@localhost:5432/alb_logs -c "
  \timing on
  SELECT COUNT(*) FROM vulnerabilities;
  SELECT severity, COUNT(*) FROM vulnerabilities GROUP BY severity;
  SELECT package_name, COUNT(*) FROM vulnerabilities GROUP BY package_name ORDER BY COUNT(*) DESC LIMIT 10;
  SELECT * FROM vulnerabilities WHERE severity = 'CRITICAL' ORDER BY last_observed DESC LIMIT 50;
"
```

**Expected Results**:
- ✅ Large dataset upload completes in <30 seconds
- ✅ Dashboard remains responsive during upload
- ✅ Query performance <2 seconds for all operations
- ✅ Memory usage remains stable
- ✅ Connection pool handles concurrent access
- ✅ 50% improvement over SQLite baseline (if measurable)

**Acceptance Criteria**: Large dataset processing demonstrates significant performance improvement

### Scenario 4: Concurrent User Access Validation
**Validates**: PR-002 - Support 10+ concurrent users
**Expected Duration**: <3 minutes

**Concurrent Access Test**:
```bash
# Install testing dependencies
npm install --save-dev artillery

# Create load testing configuration
cat > load-test.yml << EOF
config:
  target: 'http://localhost:3010'
  phases:
    - duration: 60
      arrivalRate: 2
  processor: "./load-test-processor.js"

scenarios:
  - name: "Dashboard browsing"
    weight: 50
    flow:
      - get:
          url: "/"
      - think: 2
      - get:
          url: "/vulnerabilities"
      - think: 3
      - get:
          url: "/dashboard"

  - name: "API access"
    weight: 30
    flow:
      - get:
          url: "/api/vulnerabilities"
      - think: 1
      - get:
          url: "/api/reports"

  - name: "Search operations"
    weight: 20
    flow:
      - get:
          url: "/vulnerabilities?severity=CRITICAL"
      - think: 2
      - get:
          url: "/vulnerabilities?package=test-package"
EOF

# Run load test
npx artillery run load-test.yml
```

**Manual Concurrent Testing**:
1. Open 5+ browser tabs to the dashboard
2. Navigate different pages simultaneously in each tab
3. Perform searches and filtering in multiple tabs
4. Monitor server logs for errors
5. Check database connection pool utilization

**Validation Commands**:
```bash
# Monitor connection pool during test
psql postgresql://alb_user:alb_password@localhost:5432/alb_logs -c "
  SELECT count(*) as active_connections
  FROM pg_stat_activity
  WHERE datname = 'alb_logs' AND state = 'active';
"

# Check for any connection pool exhaustion errors in application logs
tail -f logs/app.log | grep -i "pool\|connection"
```

**Expected Results**:
- ✅ All concurrent requests complete successfully
- ✅ Response times remain <2 seconds under load
- ✅ No connection pool exhaustion errors
- ✅ Database handles concurrent queries without locks
- ✅ Application remains stable under concurrent access
- ✅ Connection pool utilization stays within limits

**Acceptance Criteria**: System handles 10+ concurrent users with good performance

### Scenario 5: Data Integrity and Constraint Validation
**Validates**: FR-004, FR-008 - Data integrity and constraint enforcement
**Expected Duration**: <2 minutes

**Constraint Testing**:
```javascript
// Test script: test-constraints.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testConstraints() {
  const client = await pool.connect();

  try {
    console.log('Testing severity constraint...');
    try {
      await client.query(`
        INSERT INTO vulnerabilities (report_id, title, severity)
        VALUES (1, 'Invalid Severity Test', 'INVALID_SEVERITY')
      `);
      console.log('❌ Severity constraint failed - invalid value accepted');
    } catch (error) {
      console.log('✅ Severity constraint working - invalid value rejected');
    }

    console.log('Testing foreign key constraint...');
    try {
      await client.query(`
        INSERT INTO vulnerabilities (report_id, title, severity)
        VALUES (99999, 'Foreign Key Test', 'HIGH')
      `);
      console.log('❌ Foreign key constraint failed - invalid report_id accepted');
    } catch (error) {
      console.log('✅ Foreign key constraint working - invalid report_id rejected');
    }

    console.log('Testing CVSS score range...');
    try {
      await client.query(`
        INSERT INTO vulnerabilities (report_id, title, severity, cvss_score)
        VALUES (1, 'CVSS Range Test', 'HIGH', 15.0)
      `);
      console.log('❌ CVSS constraint failed - invalid score accepted');
    } catch (error) {
      console.log('✅ CVSS constraint working - invalid score rejected');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

testConstraints().catch(console.error);
```

**Run Constraint Tests**:
```bash
node test-constraints.js
```

**Expected Results**:
- ✅ Invalid severity values rejected
- ✅ Foreign key constraints enforced
- ✅ CVSS score range validation working
- ✅ Required field constraints enforced
- ✅ Date logic constraints working
- ✅ URL format validation for references

**Acceptance Criteria**: All database constraints properly enforce data integrity

### Scenario 6: Transaction and Rollback Validation
**Validates**: FR-007 - Transaction support and data consistency
**Expected Duration**: <2 minutes

**Transaction Test Script**:
```javascript
// test-transactions.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testTransactions() {
  console.log('Testing transaction rollback...');

  const client = await pool.connect();

  try {
    // Count initial records
    const initialCount = await client.query('SELECT COUNT(*) FROM vulnerabilities');
    console.log(`Initial vulnerability count: ${initialCount.rows[0].count}`);

    // Start transaction
    await client.query('BEGIN');

    // Insert valid record
    await client.query(`
      INSERT INTO vulnerabilities (report_id, title, severity)
      VALUES (1, 'Transaction Test 1', 'HIGH')
    `);

    // Attempt invalid record (should fail)
    try {
      await client.query(`
        INSERT INTO vulnerabilities (report_id, title, severity)
        VALUES (1, 'Transaction Test 2', 'INVALID_SEVERITY')
      `);
    } catch (error) {
      console.log('Expected error occurred, rolling back...');
      await client.query('ROLLBACK');
    }

    // Check that no records were inserted
    const finalCount = await client.query('SELECT COUNT(*) FROM vulnerabilities');
    console.log(`Final vulnerability count: ${finalCount.rows[0].count}`);

    if (initialCount.rows[0].count === finalCount.rows[0].count) {
      console.log('✅ Transaction rollback working correctly');
    } else {
      console.log('❌ Transaction rollback failed');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

testTransactions().catch(console.error);
```

**Run Transaction Tests**:
```bash
node test-transactions.js
```

**Expected Results**:
- ✅ Successful transactions commit properly
- ✅ Failed transactions rollback completely
- ✅ No partial data states after rollback
- ✅ Concurrent transactions don't interfere
- ✅ Deadlock detection and recovery working

**Acceptance Criteria**: Transaction management ensures data consistency

### Scenario 7: Historical Data and Archive Functions
**Validates**: FR-005, FR-006 - Historical data management
**Expected Duration**: <3 minutes

**Archive Function Test**:
1. Create test vulnerabilities
2. Archive some vulnerabilities to history
3. Verify data moved correctly
4. Test historical queries and reporting

**Test Commands**:
```bash
# 1. Create test vulnerabilities (via web interface or API)
# 2. Test archive functionality through application

# 3. Verify historical data
psql postgresql://alb_user:alb_password@localhost:5432/alb_logs -c "
  -- Check active vulnerabilities
  SELECT COUNT(*) as active_count FROM vulnerabilities;

  -- Check archived vulnerabilities
  SELECT COUNT(*) as archived_count FROM vulnerability_history;

  -- Verify archive process preserved data integrity
  SELECT
    archived_date,
    severity,
    package_name,
    resolution_type
  FROM vulnerability_history
  ORDER BY archived_date DESC
  LIMIT 5;
"
```

**Expected Results**:
- ✅ Archive process moves data to history tables
- ✅ Historical data maintains referential integrity
- ✅ Archive operations are transactional
- ✅ Historical queries perform efficiently
- ✅ Reporting functions work with archived data

**Acceptance Criteria**: Historical data management functions correctly

### Scenario 8: Error Handling and Recovery
**Validates**: FR-009 - Error handling without corruption
**Expected Duration**: <2 minutes

**Error Simulation Tests**:
```bash
# 1. Test database disconnection handling
# Stop PostgreSQL service temporarily
sudo systemctl stop postgresql
# Try to access application - should show appropriate error
# Restart PostgreSQL
sudo systemctl start postgresql
# Application should reconnect automatically

# 2. Test malformed data handling
# Upload invalid JSON file through web interface
# Verify error is handled gracefully

# 3. Test concurrent operation conflicts
# Simulate simultaneous uploads in multiple browser tabs
```

**Expected Results**:
- ✅ Database disconnections handled gracefully
- ✅ Connection pool recovers automatically
- ✅ Invalid data rejected with clear error messages
- ✅ Concurrent operations don't cause deadlocks
- ✅ Application remains stable during error conditions
- ✅ No data corruption occurs during failures

**Acceptance Criteria**: Robust error handling maintains system stability

## Integration Test Checklist

### Pre-Migration Validation
- [ ] PostgreSQL server accessible at configured URL
- [ ] Database `alb_logs` exists with proper permissions
- [ ] Environment variables correctly configured
- [ ] All required Node.js dependencies installed
- [ ] Previous SQLite database backed up (if needed)

### Core Functionality Tests
- [ ] Database schema creation successful
- [ ] All CRUD operations working correctly
- [ ] File upload and processing functional
- [ ] Dashboard displays data properly
- [ ] Filtering and search operations working
- [ ] Navigation between pages functional

### Performance Tests
- [ ] Large dataset upload performance acceptable
- [ ] Query response times <2 seconds
- [ ] Concurrent user access supported
- [ ] Memory usage stable during operations
- [ ] Connection pool functioning properly

### Data Integrity Tests
- [ ] Database constraints enforced
- [ ] Foreign key relationships maintained
- [ ] Transaction rollback working
- [ ] Data validation preventing corruption
- [ ] Archive operations preserve integrity

### Error Handling Tests
- [ ] Database disconnection recovery
- [ ] Invalid data rejection
- [ ] Concurrent operation handling
- [ ] Error messages user-friendly
- [ ] System stability under stress

### Security and Compliance Tests
- [ ] SQL injection prevention working
- [ ] Connection security enforced
- [ ] Access controls functioning
- [ ] Audit logging operational
- [ ] Data privacy requirements met

## Success Metrics

### Performance Benchmarks
**Target Achievements**:
- Upload processing: >50% faster than SQLite for >1000 records
- Query response: <2 seconds for all dashboard operations
- Concurrent users: 10+ simultaneous users supported
- Connection efficiency: Pool utilization <80% under normal load

### Functional Validation
**All Features Working**:
- File upload and vulnerability parsing
- Dashboard visualization and statistics
- Filtering and search functionality
- Historical data and trend analysis
- Archive and data management operations

### Quality Assurance
**Zero Tolerance Items**:
- No data corruption under any circumstances
- No unhandled database errors
- No performance degradation from baseline
- No security vulnerabilities introduced

## Migration Sign-off Criteria

**Ready for Production When**:
- ✅ All 8 test scenarios pass completely
- ✅ Performance benchmarks achieved
- ✅ Integration tests pass 100%
- ✅ Error handling comprehensive
- ✅ Security requirements met
- ✅ Documentation complete
- ✅ Rollback procedures tested

**Migration Success Validation**:
1. All functional requirements demonstrated
2. Performance improvements measurable
3. Data integrity guaranteed
4. User experience unchanged
5. System stability confirmed

**Quickstart Validation Complete** ✅