# Data Model: Settings Page with Database Management

**Feature**: Settings Page with Database Management
**Phase**: Phase 1 - Design & Contracts
**Date**: 2025-09-19

## Runtime Entities

### DatabaseOperation
**Purpose**: Track long-running database operations (backup/clear) in memory

**Fields**:
- `id`: string (UUID) - Unique operation identifier
- `type`: 'backup' | 'clear' - Operation type
- `status`: 'pending' | 'running' | 'completed' | 'failed' - Current status
- `startTime`: Date - Operation start timestamp
- `endTime`: Date | null - Operation completion timestamp
- `progress`: number (0-100) - Completion percentage
- `errorMessage`: string | null - Error details if failed
- `metadata`: object - Operation-specific data

**Validation Rules**:
- `id` must be valid UUID v4
- `type` must be one of allowed enum values
- `status` must be one of allowed enum values
- `progress` must be between 0 and 100
- `startTime` cannot be in the future
- `endTime` must be after `startTime` if set

**State Transitions**:
```
pending → running → completed
pending → running → failed
pending → failed (validation errors)
```

**Metadata Schema by Type**:
```javascript
// For backup operations
{
  filename: string,
  filepath: string,
  fileSize: number | null,
  downloadUrl: string | null
}

// For clear operations
{
  tablesCleared: string[],
  recordsDeleted: {
    vulnerabilities: number,
    reports: number,
    upload_events: number,
    // ... other tables
  },
  settingsPreserved: number
}
```

## Filesystem Entities

### BackupFile
**Purpose**: Represent backup files stored on local filesystem

**Fields**:
- `filename`: string - File name with timestamp
- `filepath`: string - Absolute file path
- `size`: number - File size in bytes
- `created`: Date - File creation timestamp
- `compressed`: boolean - Compression status (always true)
- `downloadCount`: number - Number of downloads (optional tracking)

**Validation Rules**:
- `filename` must match pattern: `backup_YYYY-MM-DD_HH-mm-ss.sql.gz`
- `filepath` must be within designated backup directory
- `size` must be positive number
- `created` cannot be in the future

**Naming Convention**:
```
backup_2025-09-19_14-30-45.sql.gz
```

## Database Tables (Existing - No Changes)

### settings (Preserved During Clear)
**Purpose**: System configuration preserved during database clear operations

**Fields** (existing):
- `id`: integer (primary key)
- `key`: varchar(255) - Setting key
- `value`: text - Setting value
- `type`: varchar(50) - Value type
- `created_at`: timestamp
- `updated_at`: timestamp

**Preservation Logic**: This table is explicitly excluded from clear operations

## API Data Transfer Objects

### OperationResponse
**Purpose**: Standard response for operation initiation

**Schema**:
```json
{
  "operationId": "string (UUID)",
  "status": "pending",
  "message": "string (optional)"
}
```

### OperationStatus
**Purpose**: Status response for operation tracking

**Schema**:
```json
{
  "id": "string (UUID)",
  "type": "backup | clear",
  "status": "pending | running | completed | failed",
  "progress": "number (0-100)",
  "startTime": "ISO 8601 timestamp",
  "endTime": "ISO 8601 timestamp | null",
  "errorMessage": "string | null",
  "downloadUrl": "string | null (backup only)",
  "metadata": "object (type-specific)"
}
```

### BackupListResponse
**Purpose**: List available backup files

**Schema**:
```json
{
  "backups": [
    {
      "filename": "string",
      "size": "number",
      "created": "ISO 8601 timestamp",
      "downloadUrl": "string"
    }
  ],
  "totalSize": "number",
  "count": "number"
}
```

### ClearConfirmationRequest
**Purpose**: Database clear confirmation payload

**Schema**:
```json
{
  "confirmationText": "string",
  "preserveSettings": "boolean (default: true)"
}
```

**Validation**:
- `confirmationText` must exactly equal "CONFIRM"
- `preserveSettings` defaults to true and is enforced

## Relationships

### Operation Lifecycle
```
DatabaseOperation 1:1 BackupFile (for backup operations)
DatabaseOperation 1:* WebSocket connections (for progress updates)
```

### File Management
```
BackupFile *:1 Storage Directory
BackupFile 1:* Download Events (audit trail)
```

## Business Rules

### Admin Access Control
- All operations require admin authentication
- Admin status determined by environment variable
- Session validation for persistent admin state

### Operation Concurrency
- Only one destructive operation (clear) allowed at a time
- Multiple backup operations allowed simultaneously
- Operations queued if system resources constrained

### Data Preservation
- Settings table always preserved during clear operations
- System configuration maintained across resets
- Audit logs preserved if configured

### File Lifecycle
- Backup files automatically cleaned up after download
- Cleanup delay: 5 minutes post-download
- Failed backups cleaned up immediately
- Maximum backup retention: configurable (default 7 days)

### Error Recovery
- Failed operations log detailed error information
- Partial operations can be retried
- Database transactions ensure atomicity
- File system operations include rollback procedures

## Validation Constraints

### Input Validation
- All user inputs sanitized and validated
- Confirmation text exactly matches required string
- File paths validated against directory traversal
- Operation IDs validated as proper UUIDs

### Business Logic Validation
- Admin privileges verified before any operation
- Concurrent operation limits enforced
- Disk space checked before backup creation
- Database connectivity verified before operations

### Security Constraints
- All file operations within designated directories
- Download URLs include time-limited tokens
- Operation logging for audit compliance
- Rate limiting on destructive operations

---

**Data Model Complete**: All entities, relationships, and validation rules defined for implementation.