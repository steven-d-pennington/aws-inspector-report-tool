# GET /api/settings Contract Test Specification

## Test Status: READY TO FAIL (TDD Approach)

This document outlines the contract tests for the GET /api/settings endpoint based on the OpenAPI specification in `specs/001-i-want-to/contracts/settings-api.yaml`.

## Test File Location
- **Primary Test**: `tests/contract/test_settings_get.js`
- **Framework**: Mocha + Supertest + Chai
- **Run Command**: `npm run test:contract`

## Contract Requirements (from OpenAPI spec)

### 1. HTTP Status Code
- **Expected**: 200 OK
- **Current**: 404 (endpoint not implemented) ❌ FAIL

### 2. Response Content-Type
- **Expected**: `application/json`
- **Current**: Not applicable (404) ❌ FAIL

### 3. Response Structure
```json
{
  "settings": {
    "<setting_key>": {
      "value": "<any_type>",
      "type": "string|boolean|number|json",
      "description": "<string>"
    }
  }
}
```

### 4. Required Default Settings
Based on the OpenAPI specification example:

#### app_title
```json
{
  "value": "AWS Security Dashboard",
  "type": "string",
  "description": "Application title"
}
```

#### theme
```json
{
  "value": "light",
  "type": "string",
  "description": "UI theme"
}
```

#### auto_refresh
```json
{
  "value": false,
  "type": "boolean",
  "description": "Auto-refresh dashboard"
}
```

#### refresh_interval (optional)
If implemented, should follow the same structure pattern.

### 5. Data Type Validation
- Setting `value` must match the declared `type`
- `type` must be one of: "string", "boolean", "number", "json"
- `description` must be a non-empty string

## Test Cases Implemented

### ✅ Contract Validation Tests
1. **Status Code Test**: Expects 200, currently fails with 404
2. **Content-Type Test**: Expects application/json header
3. **Response Structure Test**: Validates `settings` object exists
4. **Setting Object Structure Test**: Validates each setting has `value`, `type`, `description`
5. **Default Settings Test**: Validates required settings are present
6. **Type Validation Test**: Ensures values match their declared types
7. **OpenAPI Specification Compliance Test**: Validates exact contract match

### ✅ Error Handling Tests
1. **Malformed Request Handling**: Tests graceful error responses

## TDD Workflow

### Phase 1: RED (Current State) ❌
- All tests FAIL because `/api/settings` endpoint returns 404
- This is the expected initial state for TDD

### Phase 2: GREEN (Implementation Required) 🔄
To make tests pass, implement in `server.js`:
```javascript
app.get('/api/settings', async (req, res) => {
  try {
    // Implementation should return structure matching OpenAPI spec
    const settings = {
      settings: {
        app_title: {
          value: "AWS Security Dashboard",
          type: "string",
          description: "Application title"
        },
        theme: {
          value: "light",
          type: "string",
          description: "UI theme"
        },
        auto_refresh: {
          value: false,
          type: "boolean",
          description: "Auto-refresh dashboard"
        }
      }
    };
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Phase 3: REFACTOR (Future) ♻️
- Add database persistence for settings
- Add validation and sanitization
- Add authentication/authorization if needed
- Add caching for performance

## Running the Tests

Once dependencies are properly installed:

```bash
# Run all contract tests
npm run test:contract

# Run specific settings test
npx mocha tests/contract/test_settings_get.js --timeout 10000

# Run with verbose output
npx mocha tests/contract/test_settings_get.js --timeout 10000 --reporter spec
```

## Expected Test Output (Before Implementation)

```
GET /api/settings Contract Tests
  API Contract Validation
    ✗ should return 200 status code for successful request
    ✗ should return Content-Type application/json
    ✗ should return response with settings object structure
    ✗ should have setting objects with required properties
    ✗ should include default application settings
    ✗ should validate setting value types match their declared types
    ✗ should match the exact OpenAPI specification example structure
  Error Handling
    ✓ should handle malformed requests gracefully

  1 passing (Xms)
  7 failing
```

## Integration Notes

- Tests are framework-agnostic and can be adapted to other testing libraries
- Contract tests should run in CI/CD pipeline before deployment
- Tests serve as living documentation of the API contract
- Consider adding performance benchmarks for settings retrieval

## Dependencies Required

```json
{
  "devDependencies": {
    "mocha": "^11.7.2",
    "supertest": "^7.1.4",
    "chai": "^6.0.1"
  }
}
```