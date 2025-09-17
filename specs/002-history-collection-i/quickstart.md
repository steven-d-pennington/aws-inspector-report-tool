# Quickstart: Vulnerability History Tracking Feature Testing

## Overview
This quickstart guide provides step-by-step instructions to validate the vulnerability history tracking and fixed vulnerabilities reporting functionality. Follow these scenarios to ensure the feature works as specified across multiple report uploads.

## Prerequisites
- Vulnerability dashboard is running on http://localhost:3010
- Database has been migrated with new history tables
- At least 2 different AWS Inspector JSON reports available for testing
- Browser with developer tools access for verification

## Test Scenarios

### Scenario 1: Initial Report Upload with History Setup

**Objective**: Verify that the first report upload creates the baseline for history tracking

**Steps**:
1. Ensure database is empty or has minimal test data
2. Navigate to http://localhost:3010
3. Upload the first AWS Inspector JSON report (Report A)
4. Verify upload completes successfully
5. Navigate to http://localhost:3010/fixed-vulnerabilities
6. Verify the fixed vulnerabilities page loads but shows no fixed vulnerabilities (expected)

**Expected Results**:
- ✅ Upload processes successfully without errors
- ✅ Current vulnerabilities are populated in main tables
- ✅ Fixed vulnerabilities page shows "No fixed vulnerabilities found" message
- ✅ No records in vulnerability_history table (first upload baseline)
- ✅ Upload event is logged with COMPLETED status

**Validation Queries**:
```sql
-- Should return 0 for first upload
SELECT COUNT(*) FROM vulnerability_history;

-- Should return 1 completed upload
SELECT status, records_imported FROM upload_events WHERE status = 'COMPLETED';

-- Should show current vulnerabilities count
SELECT COUNT(*) FROM vulnerabilities;
```

### Scenario 2: Second Report Upload with History Preservation

**Objective**: Verify that uploading a second report preserves history and identifies fixed vulnerabilities

**Steps**:
1. Prepare a second AWS Inspector JSON report (Report B) that has some different vulnerabilities than Report A
2. Navigate to http://localhost:3010
3. Upload the second report (Report B)
4. Verify upload completes successfully
5. Navigate to http://localhost:3010/fixed-vulnerabilities
6. Verify fixed vulnerabilities are displayed (vulnerabilities from Report A not in Report B)

**Expected Results**:
- ✅ Upload processes with history preservation workflow
- ✅ Previous vulnerabilities are archived to history tables before new data import
- ✅ Fixed vulnerabilities page shows vulnerabilities that existed in Report A but not in Report B
- ✅ Current vulnerabilities table contains only Report B data
- ✅ Upload event shows both records_archived and records_imported counts

**Validation Queries**:
```sql
-- Should show archived vulnerabilities from Report A
SELECT COUNT(*) FROM vulnerability_history;

-- Should show fixed vulnerabilities (in history but not current)
SELECT COUNT(*) FROM vulnerability_history h
WHERE NOT EXISTS (
    SELECT 1 FROM vulnerabilities v WHERE v.finding_arn = h.finding_arn
);

-- Should show 2 completed uploads
SELECT COUNT(*) FROM upload_events WHERE status = 'COMPLETED';
```

### Scenario 3: Fixed Vulnerabilities Report Filtering

**Objective**: Verify that the fixed vulnerabilities report supports filtering and displays correct information

**Steps**:
1. Navigate to http://localhost:3010/fixed-vulnerabilities
2. Test severity filtering (select different severity levels)
3. Test date range filtering (fixed after/before specific dates)
4. Test resource type filtering if available
5. Verify pagination works for large datasets
6. Test export functionality if implemented

**Expected Results**:
- ✅ Severity filter shows only vulnerabilities of selected severity
- ✅ Date range filters show vulnerabilities fixed within the specified timeframe
- ✅ Resource type filter shows vulnerabilities affecting selected resource types
- ✅ Pagination controls work correctly for large result sets
- ✅ Fixed date is accurately calculated as the upload date of the replacing report
- ✅ Days active calculation is correct (fixed_date - first_observed_at)

**Sample Test Data**:
```
Filter by: HIGH severity
Expected: Only vulnerabilities with severity='HIGH' from archived data

Filter by: Fixed after [yesterday]
Expected: All vulnerabilities fixed by today's upload

Filter by: Resource type EC2Instance
Expected: Only vulnerabilities that affected EC2 instances
```

### Scenario 4: Vulnerability History Timeline

**Objective**: Verify that individual vulnerability history tracking works correctly

**Steps**:
1. Identify a vulnerability that appeared in multiple reports with changes
2. Access the vulnerability history API endpoint: GET /api/vulnerability-history/{finding_arn}
3. Verify the timeline shows all archived versions
4. Check that changes in severity, status, or other fields are tracked
5. Verify current status is correctly identified

**Expected Results**:
- ✅ API returns complete history timeline for the vulnerability
- ✅ Each history record shows the state at the time it was archived
- ✅ Changes between versions are properly tracked
- ✅ Current status correctly identifies if vulnerability is still active or fixed
- ✅ Chronological ordering is correct (newest first)

**API Test**:
```bash
# Test vulnerability history API
curl "http://localhost:3010/api/vulnerability-history/arn:aws:inspector2:..." | jq

# Expected response structure:
{
  "finding_arn": "arn:aws:inspector2:...",
  "current_status": "FIXED",
  "history": [
    {
      "vulnerability_id": "CVE-2024-12345",
      "severity": "HIGH",
      "archived_at": "2025-09-17T10:00:00Z",
      ...
    }
  ]
}
```

### Scenario 5: Upload Failure and Rollback

**Objective**: Verify that upload failures properly rollback and preserve existing data

**Steps**:
1. Prepare a malformed JSON file or very large file to trigger failure
2. Navigate to http://localhost:3010
3. Attempt to upload the problematic file
4. Verify upload fails with appropriate error message
5. Check that current vulnerability data is preserved
6. Verify no partial data was committed to history tables

**Expected Results**:
- ✅ Upload fails with clear error message
- ✅ Current vulnerability data remains unchanged
- ✅ No partial records are created in history tables
- ✅ Upload event is logged with FAILED status and error message
- ✅ System remains in consistent state for next upload attempt

**Validation After Failed Upload**:
```sql
-- Should show no change in current vulnerabilities count
SELECT COUNT(*) FROM vulnerabilities;

-- Should show no partial history records from failed upload
SELECT COUNT(*) FROM vulnerability_history WHERE archived_at > [before_failed_upload];

-- Should show failed upload event
SELECT status, error_message FROM upload_events ORDER BY started_at DESC LIMIT 1;
```

### Scenario 6: Large Dataset Performance

**Objective**: Verify that the system handles large datasets efficiently

**Steps**:
1. Prepare or generate a large AWS Inspector report (1000+ vulnerabilities)
2. Upload the large report and measure processing time
3. Navigate to fixed vulnerabilities page and test performance
4. Test pagination and filtering with large datasets
5. Verify memory usage remains stable during processing

**Expected Results**:
- ✅ Large report upload completes within reasonable time (< 2 minutes for 1000 vulnerabilities)
- ✅ Fixed vulnerabilities page loads within 5 seconds
- ✅ Pagination and filtering remain responsive
- ✅ Memory usage doesn't exceed reasonable limits during processing
- ✅ Database indexes provide efficient query performance

**Performance Benchmarks**:
```
Dataset Size: < 100 vulnerabilities → Upload time < 10 seconds
Dataset Size: 100-1000 vulnerabilities → Upload time < 30 seconds
Dataset Size: 1000+ vulnerabilities → Upload time < 2 minutes

Fixed vulnerabilities page load: < 5 seconds for any dataset size
History comparison query: < 3 seconds for datasets up to 5000 records
```

## API Testing

### Fixed Vulnerabilities API Endpoint Testing

**Test the API directly using browser dev tools or curl**:

```bash
# Test basic fixed vulnerabilities endpoint
curl "http://localhost:3010/api/fixed-vulnerabilities"

# Test with severity filtering
curl "http://localhost:3010/api/fixed-vulnerabilities?severity=HIGH"

# Test with date range filtering
curl "http://localhost:3010/api/fixed-vulnerabilities?fixedAfter=2025-09-01&fixedBefore=2025-09-17"

# Test pagination
curl "http://localhost:3010/api/fixed-vulnerabilities?limit=10&offset=20"

# Test combined filters
curl "http://localhost:3010/api/fixed-vulnerabilities?severity=CRITICAL&resourceType=EC2Instance&limit=25"
```

**Expected API Responses**:
- ✅ Valid filters: Returns filtered fixed vulnerability array with pagination
- ✅ Invalid severity: Returns 400 Bad Request with validation error
- ✅ Invalid date format: Returns 400 Bad Request with validation error
- ✅ Large offset: Returns empty array with correct pagination metadata
- ✅ No results: Returns empty array with total count 0

### Upload Events API Testing

```bash
# Test upload events endpoint (if implemented)
curl "http://localhost:3010/api/upload-events"

# Expected response: List of upload events with status and metadata
```

## Database Verification

### Direct Database Inspection

```sql
-- Verify history table structure
.schema vulnerability_history

-- Check upload events log
SELECT upload_id, filename, status, started_at, completed_at,
       records_archived, records_imported, error_message
FROM upload_events
ORDER BY started_at DESC;

-- Verify fixed vulnerabilities calculation
SELECT h.vulnerability_id, h.title, h.severity, h.archived_at,
       CASE WHEN v.finding_arn IS NULL THEN 'FIXED' ELSE 'STILL_ACTIVE' END as status
FROM vulnerability_history h
LEFT JOIN vulnerabilities v ON v.finding_arn = h.finding_arn
ORDER BY h.archived_at DESC;

-- Check index usage on large queries
EXPLAIN QUERY PLAN
SELECT * FROM vulnerability_history
WHERE severity = 'HIGH' AND archived_at >= '2025-09-01';
```

## Troubleshooting

### Common Issues and Solutions

**Issue**: Upload fails with transaction error
- **Solution**: Check database file permissions and disk space
- **Debug**: Review upload_events table for error details

**Issue**: Fixed vulnerabilities page shows incorrect data
- **Solution**: Verify vulnerability matching logic in comparison queries
- **Debug**: Check finding_arn matching and secondary matching logic

**Issue**: Slow performance on large datasets
- **Solution**: Verify database indexes are created correctly
- **Debug**: Use EXPLAIN QUERY PLAN to analyze query performance

**Issue**: History not preserved during upload
- **Solution**: Check transaction handling in upload workflow
- **Debug**: Verify archive step completes before clearing current data

### Debug Commands

```sql
-- Check transaction isolation
PRAGMA journal_mode;

-- Verify foreign key constraints
PRAGMA foreign_keys;

-- Check index usage
.indexes vulnerability_history

-- Analyze table statistics
ANALYZE vulnerability_history;
```

## Success Criteria

**All scenarios pass when**:
- ✅ History tracking preserves vulnerability data across uploads
- ✅ Fixed vulnerability identification accurately compares history with current data
- ✅ Upload workflow handles failures gracefully with proper rollback
- ✅ Fixed vulnerabilities report provides accurate filtering and pagination
- ✅ Performance meets specified benchmarks for large datasets
- ✅ Database integrity maintained through all operations
- ✅ API endpoints return correct data with proper error handling

## Next Steps

After successful quickstart validation:
1. Run comprehensive test suite with various report formats
2. Perform load testing with production-scale datasets
3. Validate with security team for accuracy of fixed vulnerability detection
4. Monitor system performance and optimize queries if needed
5. Set up automated monitoring for upload success rates and performance metrics

---

**Feature Validation Complete**: Vulnerability history tracking is ready for production use when all quickstart scenarios pass successfully.