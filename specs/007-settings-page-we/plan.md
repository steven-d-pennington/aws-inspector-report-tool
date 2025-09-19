# Implementation Plan: Settings Page with Database Management

**Branch**: `007-settings-page-we` | **Date**: 2025-09-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-settings-page-we/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✓
   → Feature spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION) ✓
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document. ✓
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md ✓
   → All unknowns resolved in research.md
6. Execute Phase 1 → contracts, data-model.md, quickstart.md ✓
   → Generated settings-api.yaml, data-model.md, quickstart.md
7. Re-evaluate Constitution Check section ✓
   → No new violations found, design aligns with constitution
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Task generation approach described ✓
9. STOP - Ready for /tasks command ✓
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Create a dedicated settings page with database management functionality, including admin-only access controls, database clear operations with multi-step confirmation, and backup functionality using compressed SQL dumps stored locally with download capability.

## Technical Context
**Language/Version**: Node.js 18+ with Express.js framework
**Primary Dependencies**: Express.js, EJS templating, pg (PostgreSQL client), child_process (for pg_dump)
**Storage**: PostgreSQL database (existing connection infrastructure)
**Testing**: npm test (existing test framework)
**Target Platform**: Web application server (Linux/Windows compatible)
**Project Type**: web - Express.js backend with EJS frontend
**Performance Goals**: Settings page load <2s, backup operations without blocking other users
**Constraints**: Multi-step confirmation required, admin-only access, preserve system settings during clear
**Scale/Scope**: Single settings page with 2 primary operations (clear/backup), admin interface

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Code Organization**: ✓ PASS
- Settings service will handle business logic following existing pattern (reportService.js, exportService.js)
- Database layer will use existing models/database.js abstraction
- Views will use EJS templating with consistent styling
- Static assets served from existing public/ directory

**Testing Standards**: ✓ PASS
- Database operations will be tested with existing test infrastructure
- Error handling tested for edge cases (disk space, interruptions)
- Multi-step confirmation flow validation

**Performance Guidelines**: ✓ PASS
- Database operations optimized to not block other users
- Backup operations will use child_process to avoid blocking main thread
- Memory usage monitored during backup creation

**Security & Backward Compatibility**: ✓ PASS
- Admin-only access controls maintain security
- Essential system settings preserved during clear operations
- No breaking changes to existing vulnerability data structure

## Project Structure

### Documentation (this feature)
```
specs/007-settings-page-we/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 2: Web application (existing structure)
server.js                # Main Express app - add settings routes
views/
├── settings.ejs         # New settings page template
├── partials/
│   └── navbar.ejs       # Update with settings link
public/
├── css/
│   └── style.css        # Settings page styling
├── js/
│   └── settings.js      # Settings page JavaScript
src/
├── models/
│   └── database.js      # Existing - add backup/clear methods
├── services/
│   └── settingsService.js # New service for settings operations
```

**Structure Decision**: Option 2 (Web application) - existing Express.js backend with EJS frontend

## Phase 0: Outline & Research

### Research Tasks Identified:
1. **PostgreSQL backup best practices** - pg_dump options, compression, error handling
2. **Express.js admin authentication** - session-based vs middleware approach
3. **Multi-step confirmation UI patterns** - text verification, progress indicators
4. **Database clearing strategies** - preserving settings table, transaction safety
5. **File download implementation** - streaming large backup files, cleanup

### Research Findings:

**PostgreSQL Backup Decision**: Use pg_dump with gzip compression
- **Rationale**: Standard PostgreSQL tool, reliable, portable across versions
- **Alternatives considered**: Custom SQL export (rejected - less reliable), binary dump (rejected - less portable)

**Admin Authentication Decision**: Simple environment variable flag for initial implementation
- **Rationale**: Matches existing architecture simplicity, easy to implement
- **Alternatives considered**: Session-based auth (rejected - overkill for single admin), database roles (rejected - adds complexity)

**Multi-step Confirmation Decision**: Modal dialog with text input verification
- **Rationale**: Clear user intent validation, prevents accidental operations
- **Alternatives considered**: Double-click (rejected - insufficient protection), checkbox confirmation (rejected - too simple)

**Database Clearing Decision**: DELETE statements preserving settings table
- **Rationale**: Surgical approach, maintains referential integrity
- **Alternatives considered**: DROP/CREATE (rejected - loses schema), TRUNCATE CASCADE (rejected - too broad)

**File Download Decision**: Express response streaming with automatic cleanup
- **Rationale**: Memory efficient for large files, built-in Express support
- **Alternatives considered**: Pre-generate download links (rejected - security risk), direct file serve (rejected - no cleanup)

## Phase 1: Design & Contracts

### Data Model Entities:

**DatabaseOperation** (runtime entity, not persisted):
- `id`: string (UUID for tracking)
- `type`: 'backup' | 'clear'
- `status`: 'pending' | 'running' | 'completed' | 'failed'
- `startTime`: Date
- `endTime`: Date | null
- `progress`: number (0-100)
- `errorMessage`: string | null
- `metadata`: object (file path for backups, counts for clear)

**BackupFile** (filesystem entity):
- `filename`: string (timestamp-based naming)
- `path`: string (absolute file path)
- `size`: number (bytes)
- `created`: Date
- `compressed`: boolean (always true for our implementation)

### API Contracts:

**GET /settings** - Render settings page
- Response: HTML page with admin controls
- Auth: Admin required

**POST /api/settings/backup** - Create database backup
- Response: `{ operationId: string, status: 'pending' }`
- Auth: Admin required

**GET /api/settings/backup/status/:id** - Check backup status
- Response: `{ status: string, progress: number, downloadUrl?: string }`
- Auth: Admin required

**GET /api/settings/backup/download/:filename** - Download backup file
- Response: File stream with appropriate headers
- Auth: Admin required

**POST /api/settings/clear** - Clear database with confirmation
- Request: `{ confirmationText: string }`
- Response: `{ operationId: string, status: 'pending' }`
- Auth: Admin required
- Validation: confirmationText must equal "CONFIRM"

**GET /api/settings/clear/status/:id** - Check clear operation status
- Response: `{ status: string, progress: number, recordsCleared?: number }`
- Auth: Admin required

### Integration Test Scenarios:

1. **Admin Access Control**: Non-admin users cannot access settings page
2. **Backup Creation**: Admin can create backup and download resulting file
3. **Database Clear**: Admin can clear database with proper confirmation
4. **Concurrent Operations**: Multiple operations are properly queued
5. **Error Handling**: Failed operations provide meaningful error messages

### Quickstart Validation:
1. Navigate to /settings as admin
2. Create database backup
3. Download backup file
4. Clear database with confirmation
5. Verify settings table preserved

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each API endpoint → contract test task [P]
- Settings service → model creation task [P]
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation
- Dependency order: Service before routes before UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 20-25 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No constitutional violations identified - all requirements align with existing architecture*

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning approach described (/plan command)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none required)

---
*Based on Constitution v1.0.0 - See `/.specify/memory/constitution.md`*