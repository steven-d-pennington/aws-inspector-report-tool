# Research Report: Database Backup and Clear Settings Implementation

**Phase 0 Output**: All NEEDS CLARIFICATION items resolved through comprehensive research
**Date**: 2025-09-18

## Research Findings Summary

### 1. Application Settings Definition (RESOLVED)

**Decision**: No persistent application settings exist in current database schema
**Rationale**: Analysis of database.js revealed all tables contain user-uploaded vulnerability data
**Implementation Impact**: "Clear user data" operation will truncate all tables while preserving schema structure

**Current Tables (All User Data)**:
- `reports` - Uploaded vulnerability reports metadata
- `vulnerabilities` - Parsed vulnerability findings
- `resources` - AWS resource associations
- `packages` - Software package information
- `references` - Vulnerability reference URLs
- `vulnerability_history` - Archived vulnerability data
- `resource_history` - Archived resource associations
- `upload_events` - Upload workflow tracking

**Clear Operation Scope**:
- Truncate all data tables (preserve schema)
- Clear `/uploads/` directory
- Reset application to initial empty state
- No configuration settings to preserve

### 2. Backup Storage Location (RESOLVED)

**Decision**: Dedicated `/backups` directory with secure permissions and atomic operations
**Rationale**: Production-ready approach using SQLite backup API vs file copying
**Alternatives Considered**: External storage (AWS S3) - rejected for simplicity

**Implementation Details**:
```
project_root/
├── backups/
│   ├── manual/     # User-initiated backups
│   ├── auto/       # Pre-destructive operation backups
│   └── temp/       # Temporary staging area
```

**Security Measures**:
- Directory permissions: 0o750
- File permissions: 0o640
- Atomic operations (temp → final)
- Structured naming: `vulnerability_db_backup_YYYY-MM-DD_HH-mm-ss.db`

### 3. Confirmation Mechanism (RESOLVED)

**Decision**: Risk-appropriate confirmation patterns
**Rationale**: Balance security with usability for single-user admin interface
**Alternatives Considered**: Always high-friction - rejected for UX

**Implementation Strategy**:
- **Database Backup**: Simple progress indication (low risk)
- **Clear All Data**: Type-to-confirm pattern requiring "CLEAR ALL DATA" input (high risk)
- **CSRF Protection**: Add to all destructive endpoints
- **Pre-destruction Backup**: Automatic backup before clear operations

**Confirmation Levels**:
1. **Low Risk** (Backup): Progress modal with cancel option
2. **High Risk** (Clear): Type-to-confirm + CSRF + automatic backup

### 4. SQLite Backup Technology (RESOLVED)

**Decision**: SQLite backup API with sqlite3 library
**Rationale**: Safe for active databases, non-blocking, handles WAL mode
**Alternatives Considered**: File copying - rejected due to corruption risk

**Technical Implementation**:
- Use `sqlite3.Database.backup()` method
- Step-based backup with progress callbacks
- Error handling for busy/locked database states
- 30-second timeout protection

### 5. Security Patterns (RESOLVED)

**Decision**: CSRF protection + rate limiting + audit logging
**Rationale**: Essential for admin operations even in single-user systems
**Implementation**: Express middleware with csurf library

**Security Stack**:
- CSRF tokens for destructive operations
- Rate limiting (10 operations per 15 minutes)
- Request validation middleware
- Audit logging for all backup/clear operations

## Technical Architecture Decisions

### Service Layer Design
- **BackupService**: Handle SQLite backup operations
- **SettingsService**: Coordinate backup + clear workflows
- **SecurityMiddleware**: CSRF protection and validation

### Frontend Components
- **Settings Page**: New EJS template with secure confirmation modals
- **Progress Indicators**: Real-time feedback for long operations
- **Type-to-Confirm**: High-friction confirmation for destructive actions

### Database Integration
- Extend existing `database.js` with backup integration
- Add audit logging methods
- Preserve existing service patterns

## Risk Assessment

**Low Risk**:
- Database backup operations (read-only, non-destructive)
- Progress tracking and status APIs

**High Risk**:
- Complete data clearing (irreversible)
- File system operations (backup storage)

**Mitigation Strategies**:
- Automatic backup before destructive operations
- Type-to-confirm for high-risk actions
- Comprehensive error handling
- Operation status tracking

## Dependencies Confirmed

**Existing Dependencies** (No additions needed):
- `sqlite3`: For backup API access
- `express`: Web framework with middleware support
- `ejs`: Template rendering for settings page
- `fs.promises`: File system operations

**New Dependencies** (Optional):
- `csurf`: CSRF protection middleware
- `express-rate-limit`: Rate limiting for destructive operations

## Performance Expectations

**Backup Operations**:
- Typical database (1-100MB): 5-30 seconds
- Progress updates every 100 pages
- Non-blocking main thread operation

**Clear Operations**:
- Delete operations: <5 seconds for typical data volumes
- Includes pre-operation backup time
- Atomic transaction for data consistency

## Next Phase Requirements

All NEEDS CLARIFICATION items resolved. Ready for Phase 1 design work:
1. Data model design (backup metadata, audit logs)
2. API contract definition (backup/clear endpoints)
3. Frontend component contracts (settings page, modals)
4. Integration patterns with existing services

**Research Complete** ✅