# Contract Tests for Date Picker Feature

This directory contains comprehensive contract tests for the date picker feature that **MUST FAIL** before implementation, following Test-Driven Development (TDD) principles.

## Test Files Created

### 1. `test_upload_with_date.js`
Tests the POST /upload endpoint with reportRunDate field according to the upload-endpoint.json contract.

**Key Test Scenarios:**
- ✅ Successful upload with valid reportRunDate (today)
- ✅ Successful upload with historical dates (1 week, 1 year ago)
- ✅ Proper response format validation (uploadDate vs reportRunDate)
- ❌ Rejection of missing reportRunDate
- ❌ Rejection of future dates
- ❌ Rejection of dates more than 2 years old
- ❌ Rejection of invalid date formats
- ✅ Support for both JSON and CSV files
- ✅ Edge cases (leap years, boundary conditions)

**Current Status:** ❌ **42 tests failing** (as expected - functionality not implemented)

### 2. `test_date_validation.js`
Tests date validation logic for the reportRunDate field.

**Key Test Scenarios:**
- ✅ Valid date acceptance (today, yesterday, historical dates)
- ❌ Future date rejection with specific error messages
- ❌ Too old date rejection (>2 years)
- ❌ Invalid format rejection (various formats tested)
- ✅ Edge cases (leap years, month boundaries, timezone independence)
- ✅ Utility method testing (isValidDateFormat, isFutureDate, isTooOld)

**Current Status:** ❌ **21 tests failing** (as expected - dateValidator module not implemented)

### 3. `test_date_picker_component.js`
Tests date picker component behavior in the browser frontend.

**Key Test Scenarios:**
- ✅ Initial state (date picker hidden)
- ❌ Date picker appears when file selected
- ❌ Date picker validation integration
- ❌ Form submission with date validation
- ❌ Clear functionality resets date picker
- ✅ Accessibility and UX requirements
- ❌ Error handling and user feedback

**Current Status:** ❌ **19 tests failing** (as expected - date picker not implemented)

## Test Environment Setup

### Dependencies Added
- `jest@^29.7.0` - Testing framework
- `supertest@^6.3.3` - HTTP endpoint testing
- `@jest/globals@^29.7.0` - Jest globals
- `jsdom@^22.1.0` - DOM testing environment

### Configuration Files
- `jest.config.js` - Jest configuration
- `tests/setup.js` - Global test setup and utilities

### Test Scripts
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage

## Contract Compliance

These tests validate the following contracts:

### Upload Endpoint Contract
- **Endpoint:** POST /upload
- **Content-Type:** multipart/form-data
- **Required Fields:** file, reportRunDate
- **Date Format:** YYYY-MM-DD
- **Date Constraints:** No future dates, max 2 years old

### Response Format Contract
```json
{
  "success": true,
  "message": "Report uploaded and processed successfully",
  "reportId": "integer",
  "filename": "string",
  "fileFormat": "string (json|csv)",
  "uploadDate": "string (ISO 8601 datetime)",
  "reportRunDate": "string (ISO 8601 datetime)",
  "vulnerabilityCount": "integer",
  "awsAccountId": "string",
  "processingTime": "integer (milliseconds)"
}
```

### Error Response Contract
```json
{
  "success": false,
  "error": "Validation failed",
  "details": "string (specific error message)",
  "field": "string (reportRunDate|file)"
}
```

## Implementation Requirements

To make these tests pass, the following needs to be implemented:

### Backend Changes
1. **Date Validation Module** (`src/utils/dateValidator.js`)
   - `validateReportRunDate(dateString)` function
   - `isValidDateFormat(dateString)` function
   - `isFutureDate(dateString)` function
   - `isTooOld(dateString)` function

2. **Upload Endpoint Enhancement** (`server.js`)
   - Accept `reportRunDate` field in multipart form
   - Validate date before processing
   - Store both upload_date and report_run_date
   - Return both dates in response

3. **Database Schema Updates**
   - Add `report_run_date` column to reports table
   - Add `report_run_date` column to vulnerability_history table

### Frontend Changes
1. **Date Picker Component** (enhance `public/js/upload.js`)
   - Show date picker when file selected
   - Default to today's date
   - Real-time validation
   - Error message display

2. **Upload Form Integration**
   - Include reportRunDate in FormData
   - Prevent submission with invalid dates
   - Display validation errors

3. **UI Components** (enhance `views/index.ejs`)
   - Date input field with label
   - Error message container
   - Proper styling and accessibility

## Running Tests

```bash
# Install dependencies
npm install

# Run all tests (should show failures before implementation)
npm test

# Expected output: 42 failed tests, demonstrating TDD approach
```

## Success Criteria

All tests should **FAIL** before implementation and **PASS** after implementation:

- **Before Implementation:** ❌ 42 tests failing (current state)
- **After Implementation:** ✅ 64 tests passing (target state)

This ensures we're following true Test-Driven Development where:
1. Write tests first (✅ Done)
2. Watch tests fail (✅ Confirmed)
3. Implement functionality (🚧 Next step)
4. Watch tests pass (🎯 Goal)

## Test Coverage Areas

- ✅ **Contract Validation** - API endpoints match specifications
- ✅ **Input Validation** - Date format and range validation
- ✅ **Error Handling** - Proper error responses and messages
- ✅ **Edge Cases** - Leap years, boundaries, timezones
- ✅ **Integration** - Frontend-backend communication
- ✅ **UX/Accessibility** - User interface requirements
- ✅ **Data Flow** - Upload date vs report generation date separation

---

**Next Steps:** Implement the date picker functionality to make these contract tests pass, ensuring full compliance with the feature specification and upload-endpoint.json contract.