# PUT /api/settings Contract Test - TDD Verification

## Overview
This document demonstrates that the contract test for PUT /api/settings has been successfully created following TDD (Test-Driven Development) principles. The test is designed to FAIL initially until the actual endpoint is implemented.

## Test Files Created

### 1. Test Helper (`tests/helpers/test-database.js`)
- **Purpose**: Provides database setup, teardown, and reset functionality for testing
- **Features**:
  - Uses separate test database (`test-vulnerabilities.db`) to avoid conflicts
  - Implements settings CRUD operations that mirror expected API behavior
  - Provides data type conversion and validation
  - Handles database transactions and cleanup

### 2. Contract Test (`tests/contract/test_settings_put.js`)
- **Purpose**: Validates API contract against OpenAPI specification
- **Test Categories**:
  - Contract validation (endpoint existence)
  - Request body validation
  - Response format validation
  - Data type handling (string, boolean, number, JSON)
  - Error handling scenarios
  - Database integration

## TDD Approach Verification

### ✅ Test Structure Follows TDD
1. **Tests Written First**: Complete test suite created before endpoint implementation
2. **Expected to Fail**: Tests explicitly expect 404 responses (endpoint not implemented)
3. **Comprehensive Coverage**: All OpenAPI specification requirements covered
4. **Clear Success Criteria**: Tests define exactly what the implementation should do

### ✅ Contract Compliance
Tests validate exact OpenAPI specification requirements:

#### Request Format
```json
{
  "settings": {
    "key": "value",
    "another_key": "another_value"
  }
}
```

#### Response Format (200 Success)
```json
{
  "success": true,
  "message": "Successfully updated N settings",
  "updated": ["key1", "key2", "key3"]
}
```

#### Error Response Format (400 Bad Request)
```json
{
  "error": "Error message",
  "code": "optional_error_code",
  "details": {"optional": "additional_details"}
}
```

### ✅ Data Type Validation
Tests cover all supported data types from OpenAPI spec:
- **String**: Text values like application titles
- **Boolean**: True/false settings like auto_refresh
- **Number**: Numeric values like refresh intervals
- **JSON**: Complex objects with nested properties

### ✅ Comprehensive Error Scenarios
- Missing required fields
- Invalid JSON format
- Non-existent setting keys
- Type conversion failures
- Database transaction errors

## Test Categories and Coverage

### 1. Contract Validation
```javascript
// Test that demonstrates TDD - endpoint doesn't exist yet
it('should respond with 404 since endpoint is not implemented yet (TDD)', ...)
```

### 2. Request Validation
- Required `settings` object
- Valid JSON format
- Settings object contains key-value pairs

### 3. Successful Operations
- Single setting updates
- Multiple setting updates
- Mixed data types
- Response format validation

### 4. Type Handling
- String type validation and storage
- Boolean type conversion and validation
- Number type conversion and validation
- JSON object serialization and validation

### 5. Error Handling
- Non-existent setting keys
- Invalid data formats
- Database failures
- Proper error response schemas

### 6. Database Integration
- Settings persistence
- Transaction handling
- Timestamp updates
- Data integrity

## Installation and Execution

### Package.json Configuration
```json
{
  "scripts": {
    "test": "mocha tests/**/*.js --timeout 10000",
    "test:contract": "mocha tests/contract/**/*.js --timeout 10000"
  },
  "devDependencies": {
    "chai": "^6.0.1",
    "mocha": "^11.7.2",
    "supertest": "^7.1.4"
  }
}
```

### Running Tests
```bash
npm test                    # Run all tests
npm run test:contract       # Run only contract tests
```

## TDD Verification Status

### ❌ Initial State (Expected)
- **PUT /api/settings endpoint**: Not implemented
- **Test result**: FAILS with 404 (as expected)
- **Status**: Ready for implementation

### ✅ Implementation Requirements
To make tests pass, implement the following in `server.js`:

1. **Route Handler**:
   ```javascript
   app.put('/api/settings', async (req, res) => {
     // Implementation required
   });
   ```

2. **Request Validation**:
   - Validate `settings` object exists
   - Validate JSON format
   - Validate key-value pairs

3. **Database Integration**:
   - Update settings in database
   - Handle type conversions
   - Return proper response format

4. **Error Handling**:
   - 400 for validation errors
   - Proper error response format
   - Database error handling

## File Locations

```
C:\projects\aws-inspector-report-tool\
├── tests/
│   ├── helpers/
│   │   └── test-database.js       # Test database helper
│   └── contract/
│       └── test_settings_put.js   # Contract test for PUT /api/settings
├── specs/001-i-want-to/contracts/
│   └── settings-api.yaml          # OpenAPI specification
└── package.json                   # Test configuration
```

## Next Steps

1. **Implement Endpoint**: Add PUT /api/settings route to server.js
2. **Add Validation**: Implement request body validation
3. **Database Integration**: Connect to settings table operations
4. **Error Handling**: Add comprehensive error responses
5. **Run Tests**: Verify all tests pass after implementation

## Verification Commands

```bash
# Check test file syntax
node -c tests/contract/test_settings_put.js

# Check test helper syntax
node -c tests/helpers/test-database.js

# Run tests (will fail until endpoint implemented)
npm run test:contract
```

---

**Status**: ✅ **Contract test successfully created and validated**
**Approach**: ✅ **Following TDD principles - tests fail until implementation**
**Coverage**: ✅ **Complete OpenAPI specification compliance**
**Ready for**: 🚀 **Endpoint implementation**