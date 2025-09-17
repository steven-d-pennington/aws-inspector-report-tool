# Research Findings: Vulnerability History Tracking Implementation

## NEEDS CLARIFICATION Resolutions

### 1. Vulnerability Attributes for History Tracking (FR-006)

**Decision**: Store core vulnerability identification and metadata fields in history table

**Rationale**: Balance between completeness and performance. Store essential fields needed for tracking and comparison while avoiding duplicating large text fields and complex relationships.

**Fields to Preserve**:
- `finding_arn` (unique identifier)
- `vulnerability_id` (CVE identifier)
- `title` (vulnerability name)
- `severity` (for trend analysis)
- `status` (for remediation tracking)
- `fix_available` (for prioritization)
- `inspector_score` (for risk assessment)
- `first_observed_at` (original detection)
- `last_observed_at` (most recent detection)
- `report_id` (source report reference)
- `archived_at` (when moved to history)

**Alternatives Considered**:
- Full vulnerability record duplication: Rejected due to storage overhead and complexity
- Minimal ID-only tracking: Rejected as insufficient for meaningful reporting

### 2. Vulnerability Matching Logic (FR-007)

**Decision**: Primary match on `finding_arn`, fallback to `vulnerability_id` + resource matching

**Rationale**: AWS Inspector `finding_arn` is the most reliable unique identifier across reports. For cases where ARN changes, CVE + resource combination provides secondary matching.

**Matching Algorithm**:
1. **Primary**: Exact match on `finding_arn`
2. **Secondary**: Match on `vulnerability_id` AND affected resource overlap
3. **Edge Case**: Log mismatches for manual review

**Implementation Pattern**:
```sql
-- Primary match
SELECT * FROM history WHERE finding_arn = ?

-- Secondary match if no primary found
SELECT * FROM history h
WHERE vulnerability_id = ?
AND EXISTS (
  SELECT 1 FROM current_resources cr
  JOIN history_resources hr ON cr.resource_id = hr.resource_id
  WHERE hr.history_id = h.id
)
```

**Alternatives Considered**:
- CVE-only matching: Rejected as CVEs can affect multiple resources differently
- Hash-based content matching: Rejected due to complexity and false positives
- Manual matching interface: Deferred to future enhancement

### 3. History Timestamp Semantics (FR-008)

**Decision**: `archived_at` timestamp indicates when vulnerability was moved to history

**Rationale**: Clear temporal boundary for tracking when vulnerabilities were "last seen" in active reports. Enables accurate fixed-date calculations.

**Timestamp Fields**:
- `archived_at`: When moved to history (upload date of replacing report)
- `last_observed_at`: Copy from vulnerability record (when AWS last detected)
- `first_observed_at`: Copy from vulnerability record (when AWS first detected)

**Fixed Date Calculation**: `archived_at` represents the "fixed as of" date when vulnerability disappeared from active reports.

**Alternatives Considered**:
- Using `last_observed_at` as fix date: Rejected as misleading (AWS detection != fix date)
- Separate `fixed_at` calculation: Rejected as overly complex for first iteration

### 4. Upload Process Rollback Requirements (FR-009)

**Decision**: Implement atomic transactions with multi-stage rollback capability

**Rationale**: Data integrity is critical for security reporting. Must handle partial failures gracefully and maintain consistent state.

**Transaction Strategy**:
1. **Begin Transaction**
2. **Archive Phase**: Move current data to history tables
3. **Clear Phase**: Delete current vulnerability data
4. **Import Phase**: Insert new vulnerability data
5. **Commit Transaction** (or rollback on any failure)

**Rollback Scenarios**:
- JSON parsing failure: Rollback before any database changes
- Database constraint violation: Rollback and preserve current data
- Disk space exhaustion: Rollback and alert administrator
- Process interruption: Automatic rollback via transaction abort

**Recovery Pattern**:
```javascript
const transaction = db.beginTransaction();
try {
  await archiveCurrentData(transaction);
  await clearCurrentTables(transaction);
  await importNewData(reportData, transaction);
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw new Error(`Upload failed: ${error.message}`);
}
```

**Alternatives Considered**:
- Two-phase commit: Rejected as overly complex for single database
- Backup/restore approach: Rejected due to downtime and complexity
- No rollback (manual recovery): Rejected due to data integrity risks

### 5. Fixed Vulnerabilities Report Display (FR-010)

**Decision**: Tabular report with vulnerability details, timeline, and remediation metrics

**Rationale**: Security analysts need comprehensive view of what was fixed, when, and how long vulnerabilities were active for trend analysis.

**Display Fields**:
- Vulnerability ID (CVE)
- Title and Severity
- Affected Resources (summary)
- First Observed Date
- Last Observed Date
- Fixed Date (archived_at)
- Days Active (calculation)
- Fix Available Status (was fix available when active?)

**Report Features**:
- Sortable by fix date, severity, days active
- Filterable by date range, severity, resource type
- Export capability (PDF, CSV)
- Pagination for large datasets
- Summary statistics (avg days to fix, total fixed, etc.)

**UI Layout**:
```
[Fixed Vulnerabilities Report]
[Date Range Filter] [Severity Filter] [Export Options]

[Summary Stats: Total Fixed: X | Avg Days Active: Y | Most Critical: Z]

[Sortable Table]
CVE ID | Title | Severity | Resources | First Seen | Last Seen | Fixed Date | Days Active
```

**Alternatives Considered**:
- Dashboard-style widgets: Deferred to future enhancement
- Detailed drill-down views: Deferred to maintain simplicity
- Real-time notifications: Out of scope for initial implementation

## Database Schema Design Research

### History Table Structure

**Decision**: Dedicated `vulnerability_history` table with normalized design

**Schema**:
```sql
CREATE TABLE vulnerability_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    finding_arn TEXT NOT NULL,
    vulnerability_id TEXT,
    title TEXT,
    severity TEXT,
    status TEXT,
    fix_available TEXT,
    inspector_score REAL,
    first_observed_at DATETIME,
    last_observed_at DATETIME,
    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    original_report_id INTEGER,
    archived_from_report_id INTEGER,
    UNIQUE(finding_arn, archived_at)
);

CREATE INDEX idx_history_finding_arn ON vulnerability_history(finding_arn);
CREATE INDEX idx_history_vuln_id ON vulnerability_history(vulnerability_id);
CREATE INDEX idx_history_archived_at ON vulnerability_history(archived_at);
CREATE INDEX idx_history_severity ON vulnerability_history(severity);
```

**Resource History** (simplified):
```sql
CREATE TABLE resource_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    history_id INTEGER REFERENCES vulnerability_history(id),
    resource_id TEXT,
    resource_type TEXT,
    platform TEXT,
    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Performance Considerations**:
- Indexes on matching fields for fast comparison queries
- Unique constraint prevents duplicate archiving
- Separate resource table for normalized storage

## Upload Workflow Architecture

### Current Process (to be modified):
1. Parse uploaded JSON
2. Clear existing tables
3. Insert new data

### New Process:
1. Parse uploaded JSON (validate before DB changes)
2. **Begin Transaction**
3. **Archive current data** to history tables
4. Clear existing tables
5. Insert new data
6. **Commit Transaction**

### Error Handling Matrix:
| Error Point | Action | Recovery |
|-------------|---------|----------|
| JSON parsing | Abort, no DB changes | Return error to user |
| History archival | Rollback transaction | Preserve current state |
| Table clearing | Rollback transaction | Restore from transaction |
| Data insertion | Rollback transaction | Restore from transaction |
| Constraint violation | Rollback transaction | Return validation error |

## Performance Optimization Strategy

### Query Optimization:
- **Fixed vulnerabilities query**: Use NOT EXISTS with indexed history lookup
- **Large dataset handling**: Implement pagination with efficient OFFSET
- **Comparison queries**: Use indexed joins on finding_arn and vulnerability_id

### Batch Processing:
- **History archival**: Process in batches of 1000 records
- **Data clearing**: Use TRUNCATE where possible for performance
- **Import processing**: Bulk insert with prepared statements

### Memory Management:
- **Streaming uploads**: Process large JSON files in chunks
- **Query result limits**: Implement pagination for history reports
- **Transaction size limits**: Monitor memory usage during large uploads

---

## Summary of Resolved Clarifications

All NEEDS CLARIFICATION items have been resolved with practical, implementable solutions:

1. **History Attributes**: Core fields for tracking and comparison
2. **Matching Logic**: Primary ARN match with CVE+resource fallback
3. **Timestamp Semantics**: Clear `archived_at` boundary for fix dating
4. **Rollback Strategy**: Atomic transactions with comprehensive error handling
5. **Report Display**: Comprehensive tabular view with analytics

The research provides a solid foundation for detailed design and implementation planning.