# Quickstart: CSV Format Support

**Feature**: Add CSV Format Support for AWS Inspector Reports
**Date**: 2025-09-17
**Prerequisites**: Implementation complete, server running

## Quick Validation Steps

### 1. Verify Dependencies
```bash
# Check csv-parser dependency is installed
npm list csv-parser

# Expected output: csv-parser@3.0.0 (or latest version)
```

### 2. Start Development Server
```bash
npm start
# Server should start on http://localhost:3010
```

### 3. Test JSON Upload (Existing Functionality)
```bash
# Verify existing JSON uploads still work
curl -X POST http://localhost:3010/upload \
  -F "reportFile=@uploads/sample-report.json" \
  -H "Content-Type: multipart/form-data"

# Expected response:
# {
#   "success": true,
#   "message": "Report processed successfully",
#   "reportId": 123,
#   "vulnerabilityCount": 45,
#   "fileFormat": "json"
# }
```

### 4. Test CSV Upload (New Functionality)
```bash
# Test CSV upload with same data structure
curl -X POST http://localhost:3010/upload \
  -F "reportFile=@uploads/sample-report.csv" \
  -H "Content-Type: multipart/form-data"

# Expected response:
# {
#   "success": true,
#   "message": "Report processed successfully",
#   "reportId": 124,
#   "vulnerabilityCount": 45,
#   "fileFormat": "csv"
# }
```

### 5. Test Format Detection
```bash
# Test unsupported format rejection
curl -X POST http://localhost:3010/upload \
  -F "reportFile=@uploads/sample-report.xlsx" \
  -H "Content-Type: multipart/form-data"

# Expected response (415 status):
# {
#   "error": "Unsupported file format. Please upload .json or .csv files only.",
#   "supportedFormats": [".json", ".csv"],
#   "detectedFormat": ".xlsx"
# }
```

### 6. Test CSV Validation
```bash
# Test CSV with missing required columns
curl -X POST http://localhost:3010/upload \
  -F "reportFile=@uploads/invalid-report.csv" \
  -H "Content-Type: multipart/form-data"

# Expected response (400 status):
# {
#   "error": "CSV validation failed",
#   "validationErrors": [
#     {
#       "errorType": "MISSING_COLUMN",
#       "message": "Required column 'Finding ARN' not found in CSV",
#       "column": "Finding ARN"
#     }
#   ],
#   "requiredColumns": ["AWS Account Id", "Finding ARN", "Title", ...]
# }
```

## Frontend Testing

### 1. Navigate to Upload Page
```
Open: http://localhost:3010/
Click: "Upload Report" or navigate to upload section
```

### 2. Test File Picker
- **CSV files**: Should be accepted by file picker
- **JSON files**: Should continue to work as before
- **Other formats**: Should show browser-level rejection or server error

### 3. Upload Flow Verification
1. Select a CSV file
2. Click upload
3. Verify progress indicator shows
4. Confirm success message displays
5. Check vulnerabilities appear in dashboard

## Data Verification

### 1. Compare JSON vs CSV Results
```sql
-- Check that CSV and JSON uploads create same data structure
SELECT COUNT(*) FROM vulnerabilities WHERE report_id = [json_report_id];
SELECT COUNT(*) FROM vulnerabilities WHERE report_id = [csv_report_id];
-- Counts should be identical for same source data
```

### 2. Verify CSV-Specific Fields
```sql
-- Check that CSV uploads populate all expected fields
SELECT
  finding_arn,
  vulnerability_id,
  severity,
  fix_available,
  inspector_score,
  epss_score
FROM vulnerabilities
WHERE report_id = [csv_report_id]
LIMIT 5;
```

### 3. Verify Resource and Package Data
```sql
-- Check that resources are properly parsed
SELECT COUNT(*) FROM resources WHERE vulnerability_id IN (
  SELECT id FROM vulnerabilities WHERE report_id = [csv_report_id]
);

-- Check that packages are properly parsed
SELECT COUNT(*) FROM packages WHERE vulnerability_id IN (
  SELECT id FROM vulnerabilities WHERE report_id = [csv_report_id]
);
```

## Performance Testing

### 1. Large File Upload
```bash
# Test with maximum size file (100MB)
curl -X POST http://localhost:3010/upload \
  -F "reportFile=@uploads/large-report.csv" \
  -H "Content-Type: multipart/form-data" \
  --max-time 300

# Monitor server memory during upload
# Should not exceed normal processing levels
```

### 2. Processing Time Comparison
```bash
# Time JSON processing
time curl -X POST http://localhost:3010/upload \
  -F "reportFile=@uploads/report.json"

# Time CSV processing
time curl -X POST http://localhost:3010/upload \
  -F "reportFile=@uploads/report.csv"

# CSV should be comparable or faster than JSON
```

## Error Handling Verification

### 1. Malformed CSV Data
Test files with:
- Missing required columns
- Invalid data types (text in number fields)
- Malformed date formats
- Empty required fields
- Duplicate Finding ARNs

### 2. File System Errors
- File not found
- Permissions issues
- Disk space issues
- Large file timeouts

### 3. Memory Constraints
- Very large CSV files
- CSV files with many columns
- Concurrent uploads

## Regression Testing

### 1. Existing JSON Functionality
- All existing JSON uploads must continue working
- No performance degradation
- Same error messages for JSON issues
- Same success responses

### 2. Dashboard Display
- Vulnerabilities from CSV uploads appear correctly
- Filtering works with CSV-sourced data
- Export functionality works with CSV data
- Sorting and pagination unaffected

### 3. Database Integrity
- No schema changes required
- Foreign key relationships maintained
- Data types remain consistent
- Indexing performance unchanged

## Success Criteria Checklist

- [ ] JSON uploads work without regression
- [ ] CSV uploads process successfully
- [ ] File format detection works correctly
- [ ] Error messages are clear and specific
- [ ] Large files process within memory limits
- [ ] Dashboard displays CSV data correctly
- [ ] Performance is comparable between formats
- [ ] All validation rules enforce properly
- [ ] Frontend accepts both file types
- [ ] Database schema remains unchanged

## Troubleshooting

### Common Issues
1. **CSV Parser Not Found**: Run `npm install csv-parser`
2. **Format Detection Fails**: Check file extension logic
3. **Memory Issues**: Verify stream processing implementation
4. **Database Errors**: Ensure transformation creates valid JSON structure
5. **Frontend Issues**: Update file picker accept attribute

### Debug Commands
```bash
# Check uploaded files
ls -la uploads/

# Monitor server logs
tail -f logs/server.log

# Check database state
sqlite3 vulnerability.db ".tables"
```