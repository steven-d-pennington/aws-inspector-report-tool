# Quickstart Guide: Settings Page with Database Management

**Feature**: Settings Page with Database Management
**Purpose**: Manual validation of implementation completeness
**Prerequisites**: Application running, admin access configured

## Environment Setup

### 1. Enable Admin Mode
```bash
# Set environment variable
export ADMIN_ENABLED=true

# Or add to .env file
echo "ADMIN_ENABLED=true" >> .env
```

### 2. Restart Application
```bash
npm start
```

### 3. Verify Database Connection
```bash
# Should see PostgreSQL connection message in logs
# Look for: "📊 Using PostgreSQL database service"
```

## Feature Validation Steps

### Step 1: Access Settings Page
1. **Navigate to settings**: `http://localhost:3010/settings`
2. **Expected**: Settings page loads with database management section
3. **Verify**: Page loads within 2 seconds (PR-003)
4. **Check**: Admin-only access enforced (FR-011)

**Success Criteria**:
- ✅ Settings page accessible to admin
- ✅ Database management section visible
- ✅ Clear and backup options present
- ❌ Non-admin users get 403 error

### Step 2: Database Backup Operation
1. **Click "Create Backup"** button
2. **Expected**: Operation initiates with progress indicator
3. **Wait**: For backup completion (should show progress)
4. **Verify**: Download link appears on completion

**Test Validation**:
```bash
# Check backup file created
ls -la backups/backup_*.sql.gz

# Verify file is compressed and contains data
gunzip -t backups/backup_*.sql.gz
```

**Success Criteria**:
- ✅ Backup operation starts immediately (FR-005)
- ✅ Progress indicator shows 0-100% (FR-008)
- ✅ Compressed SQL dump created (FR-013)
- ✅ Download link provided (FR-012)
- ✅ Operation completes without blocking other users (PR-002)

### Step 3: Download Backup File
1. **Click download link** from completed backup
2. **Expected**: File downloads with proper filename
3. **Verify**: File is valid PostgreSQL dump

**File Validation**:
```bash
# Check file format
file backup_*.sql.gz
# Expected: gzip compressed data

# Check content (first few lines)
gunzip -c backup_*.sql.gz | head -20
# Expected: PostgreSQL dump header
```

**Success Criteria**:
- ✅ File downloads successfully
- ✅ Filename follows pattern: backup_YYYY-MM-DD_HH-mm-ss.sql.gz
- ✅ File is valid gzip-compressed SQL dump
- ✅ Contains database schema and data

### Step 4: Database Clear Operation - Preparation
1. **Note current data counts** for verification:
```sql
SELECT
  (SELECT COUNT(*) FROM vulnerabilities) as vulns,
  (SELECT COUNT(*) FROM reports) as reports,
  (SELECT COUNT(*) FROM settings) as settings,
  (SELECT COUNT(*) FROM upload_events) as uploads;
```

2. **Record settings data** to verify preservation:
```sql
SELECT * FROM settings ORDER BY id;
```

### Step 5: Database Clear Operation - Execution
1. **Click "Clear Database"** button
2. **Expected**: Confirmation modal appears
3. **Type "CONFIRM"** in text input field (FR-006)
4. **Click confirm**: Operation should start
5. **Monitor progress**: Progress indicator should show completion

**Success Criteria**:
- ✅ Multi-step confirmation required (FR-006)
- ✅ Clear warning about consequences (FR-007)
- ✅ Text verification ("CONFIRM") required
- ✅ Progress indicator during operation (FR-008)
- ✅ Operation completion notification (FR-009)

### Step 6: Database Clear Operation - Verification
1. **Check data removal**:
```sql
SELECT
  (SELECT COUNT(*) FROM vulnerabilities) as vulns,
  (SELECT COUNT(*) FROM reports) as reports,
  (SELECT COUNT(*) FROM settings) as settings,
  (SELECT COUNT(*) FROM upload_events) as uploads;
```

2. **Verify settings preservation**:
```sql
SELECT * FROM settings ORDER BY id;
-- Should match pre-clear data exactly
```

**Success Criteria**:
- ✅ All vulnerability data cleared (FR-003)
- ✅ All report data cleared (FR-003)
- ✅ Settings table preserved exactly (FR-004)
- ✅ Upload events cleared
- ✅ Database schema intact

### Step 7: Concurrent Operations Test
1. **Start backup operation**
2. **Immediately try to start clear operation**
3. **Expected**: Second operation should be prevented/queued

**Success Criteria**:
- ✅ Concurrent destructive operations prevented (FR-010)
- ✅ Clear error message about operation in progress
- ✅ System remains stable during conflict

### Step 8: Error Handling Validation
1. **Test invalid confirmation**: Try clear with wrong text
2. **Test file access**: Rename backup directory temporarily
3. **Test database disconnect**: Stop PostgreSQL during operation

**Expected Behaviors**:
- ✅ Invalid confirmation rejected with clear error
- ✅ File system errors handled gracefully
- ✅ Database errors reported to user
- ✅ System recovers from failures

## Performance Validation

### Backup Performance Test
```bash
# Create test data for performance validation
# Time backup operation
time curl -X POST http://localhost:3010/api/settings/backup
```

**Performance Criteria**:
- ✅ Settings page loads < 2 seconds (PR-003)
- ✅ Backup doesn't block other operations (PR-002)
- ✅ Clear operations complete reasonably for dataset size (PR-001)

## Security Validation

### Access Control Test
```bash
# Test without admin privileges
export ADMIN_ENABLED=false
npm start

# Try to access settings page
curl -i http://localhost:3010/settings
# Expected: 403 Forbidden
```

### Audit Trail Test
```bash
# Check logs for operation records
grep -i "backup\|clear\|settings" application.log
```

**Security Criteria**:
- ✅ Admin privileges validated on all endpoints (SR-002)
- ✅ Unauthorized access prevented (SR-003)
- ✅ All operations logged for audit (SR-001)

## Integration with Existing System

### Navigation Integration
1. **Check main navigation** for settings link
2. **Verify consistent styling** with existing pages
3. **Test breadcrumb navigation** if implemented

### Data Consistency
1. **Upload new vulnerability report** after clear
2. **Verify normal functionality** restored
3. **Check filters and search** work correctly

## Troubleshooting

### Common Issues
1. **"Admin access required"**: Check ADMIN_ENABLED environment variable
2. **"Backup failed"**: Verify backup directory exists and is writable
3. **"Database connection failed"**: Check PostgreSQL service status
4. **"File not found"**: Backup may have been auto-cleaned up

### Debug Commands
```bash
# Check admin status
curl -i http://localhost:3010/api/settings/status

# Check backup directory
ls -la backups/

# Check PostgreSQL connection
psql -h localhost -p 5432 -U report_gen -d vulnerability_reports -c "\dt"
```

## Completion Checklist

**Functional Requirements**:
- [ ] FR-001: Settings page accessible from navigation
- [ ] FR-002: Database management section present
- [ ] FR-003: Database clear functionality works
- [ ] FR-004: Settings preserved during clear
- [ ] FR-005: Backup creation functionality works
- [ ] FR-006: Multi-step confirmation enforced
- [ ] FR-007: Clear warnings displayed
- [ ] FR-008: Progress indicators shown
- [ ] FR-009: Operation completion notifications
- [ ] FR-010: Concurrent operation prevention
- [ ] FR-011: Admin privileges validated
- [ ] FR-012: Local backup storage with download
- [ ] FR-013: Compressed SQL dump format

**Performance Requirements**:
- [ ] PR-001: Clear operations complete reasonably
- [ ] PR-002: Backup doesn't impact other users
- [ ] PR-003: Settings page loads < 2 seconds

**Security Requirements**:
- [ ] SR-001: Operations logged for audit
- [ ] SR-002: User permissions validated
- [ ] SR-003: Unauthorized access prevented

**Integration**:
- [ ] Consistent UI styling with existing pages
- [ ] Navigation properly integrated
- [ ] Normal application functionality restored after operations

---

**Validation Complete**: All requirements tested and verified working correctly.