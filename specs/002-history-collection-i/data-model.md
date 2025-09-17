# Data Model: Vulnerability History Tracking Feature

## Core Entities

### VulnerabilityHistory
**Purpose**: Represents archived vulnerability data from previous reports for historical tracking and fixed status determination.

**Fields**:
- `id: integer` - Primary key for history record
- `finding_arn: string` - AWS Inspector finding ARN (primary matching key)
- `vulnerability_id: string` - CVE identifier or vulnerability ID
- `title: string` - Vulnerability title/name
- `severity: string` - Vulnerability severity (CRITICAL, HIGH, MEDIUM, LOW)
- `status: string` - Status when archived (ACTIVE, SUPPRESSED, CLOSED)
- `fix_available: string` - Whether fix was available (YES, NO)
- `inspector_score: number` - AWS Inspector risk score
- `first_observed_at: datetime` - When AWS first detected vulnerability
- `last_observed_at: datetime` - When AWS last detected vulnerability
- `archived_at: datetime` - When moved to history (upload timestamp)
- `original_report_id: integer` - Reference to first report containing this vulnerability
- `archived_from_report_id: integer` - Reference to last report containing this vulnerability

**Validation Rules**:
- `finding_arn` must be unique per `archived_at` timestamp
- `severity` must be one of: CRITICAL, HIGH, MEDIUM, LOW
- `status` must be one of: ACTIVE, SUPPRESSED, CLOSED
- `fix_available` must be one of: YES, NO
- `archived_at` defaults to current timestamp
- `inspector_score` must be between 0.0 and 10.0

**Indexes**:
- Primary index on `finding_arn` for fast matching
- Index on `vulnerability_id` for secondary matching
- Index on `archived_at` for temporal queries
- Index on `severity` for filtered reporting

### ResourceHistory
**Purpose**: Represents archived resource data associated with historical vulnerabilities.

**Fields**:
- `id: integer` - Primary key
- `history_id: integer` - Foreign key to VulnerabilityHistory
- `resource_id: string` - AWS resource identifier
- `resource_type: string` - Type of AWS resource (EC2, ECR, etc.)
- `platform: string` - Platform/OS information
- `archived_at: datetime` - When moved to history

**Relationships**:
- Many-to-one with VulnerabilityHistory
- Used for secondary vulnerability matching logic

### FixedVulnerability (Derived Entity)
**Purpose**: Represents a vulnerability that existed in history but is not present in current active data.

**Derived Fields**:
- `finding_arn: string` - From history record
- `vulnerability_id: string` - CVE identifier
- `title: string` - Vulnerability name
- `severity: string` - Severity level
- `affected_resources: array` - List of resources that were affected
- `first_observed_at: datetime` - When first detected
- `last_observed_at: datetime` - When last seen in active reports
- `fixed_date: datetime` - When determined fixed (archived_at)
- `days_active: integer` - Calculated: fixed_date - first_observed_at
- `fix_was_available: boolean` - Whether fix was available when active

**Derivation Logic**:
```sql
-- Fixed vulnerabilities are those in history but not in current vulnerabilities
SELECT h.*,
       h.archived_at as fixed_date,
       JULIANDAY(h.archived_at) - JULIANDAY(h.first_observed_at) as days_active
FROM vulnerability_history h
WHERE NOT EXISTS (
    SELECT 1 FROM vulnerabilities v
    WHERE v.finding_arn = h.finding_arn
       OR (v.vulnerability_id = h.vulnerability_id
           AND EXISTS (resource overlap logic))
)
```

### ReportUploadEvent
**Purpose**: Represents the workflow state during vulnerability report upload processing.

**Fields**:
- `upload_id: string` - Unique identifier for upload session
- `filename: string` - Original report filename
- `status: string` - Current processing status
- `started_at: datetime` - When upload began
- `completed_at: datetime` - When upload finished
- `error_message: string` - Error details if failed
- `records_archived: integer` - Count of vulnerabilities moved to history
- `records_imported: integer` - Count of new vulnerabilities imported

**Status Values**:
- `STARTED` - Upload process initiated
- `ARCHIVING` - Moving current data to history
- `CLEARING` - Removing current data
- `IMPORTING` - Loading new data
- `COMPLETED` - Successfully finished
- `FAILED` - Error occurred, rollback performed

**Lifecycle**:
```
STARTED → ARCHIVING → CLEARING → IMPORTING → COMPLETED
    ↓         ↓          ↓          ↓
  FAILED ← FAILED ← FAILED ← FAILED
```

## Database Schema Extensions

### New Tables

**vulnerability_history**:
```sql
CREATE TABLE vulnerability_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    finding_arn TEXT NOT NULL,
    vulnerability_id TEXT,
    title TEXT,
    severity TEXT CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    status TEXT CHECK(status IN ('ACTIVE', 'SUPPRESSED', 'CLOSED')),
    fix_available TEXT CHECK(fix_available IN ('YES', 'NO')),
    inspector_score REAL CHECK(inspector_score >= 0.0 AND inspector_score <= 10.0),
    first_observed_at DATETIME,
    last_observed_at DATETIME,
    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    original_report_id INTEGER,
    archived_from_report_id INTEGER,
    UNIQUE(finding_arn, archived_at),
    FOREIGN KEY (original_report_id) REFERENCES reports(id),
    FOREIGN KEY (archived_from_report_id) REFERENCES reports(id)
);
```

**resource_history**:
```sql
CREATE TABLE resource_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    history_id INTEGER NOT NULL,
    resource_id TEXT,
    resource_type TEXT,
    platform TEXT,
    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (history_id) REFERENCES vulnerability_history(id) ON DELETE CASCADE
);
```

**upload_events**:
```sql
CREATE TABLE upload_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id TEXT UNIQUE NOT NULL,
    filename TEXT,
    status TEXT CHECK(status IN ('STARTED', 'ARCHIVING', 'CLEARING', 'IMPORTING', 'COMPLETED', 'FAILED')),
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    error_message TEXT,
    records_archived INTEGER DEFAULT 0,
    records_imported INTEGER DEFAULT 0
);
```

### Index Creation:
```sql
-- History table indexes
CREATE INDEX idx_history_finding_arn ON vulnerability_history(finding_arn);
CREATE INDEX idx_history_vuln_id ON vulnerability_history(vulnerability_id);
CREATE INDEX idx_history_archived_at ON vulnerability_history(archived_at);
CREATE INDEX idx_history_severity ON vulnerability_history(severity);
CREATE INDEX idx_history_status ON vulnerability_history(status);

-- Resource history indexes
CREATE INDEX idx_resource_history_id ON resource_history(history_id);
CREATE INDEX idx_resource_history_resource_id ON resource_history(resource_id);

-- Upload events indexes
CREATE INDEX idx_upload_events_upload_id ON upload_events(upload_id);
CREATE INDEX idx_upload_events_status ON upload_events(status);
CREATE INDEX idx_upload_events_started_at ON upload_events(started_at);
```

## Service Layer Data Operations

### HistoryService Methods

**archiveCurrentVulnerabilities(reportId)**:
- Input: Report ID that will be archived
- Process: Copy current vulnerabilities to history tables
- Output: Count of archived records
- Transaction: Part of upload transaction

**findFixedVulnerabilities(filters)**:
- Input: Date range, severity, resource type filters
- Process: Compare history with current data using matching logic
- Output: Array of FixedVulnerability entities
- Performance: Use indexed queries with pagination

**getVulnerabilityHistory(findingArn)**:
- Input: Finding ARN
- Process: Retrieve all historical versions of a vulnerability
- Output: Chronological array of history records
- Use case: Vulnerability lifecycle analysis

### DatabaseService Extensions

**Existing methods extended**:
- `insertReport()` - Add upload event tracking
- `clearTables()` - Enhance with transaction support
- `getVulnerabilities()` - Add exclusion of historical data

**New methods**:
- `archiveVulnerabilities(reportId, transaction)`
- `getFixedVulnerabilities(filters)`
- `getVulnerabilityTimeline(findingArn)`
- `createUploadEvent(filename)`
- `updateUploadEvent(uploadId, status, metadata)`

## API Data Contracts

### Fixed Vulnerabilities Endpoint
**GET /api/fixed-vulnerabilities**

**Query Parameters**:
- `severity` - Filter by severity level
- `fixedAfter` - Show vulnerabilities fixed after date
- `fixedBefore` - Show vulnerabilities fixed before date
- `resourceType` - Filter by affected resource type
- `limit` - Pagination limit (default: 50)
- `offset` - Pagination offset (default: 0)

**Response Format**:
```json
{
  "data": [
    {
      "finding_arn": "arn:aws:inspector2:...",
      "vulnerability_id": "CVE-2024-12345",
      "title": "Critical vulnerability in package",
      "severity": "HIGH",
      "affected_resources": ["i-1234567890abcdef0"],
      "resource_types": ["EC2Instance"],
      "first_observed_at": "2024-08-01T10:00:00Z",
      "last_observed_at": "2024-09-15T14:30:00Z",
      "fixed_date": "2024-09-17T09:00:00Z",
      "days_active": 47,
      "fix_was_available": true
    }
  ],
  "pagination": {
    "total": 156,
    "limit": 50,
    "offset": 0,
    "has_more": true
  },
  "summary": {
    "total_fixed": 156,
    "avg_days_active": 23.5,
    "critical_fixed": 12,
    "high_fixed": 44,
    "medium_fixed": 78,
    "low_fixed": 22
  }
}
```

## State Management

### Upload Workflow State
```javascript
class UploadWorkflow {
  constructor(filename) {
    this.uploadId = generateUUID();
    this.filename = filename;
    this.status = 'STARTED';
    this.startedAt = new Date();
    this.recordsArchived = 0;
    this.recordsImported = 0;
  }

  async archive() {
    this.status = 'ARCHIVING';
    this.recordsArchived = await historyService.archiveCurrentVulnerabilities();
  }

  async clear() {
    this.status = 'CLEARING';
    await database.clearCurrentTables();
  }

  async import(data) {
    this.status = 'IMPORTING';
    this.recordsImported = await reportService.processReport(data);
  }

  complete() {
    this.status = 'COMPLETED';
    this.completedAt = new Date();
  }

  fail(error) {
    this.status = 'FAILED';
    this.errorMessage = error.message;
    this.completedAt = new Date();
  }
}
```

### Fixed Vulnerability Filtering
```javascript
class FixedVulnerabilityFilter {
  constructor() {
    this.severity = null;
    this.fixedAfter = null;
    this.fixedBefore = null;
    this.resourceType = null;
    this.limit = 50;
    this.offset = 0;
  }

  toSQLWhere() {
    const conditions = [];
    const params = [];

    if (this.severity) {
      conditions.push('h.severity = ?');
      params.push(this.severity);
    }

    if (this.fixedAfter) {
      conditions.push('h.archived_at >= ?');
      params.push(this.fixedAfter);
    }

    if (this.fixedBefore) {
      conditions.push('h.archived_at <= ?');
      params.push(this.fixedBefore);
    }

    if (this.resourceType) {
      conditions.push('EXISTS (SELECT 1 FROM resource_history rh WHERE rh.history_id = h.id AND rh.resource_type = ?)');
      params.push(this.resourceType);
    }

    return {
      where: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
      params: params
    };
  }
}
```

---

## Summary

The data model extends the existing vulnerability tracking system with:

1. **Historical preservation** via vulnerability_history and resource_history tables
2. **Upload workflow tracking** via upload_events table with state management
3. **Fixed vulnerability derivation** through comparison logic
4. **Robust indexing** for efficient historical queries and matching
5. **API contracts** for fixed vulnerability reporting with filtering and pagination
6. **Service layer abstractions** for clean separation of concerns

All schema changes are additive and maintain backward compatibility with existing vulnerability data structures.