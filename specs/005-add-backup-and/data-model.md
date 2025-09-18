# Data Model: Database Backup and Clear Settings

**Phase 1 Output**: Entity definitions and data relationships for backup/clear functionality
**Date**: 2025-09-18

## Overview
This feature introduces data management capabilities without modifying existing vulnerability database schema. All new entities are handled through service layer abstractions and file system storage.

## Entity Definitions

### 1. BackupMetadata
**Purpose**: Track database backup operations and file metadata
**Storage**: File system metadata (backup files) + in-memory operation tracking
**Lifecycle**: Created during backup operation, persisted as file system metadata

**Attributes**:
- `backupId`: string - Unique identifier (timestamp-based)
- `filePath`: string - Absolute path to backup file
- `fileName`: string - Generated backup filename
- `fileSize`: number - Backup file size in bytes
- `timestamp`: ISO 8601 string - When backup was created
- `reason`: enum - Backup trigger ('manual', 'pre_clear', 'scheduled')
- `status`: enum - Operation status ('pending', 'in_progress', 'completed', 'failed')
- `md5Hash`: string - File integrity checksum
- `originalDbSize`: number - Source database size at backup time

**Example**:
```json
{
  "backupId": "backup_2025-09-18_14-30-45",
  "filePath": "/project/backups/manual/vulnerability_db_backup_2025-09-18_14-30-45.db",
  "fileName": "vulnerability_db_backup_2025-09-18_14-30-45.db",
  "fileSize": 1048576,
  "timestamp": "2025-09-18T14:30:45.123Z",
  "reason": "manual",
  "status": "completed",
  "md5Hash": "d41d8cd98f00b204e9800998ecf8427e",
  "originalDbSize": 987654
}
```

### 2. OperationAudit
**Purpose**: Audit trail for all backup and clear operations
**Storage**: In-memory during operation, logged to file system
**Lifecycle**: Created at operation start, updated during execution, finalized at completion

**Attributes**:
- `operationId`: string - Unique operation identifier
- `operationType`: enum - Type of operation ('backup', 'clear', 'restore')
- `startTime`: ISO 8601 string - Operation start timestamp
- `endTime`: ISO 8601 string - Operation completion timestamp
- `duration`: number - Operation duration in milliseconds
- `status`: enum - Operation outcome ('success', 'failed', 'cancelled')
- `errorMessage`: string - Error details if failed (optional)
- `affectedTables`: array - Database tables affected by operation
- `recordsCounted`: object - Count of records before operation
- `backupTriggered`: boolean - Whether automatic backup was created
- `backupId`: string - Associated backup ID if backup was created
- `userConfirmation`: object - Confirmation details for destructive operations

**Example**:
```json
{
  "operationId": "op_1695044245123",
  "operationType": "clear",
  "startTime": "2025-09-18T14:30:45.123Z",
  "endTime": "2025-09-18T14:30:47.456Z",
  "duration": 2333,
  "status": "success",
  "affectedTables": ["reports", "vulnerabilities", "resources", "packages", "references"],
  "recordsCounted": {
    "reports": 15,
    "vulnerabilities": 247,
    "resources": 89,
    "packages": 156,
    "references": 78
  },
  "backupTriggered": true,
  "backupId": "backup_2025-09-18_14-30-43",
  "userConfirmation": {
    "confirmationText": "CLEAR ALL DATA",
    "timestamp": "2025-09-18T14:30:44.100Z",
    "csrfToken": "abc123def456"
  }
}
```

### 3. OperationProgress
**Purpose**: Real-time operation progress tracking for long-running operations
**Storage**: In-memory only (no persistence)
**Lifecycle**: Created at operation start, updated during execution, destroyed at completion

**Attributes**:
- `operationId`: string - Links to OperationAudit
- `totalSteps`: number - Total steps in operation
- `currentStep`: number - Current step being executed
- `stepDescription`: string - Human-readable current step description
- `percentComplete`: number - Completion percentage (0-100)
- `estimatedTimeRemaining`: number - Estimated milliseconds remaining
- `lastUpdated`: ISO 8601 string - Last progress update timestamp

**Example**:
```json
{
  "operationId": "op_1695044245123",
  "totalSteps": 5,
  "currentStep": 3,
  "stepDescription": "Backing up database before clearing data",
  "percentComplete": 60,
  "estimatedTimeRemaining": 8000,
  "lastUpdated": "2025-09-18T14:30:46.500Z"
}
```

## Data Relationships

### Backup → Audit Relationship
- One backup operation creates one OperationAudit record
- One clear operation may trigger automatic backup, creating linked records
- `backupId` in OperationAudit links to BackupMetadata.backupId

### Operation → Progress Relationship
- One-to-one relationship during operation execution
- Progress entity is ephemeral (no persistence beyond operation completion)
- Linked via `operationId`

### File System Structure
```
backups/
├── manual/              # User-initiated backups
│   ├── vulnerability_db_backup_2025-09-18_14-30-45.db
│   └── vulnerability_db_backup_2025-09-18_15-15-22.db
├── pre_clear/           # Automatic pre-destructive operation backups
│   └── vulnerability_db_backup_2025-09-18_14-30-43.db
└── metadata/            # Operation audit logs
    ├── backup_operations.log
    └── clear_operations.log
```

## Validation Rules

### BackupMetadata Validation
- `fileName` must follow pattern: `vulnerability_db_backup_YYYY-MM-DD_HH-mm-ss.db`
- `fileSize` must be > 0 and match actual file size
- `timestamp` must be valid ISO 8601 format
- `reason` must be one of: 'manual', 'pre_clear', 'scheduled'
- `status` must be one of: 'pending', 'in_progress', 'completed', 'failed'
- `md5Hash` must match actual file checksum

### OperationAudit Validation
- `operationType` must be one of: 'backup', 'clear', 'restore'
- `endTime` must be after `startTime` (when both present)
- `duration` must match calculated time difference
- `status` must be one of: 'success', 'failed', 'cancelled'
- `affectedTables` must be non-empty array for clear operations
- `userConfirmation` required for clear operations

### OperationProgress Validation
- `percentComplete` must be 0-100
- `currentStep` must be ≤ `totalSteps`
- `lastUpdated` must be recent (within last 30 seconds for active operations)

## State Transitions

### Backup Operation States
```
pending → in_progress → (completed | failed)
```

### Clear Operation States
```
pending → confirmation_required → backup_in_progress → clearing_data → (completed | failed)
```

### Error Handling States
- Failed backup: Preserve original database, cleanup temp files
- Failed clear: Stop operation, preserve existing data, maintain backup
- Cancelled operation: Cleanup temp files, preserve all existing data

## Integration Points

### Existing Database Schema
**No modifications to existing tables**:
- All vulnerability tables remain unchanged
- Clear operations use existing deletion patterns
- Backup operations are read-only from existing database

### Service Layer Integration
- **BackupService**: Manages BackupMetadata lifecycle
- **SettingsService**: Orchestrates operations using both entities
- **Database.js**: Extended with backup integration methods
- **Existing Services**: No modifications required

### Frontend Integration
- Settings page displays BackupMetadata for available backups
- Progress indicators consume OperationProgress real-time updates
- Confirmation dialogs capture data for OperationAudit records

## Security Considerations

### Data Protection
- Backup files stored with secure permissions (0o640)
- Audit logs contain no sensitive data (only metadata)
- User confirmation data includes CSRF token validation

### Access Control
- All operations require admin-level access (existing pattern)
- File system access restricted to backup directories
- Clear operations require explicit user confirmation

### Audit Requirements
- All destructive operations logged to OperationAudit
- Backup integrity validated with MD5 checksums
- User confirmation details preserved for audit trail

**Data Model Complete** ✅