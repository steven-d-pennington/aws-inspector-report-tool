# Quickstart: Inspector Report Generation Date Tracking

**Feature**: Date picker for report generation date tracking
**Test Duration**: ~10 minutes
**Prerequisites**: Vulnerability dashboard running locally

## Test Scenario Overview

This quickstart validates the core functionality of the date picker feature for tracking when AWS Inspector reports were actually generated, separate from when they were uploaded to the system.

## Setup

1. **Start the application**:
   ```bash
   cd vulnerability-dashboard
   npm start
   ```

2. **Prepare test files**:
   - Use an existing AWS Inspector report (JSON or CSV)
   - Or create a minimal test file for upload testing

3. **Access upload page**:
   - Navigate to `http://localhost:3000`
   - Should see the standard upload interface

## Core User Journey Test

### Test 1: Basic Date Picker Functionality

**Objective**: Verify date picker appears and functions correctly

**Steps**:
1. **Initial State**:
   - Load upload page
   - ✅ **VERIFY**: Date picker section is NOT visible
   - ✅ **VERIFY**: Only file upload area is shown

2. **File Selection**:
   - Click "Choose File" or drag/drop a report file
   - ✅ **VERIFY**: Date picker section becomes visible
   - ✅ **VERIFY**: Date input field is displayed with today's date as default
   - ✅ **VERIFY**: Helper text explains the purpose

3. **Date Validation**:
   - Try to select a future date
   - ✅ **VERIFY**: Error message appears preventing future dates
   - Select a date from 1 week ago
   - ✅ **VERIFY**: Date is accepted without error

### Test 2: Upload with Generation Date

**Objective**: Verify complete upload workflow with date tracking

**Steps**:
1. **File and Date Selection**:
   - Select a valid Inspector report file
   - Set report generation date to 3 days ago
   - ✅ **VERIFY**: Upload button is enabled

2. **Submit Upload**:
   - Click "Upload Report"
   - ✅ **VERIFY**: Upload succeeds with success message
   - ✅ **VERIFY**: Response includes both upload date and report run date

3. **Data Verification**:
   - Check upload response JSON
   - ✅ **VERIFY**: `uploadDate` is current timestamp
   - ✅ **VERIFY**: `reportRunDate` matches selected date
   - ✅ **VERIFY**: Both dates are properly formatted (ISO 8601)

### Test 3: Historical Upload Scenario

**Objective**: Verify historical report upload with older generation date

**Steps**:
1. **Historical Date Selection**:
   - Select same test file
   - Set report generation date to 6 months ago
   - ✅ **VERIFY**: Date is accepted

2. **Upload Processing**:
   - Submit upload
   - ✅ **VERIFY**: Upload processes successfully
   - ✅ **VERIFY**: Historical context is preserved

3. **Timeline Verification**:
   - Navigate to Dashboard or Reports view
   - ✅ **VERIFY**: Report shows both generation and upload dates
   - ✅ **VERIFY**: Dates are clearly differentiated in UI

### Test 4: Edge Cases and Validation

**Objective**: Verify error handling and validation rules

**Steps**:
1. **Missing Date Test**:
   - Select file but leave date picker empty
   - Try to submit
   - ✅ **VERIFY**: Validation error prevents submission

2. **Invalid Date Range**:
   - Try to select date more than 2 years old
   - ✅ **VERIFY**: Error message appears or date is rejected

3. **Form Reset**:
   - Clear file selection
   - ✅ **VERIFY**: Date picker section becomes hidden again

### Test 5: Archiving Integration

**Objective**: Verify report run date is preserved during vulnerability archiving

**Steps**:
1. **Upload Initial Report**:
   - Upload report with generation date 1 month ago
   - Note vulnerabilities found

2. **Upload Updated Report** (if available):
   - Upload newer report that resolves some vulnerabilities
   - ✅ **VERIFY**: Archiving process preserves original generation dates

3. **Check Historical Records**:
   - View fixed vulnerabilities page
   - ✅ **VERIFY**: Historical records show original report run dates

## Expected Results Summary

After completing all tests, verify:

- ✅ Date picker appears/hides based on file selection
- ✅ Date validation prevents future dates and excessive historical dates
- ✅ Upload process captures both upload and generation dates
- ✅ Database stores both temporal values correctly
- ✅ UI displays both dates clearly to users
- ✅ Historical timeline reconstruction works accurately
- ✅ Archiving process preserves report run date context

## Troubleshooting

### Common Issues

**Date picker not appearing**:
- Check JavaScript console for errors
- Verify file selection event is triggering properly

**Validation not working**:
- Check date input max/min attributes are set
- Verify server-side validation is implemented

**Upload failing**:
- Check server logs for validation errors
- Verify form includes reportRunDate field

**Dates not displaying**:
- Check database schema includes report_run_date columns
- Verify view templates are updated to show both dates

### Debug Commands

```bash
# Check database schema
sqlite3 db/vulnerabilities.db ".schema reports"

# Verify recent uploads
sqlite3 db/vulnerabilities.db "SELECT filename, upload_date, report_run_date FROM reports ORDER BY id DESC LIMIT 5"

# Check JavaScript console
# Browser DevTools → Console → Look for date picker related errors
```

## Success Criteria

This quickstart passes if:

1. **Core Functionality**: Date picker shows/hides correctly based on file selection
2. **Validation**: Future dates and invalid ranges are properly rejected
3. **Data Persistence**: Both upload and generation dates are stored and retrievable
4. **User Experience**: Clear feedback and intuitive workflow for date selection
5. **Historical Accuracy**: Timeline reconstruction works with mixed upload/generation dates
6. **Integration**: Existing upload workflow continues to function normally

## Next Steps

After successful quickstart:

1. **Performance Testing**: Test with large files and multiple uploads
2. **Browser Compatibility**: Verify functionality across supported browsers
3. **Edge Case Testing**: Test boundary conditions and error scenarios
4. **User Acceptance**: Gather feedback on date picker placement and usability

This quickstart validates that the date picker feature enables accurate historical vulnerability tracking while maintaining system usability and data integrity.