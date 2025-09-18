# Quickstart Guide: Database Backup and Clear Settings

**Phase 1 Output**: Integration test scenarios and validation steps
**Date**: 2025-09-18

## Overview
This quickstart guide provides step-by-step validation scenarios for the database backup and clear functionality. Each scenario corresponds to acceptance criteria from the feature specification.

## Prerequisites
- Vulnerability dashboard server running on http://localhost:3010
- Sample vulnerability data loaded (at least 1 report with vulnerabilities)
- Web browser for manual testing
- Admin access to the application

## Test Scenarios

### Scenario 1: Settings Page Access
**Validates**: FR-001 - System MUST provide a "Settings" navigation item accessible from all pages

**Steps**:
1. Navigate to http://localhost:3010
2. Verify "Settings" navigation item is visible in the navbar
3. Click the "Settings" navigation item
4. Verify you are taken to a settings page at http://localhost:3010/settings

**Expected Results**:
- ✅ Settings navigation item appears on all pages (Upload, Dashboard, Vulnerabilities, Fixed Vulnerabilities)
- ✅ Settings page loads successfully with backup and clear options
- ✅ Page maintains consistent styling with rest of application
- ✅ Breadcrumb or active navigation state shows current location

**Acceptance Criteria**: Settings page accessible from any page in the application

### Scenario 2: Database Backup Operation
**Validates**: FR-002, FR-005, FR-006 - Backup button creates complete backup with user feedback

**Steps**:
1. Navigate to http://localhost:3010/settings
2. Locate the "Backup Database" button
3. Click the "Backup Database" button
4. Observe progress indication during backup
5. Wait for backup completion confirmation
6. Verify backup file was created in backups directory

**Expected Results**:
- ✅ Backup button is clearly visible and accessible
- ✅ Progress indicator shows during backup operation
- ✅ Success message displays backup file details (name, size, timestamp)
- ✅ Backup file exists in `/backups/manual/` directory
- ✅ Backup file size > 0 and reasonable for database content
- ✅ Application remains responsive during backup

**Validation Commands**:
```bash
# Check backup was created
ls -la backups/manual/
# Verify backup file size
du -h backups/manual/vulnerability_db_backup_*.db
```

**Acceptance Criteria**: Complete database backup created with user feedback

### Scenario 3: Database Clear Operation Workflow
**Validates**: FR-003, FR-008 - Clear button with required confirmation mechanism

**Steps**:
1. Navigate to http://localhost:3010/settings
2. Locate the "Clear Database" button
3. Click the "Clear Database" button
4. Verify confirmation modal appears
5. Attempt to proceed without typing confirmation text
6. Type "CLEAR ALL DATA" in the confirmation field
7. Click confirm to proceed with clear operation
8. Wait for operation completion

**Expected Results**:
- ✅ Clear button triggers confirmation modal
- ✅ Modal requires typing "CLEAR ALL DATA" exactly
- ✅ Confirmation button remains disabled until correct text entered
- ✅ Clear operation shows progress indication
- ✅ Success message confirms data was cleared
- ✅ Automatic backup was created before clearing

**Validation Commands**:
```bash
# Check pre-clear backup was created
ls -la backups/pre_clear/
# Verify database is empty
sqlite3 db/vulnerabilities.db "SELECT COUNT(*) FROM reports;"
sqlite3 db/vulnerabilities.db "SELECT COUNT(*) FROM vulnerabilities;"
```

**Acceptance Criteria**: Clear operation requires explicit confirmation and preserves application structure

### Scenario 4: Data Preservation During Clear
**Validates**: FR-004 - System preserves application settings during clear operation

**Steps**:
1. Before clear: Note database schema and table structure
2. Execute clear operation (following Scenario 3)
3. After clear: Verify database schema intact
4. Verify application still functions normally
5. Try uploading a new report to confirm functionality

**Expected Results**:
- ✅ Database tables still exist (schema preserved)
- ✅ Application loads without errors after clear
- ✅ Upload functionality works normally
- ✅ All application features remain accessible
- ✅ No configuration data was lost

**Validation Commands**:
```bash
# Check database schema intact
sqlite3 db/vulnerabilities.db ".schema"
# Verify tables exist but are empty
sqlite3 db/vulnerabilities.db ".tables"
```

**Acceptance Criteria**: Application functionality preserved, only user data removed

### Scenario 5: Backup List and Management
**Validates**: FR-007 - System stores backup files and provides access

**Steps**:
1. Create multiple backups using different triggers (manual, pre-clear)
2. Navigate to settings page
3. Verify backup list displays available backups
4. Check backup metadata (size, timestamp, type)
5. Verify backups are accessible and organized

**Expected Results**:
- ✅ Settings page shows list of available backups
- ✅ Each backup shows metadata (filename, size, date, reason)
- ✅ Backups are organized by type (manual vs automatic)
- ✅ File paths and sizes are accurate
- ✅ Recent backups appear at top of list

**Validation Commands**:
```bash
# List all backup files
find backups/ -name "*.db" -type f -exec ls -lh {} \;
# Check backup organization
tree backups/
```

**Acceptance Criteria**: Backup files properly stored and accessible through interface

### Scenario 6: Error Handling and Edge Cases
**Validates**: FR-009, FR-010 - System handles errors without corruption

**Test Cases**:
1. **Backup during active database access**: Start backup while uploading file
2. **Insufficient disk space**: Attempt backup with limited space
3. **Invalid confirmation**: Try clear with wrong confirmation text
4. **Concurrent operations**: Attempt multiple backups simultaneously
5. **Navigation during operation**: Leave page during backup/clear

**Expected Results**:
- ✅ Backup operations don't interfere with normal database access
- ✅ Proper error messages for failed operations
- ✅ No data corruption occurs during error conditions
- ✅ Operations can be retried after errors
- ✅ System remains stable during edge cases

**Acceptance Criteria**: Robust error handling maintains data integrity

### Scenario 7: Performance and Responsiveness
**Validates**: FR-009 - Operations don't interrupt normal functionality

**Performance Benchmarks**:
1. **Backup Time**: Typical database (1-50MB) should backup in <30 seconds
2. **UI Responsiveness**: Interface remains interactive during operations
3. **Memory Usage**: No significant memory leaks during operations
4. **Concurrent Access**: Other users can access dashboard during backup

**Validation Steps**:
1. Monitor backup operation duration
2. Test navigation and other features during backup
3. Check browser console for errors
4. Verify server remains responsive

**Expected Results**:
- ✅ Backup completes within reasonable timeframe
- ✅ Application remains fully functional during operations
- ✅ No JavaScript errors or memory issues
- ✅ Server responsiveness maintained

**Acceptance Criteria**: Operations are performant and non-blocking

## Integration Test Checklist

### Pre-Test Setup
- [ ] Database contains sample vulnerability data
- [ ] Backup directories exist and are writable
- [ ] Server running on correct port (3010)
- [ ] CSRF protection configured (if implemented)

### Core Functionality Tests
- [ ] Settings page navigation works from all pages
- [ ] Backup operation creates valid backup file
- [ ] Clear operation removes all user data
- [ ] Clear operation preserves database schema
- [ ] Confirmation mechanism prevents accidental clearing
- [ ] Progress indicators work for long operations

### Error Handling Tests
- [ ] Invalid confirmation text rejected
- [ ] Concurrent operation conflicts handled
- [ ] Disk space errors handled gracefully
- [ ] Network interruption recovery works
- [ ] Database lock scenarios handled

### Security Tests
- [ ] CSRF protection active (if implemented)
- [ ] File permissions secure (0o640 for backups)
- [ ] Confirmation tokens validated
- [ ] Audit trail preserved for operations

### Performance Tests
- [ ] Backup completes in <30 seconds for typical data
- [ ] Clear operation completes in <5 seconds
- [ ] UI remains responsive during operations
- [ ] Memory usage remains stable

## Automated Test Integration

### Contract Tests (Jest)
```javascript
// These tests should fail initially (no implementation)
describe('Settings API Contract Tests', () => {
  test('POST /api/settings/backup returns 200 with valid response', async () => {
    // Test backup endpoint contract
  });

  test('POST /api/settings/clear requires confirmation', async () => {
    // Test clear endpoint validation
  });

  test('GET /api/settings/backups returns backup list', async () => {
    // Test backup listing endpoint
  });
});
```

### E2E Tests (Playwright)
```javascript
// Browser automation tests for user workflows
describe('Settings Page E2E Tests', () => {
  test('complete backup workflow', async ({ page }) => {
    // Automate backup scenario
  });

  test('complete clear workflow with confirmation', async ({ page }) => {
    // Automate clear scenario with type-to-confirm
  });
});
```

### Performance Tests
```javascript
// Load testing for backup operations
describe('Settings Performance Tests', () => {
  test('backup operation completes within time limit', async () => {
    // Time backup operation
  });

  test('concurrent access during backup', async () => {
    // Test server responsiveness
  });
});
```

## Success Criteria Summary

**Feature Complete When**:
- ✅ All 7 scenarios pass validation
- ✅ All integration tests pass
- ✅ Security requirements met
- ✅ Performance benchmarks achieved
- ✅ Error handling robust
- ✅ User experience smooth and intuitive

**Ready for Production When**:
- All automated tests pass
- Manual testing scenarios validated
- Security audit completed
- Performance benchmarks met
- Documentation complete

**Quickstart Validation Complete** ✅