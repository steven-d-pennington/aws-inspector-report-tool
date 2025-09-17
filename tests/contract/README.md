# Contract Tests for Settings API

This directory contains contract tests that validate API endpoints against the OpenAPI specification defined in `/specs/001-i-want-to/contracts/settings-api.yaml`.

## Test-Driven Development (TDD) Approach

These tests are designed to **FAIL INITIALLY** as part of the TDD methodology. They define the expected behavior of API endpoints before the actual implementation exists.

## GET /api/modules/{moduleId}/config Endpoint Test

### File: `test_modules_config_get.js`

This test validates the module configuration endpoint according to the OpenAPI specification.

#### Test Coverage

1. **Successful Response (200)**
   - Returns valid config object for existing modules
   - Config can be any JSON structure (additionalProperties: true)
   - Empty config returns empty object

2. **Error Handling (404)**
   - Non-existent modules return proper error response
   - Error response matches OpenAPI Error schema

3. **Input Validation**
   - Various module ID formats (kebab-case, snake_case, camelCase)
   - Special characters and edge cases
   - URL encoding handling

4. **HTTP Compliance**
   - Proper Content-Type headers (application/json)
   - Response time validation
   - Concurrent request handling

5. **OpenAPI Schema Compliance**
   - Response structure matches specification
   - Required and optional properties validation
   - Error schema validation

#### Expected Test Results (Initially)

✅ **PASSING Tests:**
- 404 for non-existent modules
- Error response structure validation
- HTTP method validation
- Header validation

❌ **FAILING Tests (Expected in TDD):**
- 200 response for existing modules
- Config object validation
- Empty config handling
- Performance tests

#### Test Dependencies

```bash
npm install --save-dev mocha chai supertest
```

#### Running the Tests

```bash
# Run all contract tests
npm run test:contract

# Run specific test file
npx mocha tests/contract/test_modules_config_get.js --timeout 10000

# Validate test structure (without running)
node tests/contract-test-validation.js
```

#### Test Structure Validation

Use the validation script to ensure the test follows TDD principles:

```bash
node tests/contract-test-validation.js
```

This script verifies:
- Test file structure and imports
- OpenAPI specification coverage
- TDD approach implementation
- Mock endpoint behavior

#### Implementation Checklist

When implementing the actual endpoint, ensure:

- [ ] Endpoint matches path: `GET /api/modules/{moduleId}/config`
- [ ] Returns 200 with `{config: object}` for valid modules
- [ ] Returns 404 with error object for invalid modules
- [ ] Config object supports `additionalProperties: true`
- [ ] Proper Content-Type headers
- [ ] Input validation and sanitization
- [ ] Error handling for edge cases

#### Mock Implementation

The test includes a mock implementation that:
- Returns 404 for all requests (ensuring tests fail)
- Provides proper error response structure
- Demonstrates expected endpoint behavior

This mock will be replaced when the actual endpoint is implemented.

#### Next Steps

1. **Implement the actual endpoint** in `server.js`
2. **Add database integration** for module configuration storage
3. **Run tests again** to verify implementation
4. **Refactor tests** to remove mock and use actual server
5. **Add integration tests** for database interactions

#### OpenAPI Specification Reference

See `/specs/001-i-want-to/contracts/settings-api.yaml` lines 178-204 for the complete specification of this endpoint.