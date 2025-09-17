# Test Suite for AWS Inspector Report Tool

## Contract Tests

### PUT /api/modules/{moduleId}/config Endpoint

This directory contains contract tests for the module configuration API endpoint as defined in `specs/001-i-want-to/contracts/settings-api.yaml`.

#### Test Files

1. **`contract/modules_config_put.test.js`** - Current TDD test file
   - Demonstrates expected failures until endpoint is implemented
   - Documents the OpenAPI contract requirements
   - Shows that dependencies need to be installed
   - **Status**: Currently passing (expected failures documented)

2. **`contract/modules_config_put_full.test.js`** - Comprehensive test suite
   - Full supertest-based HTTP testing
   - Complete coverage of all OpenAPI contract requirements
   - Database integration testing
   - **Status**: Ready to use once dependencies are installed and endpoint is implemented

#### Test Setup

1. **Install Dependencies**:
   ```bash
   npm install express supertest jest --save-dev
   ```

2. **Run Tests**:
   ```bash
   # Run current TDD tests
   npm run test:contract

   # Run specific test file
   npx jest tests/contract/modules_config_put.test.js --verbose
   ```

#### TDD Process

1. **Current State**: Tests demonstrate expected failures
2. **Next Steps**:
   - Install missing dependencies
   - Implement PUT `/api/modules/{moduleId}/config` endpoint in `server.js`
   - Replace current test with comprehensive version
   - Verify all tests pass

#### Test Coverage

The contract tests verify:

- **Successful Operations (200 OK)**:
  - Simple config updates
  - Complex nested objects
  - Array configurations
  - Data type preservation
  - Empty configurations

- **Request Validation (400 Bad Request)**:
  - Missing config parameter
  - Invalid config types (string, number, array, null)
  - Malformed JSON

- **Module Not Found (404 Not Found)**:
  - Non-existent module IDs
  - Empty module IDs
  - Special characters and path traversal attempts

- **Database Integration**:
  - Configuration persistence
  - Timestamp updates
  - Preservation of other module properties

#### OpenAPI Contract

Tests are based on the specification in:
`specs/001-i-want-to/contracts/settings-api.yaml`

Key contract requirements:
- Request body must contain `config` object
- Response includes `success` boolean and `config` object
- Error responses follow Error schema with required `error` field
- Supports HTTP status codes: 200, 400, 404

#### Database Schema

Tests use the `module_settings` table:
```sql
CREATE TABLE module_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT 0,
    is_default BOOLEAN DEFAULT 0,
    display_order INTEGER,
    config JSON,                              -- Target of PUT operations
    icon TEXT,
    route TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP  -- Updated by endpoint
);
```

#### Test Data

Default test modules:
- `aws-inspector`: AWS Inspector vulnerability reports
- `sbom`: SBOM Reports
- `compliance`: Security compliance reports

Each test run uses an in-memory SQLite database for isolation.