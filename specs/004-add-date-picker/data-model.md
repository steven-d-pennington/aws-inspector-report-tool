# Data Model: Inspector Report Generation Date Tracking

**Feature**: Date picker for report generation date tracking
**Phase**: Phase 1 - Data Model Design
**Date**: 2025-09-18

## Entity Modifications

### 1. Report Entity (reports table)

**Current Schema**:
```sql
CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    vulnerability_count INTEGER,
    aws_account_id TEXT
);
```

**Modified Schema**:
```sql
CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    report_run_date DATETIME,  -- NEW FIELD
    vulnerability_count INTEGER,
    aws_account_id TEXT
);
```

**Field Specifications**:
- **report_run_date**: DATETIME, nullable for backward compatibility
- **Validation**: Must be ≤ upload_date, ≥ (current_date - 2 years)
- **Default**: NULL for existing records, required for new uploads
- **Index**: Optional for date-range filtering queries

### 2. Vulnerability History Entity (vulnerability_history table)

**Current Schema**:
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
    -- Foreign keys and constraints...
);
```

**Modified Schema**:
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
    report_run_date DATETIME,  -- NEW FIELD
    original_report_id INTEGER,
    archived_from_report_id INTEGER,
    -- Foreign keys and constraints...
);
```

**Field Specifications**:
- **report_run_date**: DATETIME, copied from parent report during archiving
- **Purpose**: Preserves temporal context for historical vulnerability records
- **Relationship**: Matches report_run_date from archived_from_report_id

### 3. Upload Event Entity (upload_events table - existing)

**No Schema Changes Required**:
The existing upload_events table tracks upload workflow state and doesn't need modification. The report_run_date is stored at the report level, not the upload event level.

## Data Relationships

### Temporal Data Flow

```
User Input (Date Picker) → Report.report_run_date → VulnHistory.report_run_date
                        ↘ Upload Processing     ↗ Archiving Process
                          Report.upload_date
```

**Key Relationships**:
1. **report_run_date ≤ upload_date**: Business rule ensuring logical temporal order
2. **VulnHistory.report_run_date = Report.report_run_date**: Data consistency during archiving
3. **NULL values preserved**: Backward compatibility for existing data

### Query Patterns

**Historical Timeline Query**:
```sql
SELECT r.filename,
       r.report_run_date,
       r.upload_date,
       r.vulnerability_count
FROM reports r
ORDER BY r.report_run_date DESC, r.upload_date DESC;
```

**Vulnerability Lifecycle Query**:
```sql
SELECT v.finding_arn,
       v.severity,
       r.report_run_date as first_detected,
       vh.report_run_date as last_seen,
       vh.archived_at as fixed_date
FROM vulnerabilities v
JOIN reports r ON v.report_id = r.id
LEFT JOIN vulnerability_history vh ON vh.finding_arn = v.finding_arn
ORDER BY r.report_run_date;
```

## Validation Rules

### Database Level Constraints

```sql
-- Add constraints during migration
ALTER TABLE reports ADD CONSTRAINT chk_report_dates
CHECK (report_run_date IS NULL OR report_run_date <= upload_date);

-- Optional: Reasonable historical limit
ALTER TABLE reports ADD CONSTRAINT chk_report_age
CHECK (report_run_date IS NULL OR report_run_date >= date('now', '-2 years'));
```

### Application Level Validation

**JavaScript (Client-side)**:
```javascript
const dateInput = document.getElementById('reportRunDate');
const today = new Date().toISOString().split('T')[0];
const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

dateInput.max = today;
dateInput.min = twoYearsAgo;
```

**Node.js (Server-side)**:
```javascript
function validateReportRunDate(reportRunDate) {
    const date = new Date(reportRunDate);
    const today = new Date();
    const twoYearsAgo = new Date(today.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);

    if (date > today) throw new Error('Report run date cannot be in the future');
    if (date < twoYearsAgo) throw new Error('Report run date cannot be more than 2 years old');

    return date.toISOString();
}
```

## Migration Strategy

### Database Migration Script

```sql
-- Migration: Add report_run_date fields
-- Version: 004-add-report-run-date
-- Backward Compatible: YES

-- Step 1: Add report_run_date to reports table
ALTER TABLE reports ADD COLUMN report_run_date DATETIME;

-- Step 2: Add report_run_date to vulnerability_history table
ALTER TABLE vulnerability_history ADD COLUMN report_run_date DATETIME;

-- Step 3: Create index for performance (optional)
CREATE INDEX IF NOT EXISTS idx_reports_run_date ON reports(report_run_date);

-- Step 4: Add constraints (optional - can be done later)
-- Note: SQLite doesn't support adding constraints to existing tables
-- These would be enforced at application level initially
```

### Data Backfill Strategy

**No Automatic Backfill**: Existing reports will have NULL report_run_date values, which is acceptable for backward compatibility.

**Manual Backfill (Optional)**: If specific historical dates are known:
```sql
-- Example: Set report_run_date to upload_date for recent reports
-- Only if this represents reasonable approximation
UPDATE reports
SET report_run_date = upload_date
WHERE report_run_date IS NULL
  AND upload_date >= date('now', '-30 days');
```

## State Transitions

### Upload Workflow States

```
1. File Selected → Date Picker Visible
2. Date Selected → Validation (client-side)
3. Form Submitted → Validation (server-side)
4. Upload Processing → report_run_date stored
5. Archiving (later) → report_run_date preserved
```

### Data Lifecycle

```
New Report:
  report_run_date = user_input
  upload_date = CURRENT_TIMESTAMP

Archive Process:
  vulnerability_history.report_run_date = reports.report_run_date
  vulnerability_history.archived_at = CURRENT_TIMESTAMP
```

## Performance Considerations

### Storage Impact
- **Per Report**: +8 bytes (DATETIME field)
- **Per History Record**: +8 bytes (DATETIME field)
- **Estimated Annual**: ~8KB additional storage (1000 reports/year)

### Query Performance
- **Date Range Queries**: Index on report_run_date recommended
- **Timeline Queries**: Composite index on (report_run_date, upload_date) for optimal sorting
- **Join Performance**: Minimal impact due to existing foreign key relationships

### Index Recommendations

```sql
-- For date-based filtering and sorting
CREATE INDEX idx_reports_run_date ON reports(report_run_date);

-- For timeline views (composite)
CREATE INDEX idx_reports_timeline ON reports(report_run_date, upload_date);

-- For history archiving queries
CREATE INDEX idx_vuln_history_run_date ON vulnerability_history(report_run_date);
```

## Conclusion

The data model changes are minimal and additive, maintaining full backward compatibility while enabling accurate historical vulnerability tracking. The temporal separation of report generation time from upload time provides crucial context for compliance reporting and trend analysis.

**Key Benefits**:
- Accurate vulnerability timeline reconstruction
- Better compliance reporting capabilities
- Historical context preservation during archiving
- Minimal performance impact
- Full backward compatibility