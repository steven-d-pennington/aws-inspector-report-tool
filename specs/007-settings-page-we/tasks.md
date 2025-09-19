# Tasks: Settings Page with Database Management

**Input**: Design documents from `/specs/007-settings-page-we/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/settings-api.yaml

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: Node.js 18+ with Express.js, EJS templating, PostgreSQL
   → Extract: Express.js backend, EJS frontend, existing database infrastructure
2. Load design documents ✓
   → data-model.md: DatabaseOperation, BackupFile entities → model tasks
   → contracts/settings-api.yaml: 7 endpoints → contract test tasks
   → research.md: Admin auth, backup strategies → setup tasks
3. Generate tasks by category:
   → Setup: admin auth, backup directory, dependencies
   → Tests: contract tests for each endpoint, integration tests
   → Core: settings service, database operations, UI components
   → Integration: route handlers, file operations, progress tracking
   → Polish: error handling, cleanup, documentation
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph and parallel execution examples
```

## Phase 3.1: Setup

- [ ] T001 Create backup directory structure and permissions
- [ ] T002 [P] Configure admin authentication environment variable (ADMIN_ENABLED)
- [ ] T003 [P] Add pg_dump dependency validation and child_process imports

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (API Endpoints)
- [ ] T004 [P] Contract test GET /settings in tests/contract/test_settings_page.js
- [ ] T005 [P] Contract test POST /api/settings/backup in tests/contract/test_backup_create.js
- [ ] T006 [P] Contract test GET /api/settings/backup/status/{id} in tests/contract/test_backup_status.js
- [ ] T007 [P] Contract test GET /api/settings/backup/download/{filename} in tests/contract/test_backup_download.js
- [ ] T008 [P] Contract test GET /api/settings/backup/list in tests/contract/test_backup_list.js
- [ ] T009 [P] Contract test POST /api/settings/clear in tests/contract/test_clear_database.js
- [ ] T010 [P] Contract test GET /api/settings/clear/status/{id} in tests/contract/test_clear_status.js

### Integration Tests
- [ ] T011 [P] Integration test admin access control in tests/integration/test_admin_auth.js
- [ ] T012 [P] Integration test backup creation and download flow in tests/integration/test_backup_flow.js
- [ ] T013 [P] Integration test database clear with settings preservation in tests/integration/test_clear_flow.js
- [ ] T014 [P] Integration test concurrent operations prevention in tests/integration/test_concurrent_ops.js
- [ ] T015 [P] Integration test error handling scenarios in tests/integration/test_error_handling.js

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Models and Services
- [ ] T016 [P] DatabaseOperation model in src/models/databaseOperation.js
- [ ] T017 [P] BackupFile model in src/models/backupFile.js
- [ ] T018 SettingsService with backup operations in src/services/settingsService.js
- [ ] T019 Add clear database methods to src/models/database.js

### UI Components
- [ ] T020 [P] Settings page template in views/settings.ejs
- [ ] T021 [P] Settings page JavaScript in public/js/settings.js
- [ ] T022 [P] Settings page CSS styling in public/css/style.css
- [ ] T023 Update navigation with settings link in views/partials/navbar.ejs

### Route Handlers
- [ ] T024 GET /settings route handler in server.js
- [ ] T025 POST /api/settings/backup route handler in server.js
- [ ] T026 GET /api/settings/backup/status/{id} route handler in server.js
- [ ] T027 GET /api/settings/backup/download/{filename} route handler in server.js
- [ ] T028 GET /api/settings/backup/list route handler in server.js
- [ ] T029 POST /api/settings/clear route handler in server.js
- [ ] T030 GET /api/settings/clear/status/{id} route handler in server.js

## Phase 3.4: Integration

- [ ] T031 Admin authentication middleware integration
- [ ] T032 Operation progress tracking and WebSocket integration
- [ ] T033 File cleanup automation for completed downloads
- [ ] T034 Error logging and audit trail implementation
- [ ] T035 Input validation and confirmation text verification

## Phase 3.5: Polish

- [ ] T036 [P] Unit tests for DatabaseOperation model in tests/unit/test_database_operation.js
- [ ] T037 [P] Unit tests for BackupFile model in tests/unit/test_backup_file.js
- [ ] T038 [P] Unit tests for SettingsService in tests/unit/test_settings_service.js
- [ ] T039 Performance optimization for backup operations (<2s page load)
- [ ] T040 Security audit for file download paths and admin access
- [ ] T041 [P] Update API documentation in docs/api.md
- [ ] T042 Execute manual validation using quickstart.md
- [ ] T043 Remove any code duplication and cleanup

## Dependencies

**Setup Dependencies**:
- T001 blocks T018, T025, T027 (backup directory required)
- T002 blocks T011, T024 (admin auth required)
- T003 blocks T018, T025 (pg_dump validation required)

**Test Dependencies (TDD)**:
- Tests (T004-T015) must complete and FAIL before implementation (T016-T035)
- All tests must be written first to ensure TDD approach

**Implementation Dependencies**:
- T016, T017 block T018 (models before service)
- T018 blocks T025, T026, T029, T030 (service before route handlers)
- T019 blocks T029, T030 (database methods before clear handlers)
- T020-T023 can run in parallel (different files)
- T024-T030 sequential (same file: server.js)

**Integration Dependencies**:
- T031 blocks T024-T030 (auth middleware before routes)
- T032 blocks T026, T030 (progress tracking before status endpoints)
- T034 depends on T024-T030 (logging requires routes)

**Polish Dependencies**:
- Implementation (T016-T035) before polish (T036-T043)
- T036-T038 can run in parallel (different test files)
- T042 blocks T043 (manual validation before cleanup)

## Parallel Execution Examples

### Phase 3.2: Contract Tests (Launch together)
```bash
# Launch T004-T010 together:
Task: "Contract test GET /settings in tests/contract/test_settings_page.js"
Task: "Contract test POST /api/settings/backup in tests/contract/test_backup_create.js"
Task: "Contract test GET /api/settings/backup/status/{id} in tests/contract/test_backup_status.js"
Task: "Contract test GET /api/settings/backup/download/{filename} in tests/contract/test_backup_download.js"
Task: "Contract test GET /api/settings/backup/list in tests/contract/test_backup_list.js"
Task: "Contract test POST /api/settings/clear in tests/contract/test_clear_database.js"
Task: "Contract test GET /api/settings/clear/status/{id} in tests/contract/test_clear_status.js"
```

### Phase 3.2: Integration Tests (Launch together)
```bash
# Launch T011-T015 together:
Task: "Integration test admin access control in tests/integration/test_admin_auth.js"
Task: "Integration test backup creation and download flow in tests/integration/test_backup_flow.js"
Task: "Integration test database clear with settings preservation in tests/integration/test_clear_flow.js"
Task: "Integration test concurrent operations prevention in tests/integration/test_concurrent_ops.js"
Task: "Integration test error handling scenarios in tests/integration/test_error_handling.js"
```

### Phase 3.3: Models and UI (Launch together)
```bash
# Launch T016, T017, T020-T022 together:
Task: "DatabaseOperation model in src/models/databaseOperation.js"
Task: "BackupFile model in src/models/backupFile.js"
Task: "Settings page template in views/settings.ejs"
Task: "Settings page JavaScript in public/js/settings.js"
Task: "Settings page CSS styling in public/css/style.css"
```

### Phase 3.5: Unit Tests (Launch together)
```bash
# Launch T036-T038 together:
Task: "Unit tests for DatabaseOperation model in tests/unit/test_database_operation.js"
Task: "Unit tests for BackupFile model in tests/unit/test_backup_file.js"
Task: "Unit tests for SettingsService in tests/unit/test_settings_service.js"
```

## Notes

- **[P] tasks**: Different files, no dependencies - can run in parallel
- **TDD Critical**: Verify all tests fail before implementing functionality
- **Server.js Sequential**: All route handlers (T024-T030) must be sequential (same file)
- **Admin Auth**: Environment variable ADMIN_ENABLED=true required for testing
- **File Paths**: All paths assume existing Express.js project structure
- **Backup Directory**: Create `backups/` directory in project root
- **PostgreSQL**: Requires pg_dump available in system PATH

## Validation Checklist

- [x] All contracts have corresponding tests (T004-T010)
- [x] All entities have model tasks (T016-T017)
- [x] All tests come before implementation (T004-T015 before T016-T035)
- [x] Parallel tasks truly independent (different files, no shared state)
- [x] Each task specifies exact file path
- [x] No [P] task modifies same file as another [P] task
- [x] Dependencies properly documented and ordered
- [x] TDD approach enforced (tests first, implementation second)

## Feature Completion Criteria

**Functional Requirements**:
- Settings page accessible from navigation (T023, T024)
- Database management section present (T020)
- Database clear functionality works (T019, T029)
- Settings preserved during clear (T013, T019)
- Backup creation functionality works (T018, T025)
- Multi-step confirmation enforced (T021, T035)
- Progress indicators shown (T021, T032)
- Admin privileges validated (T002, T031)
- Local backup storage with download (T016, T017, T027, T033)
- Compressed SQL dump format (T018)

**Performance Requirements**:
- Settings page loads < 2 seconds (T039)
- Backup doesn't impact other users (T018, T032)
- Clear operations complete reasonably (T019)

**Security Requirements**:
- Operations logged for audit (T034)
- User permissions validated (T031, T040)
- Unauthorized access prevented (T011, T031)

---

**Tasks Complete**: 43 numbered, ordered tasks ready for TDD implementation following constitutional principles.