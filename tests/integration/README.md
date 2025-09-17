# Integration Tests for Default Module State

## Overview

This directory contains integration tests that verify the complete user experience described in the quickstart guide. The tests follow Test-Driven Development (TDD) principles and are designed to **FAIL initially** until the UI integration features are implemented.

## Test Files

### `test_default_state.js`
Complete integration test using Puppeteer for browser automation and Supertest for API testing. This is the full-featured test that will be used once dependencies are properly installed.

**Features:**
- Browser automation with Puppeteer
- API contract testing with Supertest
- Database setup/teardown with SQLite
- Performance benchmarking
- Complete UI interaction testing

### `run_default_state_test.js`
Simplified test runner that works without external dependencies. This demonstrates the TDD approach by showing expected failures.

**Features:**
- Custom test framework implementation
- Mock browser and HTTP implementations
- Clear failure reporting
- TDD validation

## Test Scenarios

Based on `specs/001-i-want-to/quickstart.md`, the tests verify:

### 1. Default State Verification
- ✅ AWS Inspector tab is visible and active on page load
- ✅ SBOM tab is NOT visible (disabled by default)
- ✅ Existing AWS Inspector functionality still works
- ✅ Settings show correct default state

### 2. API Contract Verification
- ✅ `/api/modules` returns correct module states
- ✅ `/api/settings` reflects module configuration
- ✅ Module toggles work via API

### 3. Navigation and Tab Behavior
- ✅ Only AWS Inspector tab visible initially
- ✅ No SBOM navigation elements present
- ✅ Tab switching behavior (when implemented)

### 4. Performance Requirements
- ✅ Page load under 2 seconds
- ✅ Tab switching under 100ms
- ✅ Settings save under 200ms

## Running the Tests

### Quick TDD Validation
```bash
node tests/integration/run_default_state_test.js
```

### Full Integration Test (requires dependencies)
```bash
npm test tests/integration/test_default_state.js
```

## Expected Results (TDD)

**Current State:** All tests should FAIL
- Reason: UI integration not implemented yet
- This confirms TDD approach is working correctly

**Future State:** Tests should PASS after implementing:
1. Modular tab UI components with `data-testid` attributes
2. API endpoints for module management (`/api/modules`, `/api/settings`)
3. Settings page with module toggles
4. Database integration for module state persistence

## Test Data Attributes Required

The tests expect these `data-testid` attributes in the UI:

### Navigation/Tabs
- `aws-inspector-tab` - AWS Inspector tab button
- `sbom-tab` - SBOM tab button (should not exist initially)

### Content Areas
- `aws-inspector-content` - Main AWS Inspector dashboard
- `vulnerability-metrics` - Vulnerability statistics section
- `upload-section` - File upload area

### Settings Page
- `module-toggle-aws-inspector` - AWS Inspector enable/disable toggle
- `module-toggle-sbom` - SBOM enable/disable toggle

### API Endpoints Required

- `GET /api/modules` - List all modules with their status
- `GET /api/settings` - Get current application settings
- `PUT /api/modules/:id/toggle` - Toggle module enabled state
- `PUT /api/settings` - Update application settings

## Database Schema Required

The tests expect these database tables:

### `modules` table
```sql
CREATE TABLE modules (
    module_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT 0,
    is_default BOOLEAN DEFAULT 0,
    display_order INTEGER,
    route TEXT
);
```

### `settings` table
```sql
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    type TEXT DEFAULT 'string'
);
```

## Test Environment Setup

1. **Database:** Uses test-specific SQLite database
2. **Server:** Starts on random port for isolation
3. **Browser:** Headless Puppeteer for UI testing
4. **Cleanup:** Automatic teardown after each test

## TDD Workflow

1. ✅ **Red:** Tests fail (current state)
2. 🔄 **Green:** Implement features to make tests pass
3. 🔄 **Refactor:** Improve implementation while keeping tests green

## Troubleshooting

### If tests pass unexpectedly:
- Check if UI components already exist
- Verify API endpoints aren't already implemented
- Ensure test database is clean

### If tests fail for wrong reasons:
- Check server startup errors
- Verify database permissions
- Ensure port availability

### Common Issues:
- **Dependencies:** Install `puppeteer`, `chai`, `supertest`
- **Permissions:** Ensure database write access
- **Ports:** Avoid conflicts with development server

## Integration with CI/CD

These tests are designed to be run in continuous integration:

```yaml
# Example GitHub Actions step
- name: Run Integration Tests
  run: npm run test:integration
  env:
    NODE_ENV: test
    DB_PATH: :memory:
```

## Performance Monitoring

The tests include performance benchmarks:
- Page load time < 2000ms
- Tab switching < 100ms
- API response < 200ms

These can be monitored over time to catch performance regressions.