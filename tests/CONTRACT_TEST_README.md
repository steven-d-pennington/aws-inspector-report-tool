# Contract Tests for PUT /api/modules/{moduleId}/toggle

## Overview

This document describes the comprehensive contract tests created for the `PUT /api/modules/{moduleId}/toggle` endpoint, following Test-Driven Development (TDD) principles.

## Test File Location

```
tests/contract/test_modules_toggle.js
```

## Purpose

The contract tests validate that the API endpoint implementation adheres to the OpenAPI specification defined in `specs/001-i-want-to/contracts/settings-api.yaml`.

## TDD Approach - Tests MUST FAIL Initially

**IMPORTANT**: These tests are designed to FAIL until the actual endpoint is implemented. This follows TDD principles where tests are written first and serve as specifications for the implementation.

## Test Structure

### 1. Database Setup and Teardown

- **Before Each Test**: Initializes database with test modules
- **After All Tests**: Closes database connections and server
- **Test Data**: Creates three test modules:
  - `aws-inspector` (enabled, default)
  - `sbom` (disabled, non-default)
  - `test-module` (enabled, non-default)

### 2. Test Categories

#### A. Successful Module Toggle (200 Response)

Tests that verify successful toggle operations when the endpoint is implemented:

- **Toggle Enabled → Disabled**: Tests disabling an active module
- **Toggle Disabled → Enabled**: Tests enabling an inactive module
- **Response Schema Validation**: Ensures response matches OpenAPI spec
  - `success: boolean`
  - `module: Module` object with all required properties

#### B. Request Body Validation (400 Response)

Tests for proper input validation:

- **Missing enabled field**: Request body without required `enabled` property
- **Invalid enabled type**: Non-boolean values for `enabled` field
- **Empty request body**: No JSON payload provided
- **Default module protection**: Attempting to disable the default module

#### C. Module Not Found (404 Response)

Tests for non-existent modules:

- **Non-existent module ID**: Module that doesn't exist in database
- **Empty module ID**: Invalid path parameter

#### D. Path Parameter Validation

Tests for URL parameter handling:

- **Special characters**: Module IDs with hyphens, underscores, numbers
- **Invalid characters**: Spaces, slashes, and other invalid characters

#### E. Content-Type Validation

Tests for HTTP header validation:

- **JSON content-type**: Proper `application/json` header
- **Invalid content-type**: Non-JSON content types (should be rejected)

#### F. Database State Validation

Tests that verify database persistence:

- **State persistence**: Changes are saved to `module_settings` table
- **Timestamp updates**: `updated_at` field is modified on changes
- **Atomic operations**: Database consistency maintained

#### G. Edge Cases and Error Handling

Advanced scenarios:

- **Concurrent requests**: Multiple simultaneous toggle operations
- **Module ID format validation**: Various invalid module ID formats

## OpenAPI Specification Compliance

The tests validate against the exact schema defined in `settings-api.yaml`:

### Request Schema
```json
{
  "type": "object",
  "properties": {
    "enabled": {
      "type": "boolean"
    }
  },
  "required": ["enabled"]
}
```

### Response Schemas

**200 Success Response:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "module": { "$ref": "#/components/schemas/Module" }
  }
}
```

**Error Response (400/404):**
```json
{
  "type": "object",
  "properties": {
    "error": { "type": "string" },
    "code": { "type": "string" },
    "details": { "type": "object" }
  },
  "required": ["error"]
}
```

**Module Schema:**
```json
{
  "type": "object",
  "properties": {
    "module_id": { "type": "string" },
    "name": { "type": "string" },
    "description": { "type": "string" },
    "enabled": { "type": "boolean" },
    "is_default": { "type": "boolean" },
    "display_order": { "type": "integer" },
    "route": { "type": "string" },
    "created_at": { "type": "string", "format": "date-time" },
    "updated_at": { "type": "string", "format": "date-time" }
  },
  "required": ["module_id", "name", "enabled"]
}
```

## Running the Tests

### Prerequisites

Install testing dependencies:
```bash
npm install --save-dev mocha supertest chai
```

### Test Execution

Run all contract tests:
```bash
npm run test:contract
```

Run specific toggle tests:
```bash
npm test -- tests/contract/test_modules_toggle.js
```

### Expected Results (Before Implementation)

All tests should **FAIL** with 404 errors because the endpoint doesn't exist yet:

```
PUT /api/modules/{moduleId}/toggle - Contract Tests
  Contract Validation - OpenAPI Specification Compliance
    Successful Module Toggle (200 Response)
      ✗ should toggle module from enabled to disabled with correct response schema
      ✗ should toggle module from disabled to enabled with correct response schema
    Request Body Validation (400 Response)
      ✗ should return 400 when enabled field is missing
      ✗ should return 400 when enabled field is not boolean
      [... all tests fail with 404 Not Found]
```

## Implementation Requirements

When implementing the actual endpoint, ensure:

1. **Route Definition**: Add `PUT /api/modules/:moduleId/toggle` to Express router
2. **Request Validation**: Validate `enabled` field is present and boolean
3. **Database Operations**: Update `module_settings` table
4. **Business Logic**: Prevent disabling default modules
5. **Response Format**: Return exact schema as specified
6. **Error Handling**: Proper HTTP status codes and error messages
7. **Timestamp Updates**: Automatic `updated_at` field updates

## Success Criteria

Once the endpoint is implemented correctly:

- All contract tests should **PASS**
- Database state changes should persist
- Response schemas should match OpenAPI specification exactly
- Error cases should return appropriate HTTP status codes
- Business rules (e.g., default module protection) should be enforced

## Database Schema

The tests work with the `module_settings` table:

```sql
CREATE TABLE module_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT 0,
    is_default BOOLEAN DEFAULT 0,
    display_order INTEGER,
    config JSON,
    icon TEXT,
    route TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Notes

- Tests use a separate database instance to avoid affecting application data
- Database is reset before each test to ensure isolation
- Tests are designed to be deterministic and repeatable
- All async operations are properly awaited
- Proper cleanup is performed after test completion