# Tasks: Inspector Report Generation Date Tracking

**Input**: Design documents from `/specs/004-add-date-picker/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✅ Implementation plan loaded - Node.js Express web app
   → ✅ Tech stack: Express.js, EJS templating, SQLite3, multer
2. Load optional design documents:
   → ✅ data-model.md: Report entity, VulnHistory entity modifications
   → ✅ contracts/: upload-endpoint.json, date-picker-component.json
   → ✅ research.md: HTML5 date input, multi-layer validation approach
   → ✅ quickstart.md: Date picker functionality, historical upload scenarios
3. Generate tasks by category:
   → ✅ Setup: Database migration, linting
   → ✅ Tests: Contract tests for upload endpoint and date picker component
   → ✅ Core: Database schema changes, frontend date picker, backend validation
   → ✅ Integration: Upload handler modifications, history archiving
   → ✅ Polish: UI/UX tests, edge cases, performance validation
4. Apply task rules:
   → ✅ Different files = marked [P] for parallel execution
   → ✅ Same file = sequential (server.js modifications)
   → ✅ Tests before implementation (TDD approach)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → ✅ Upload endpoint contract has tests
   → ✅ Date picker component contract has tests
   → ✅ Database entities have migration tasks
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Existing Express.js structure**: `server.js`, `src/models/`, `views/`, `public/` at repository root
- Paths follow existing project structure per plan.md

## Phase 3.1: Setup
- [ ] T001 Create database migration script in migrations/004-add-report-run-date.sql
- [ ] T002 [P] Update package.json scripts for running database migrations
- [ ] T003 [P] Configure test framework for date validation scenarios

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T004 [P] Contract test upload endpoint with date field in tests/contract/test_upload_with_date.js
- [ ] T005 [P] Contract test date validation errors in tests/contract/test_date_validation.js
- [ ] T006 [P] Contract test date picker component behavior in tests/contract/test_date_picker_component.js
- [ ] T007 [P] Integration test historical report upload in tests/integration/test_historical_upload.js
- [ ] T008 [P] Integration test date preservation during archiving in tests/integration/test_date_archiving.js
- [ ] T009 [P] Integration test upload workflow with date picker in tests/integration/test_upload_workflow.js

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [ ] T010 Database migration: Add report_run_date to reports table
- [ ] T011 Database migration: Add report_run_date to vulnerability_history table
- [ ] T012 [P] Update Database.insertReport() method in src/models/database.js to accept report_run_date
- [ ] T013 [P] Date picker HTML component in views/index.ejs
- [ ] T014 [P] Date picker JavaScript behavior in public/js/upload.js
- [ ] T015 [P] Date picker CSS styling in public/css/style.css
- [ ] T016 Modify upload handler to capture reportRunDate in server.js
- [ ] T017 Add server-side date validation in server.js
- [ ] T018 Update archiveCurrentVulnerabilities() to preserve report_run_date in src/models/database.js

## Phase 3.4: Integration
- [ ] T019 Connect date picker to form submission flow
- [ ] T020 Update upload response to include both upload_date and report_run_date
- [ ] T021 Add date validation middleware for upload endpoint
- [ ] T022 Update dashboard views to display report generation dates
- [ ] T023 Add error handling for date validation failures

## Phase 3.5: Polish
- [ ] T024 [P] Unit tests for date validation logic in tests/unit/test_date_validation.js
- [ ] T025 [P] Unit tests for database migration in tests/unit/test_migration.js
- [ ] T026 [P] Edge case tests for date boundary conditions in tests/edge/test_date_boundaries.js
- [ ] T027 [P] Performance tests for date picker UX in tests/performance/test_date_picker_performance.js
- [ ] T028 [P] Browser compatibility tests for date input in tests/compatibility/test_browser_compatibility.js
- [ ] T029 Execute quickstart.md validation scenarios
- [ ] T030 Update user documentation for date picker feature

## Dependencies
- Setup (T001-T003) before tests (T004-T009)
- Tests (T004-T009) before implementation (T010-T018)
- T010, T011 (database migrations) block T012, T018
- T013, T014, T015 (frontend components) must be complete before T019
- T016 (upload handler) blocks T017, T020, T021
- Implementation (T010-T018) before integration (T019-T023)
- Integration before polish (T024-T030)

## Parallel Execution Examples

### Phase 3.2: Contract and Integration Tests
```
# Launch T004-T009 together (all different test files):
Task: "Contract test upload endpoint with date field in tests/contract/test_upload_with_date.js"
Task: "Contract test date validation errors in tests/contract/test_date_validation.js"
Task: "Contract test date picker component behavior in tests/contract/test_date_picker_component.js"
Task: "Integration test historical report upload in tests/integration/test_historical_upload.js"
Task: "Integration test date preservation during archiving in tests/integration/test_date_archiving.js"
Task: "Integration test upload workflow with date picker in tests/integration/test_upload_workflow.js"
```

### Phase 3.3: Frontend Components
```
# Launch T013-T015 together (different frontend files):
Task: "Date picker HTML component in views/index.ejs"
Task: "Date picker JavaScript behavior in public/js/upload.js"
Task: "Date picker CSS styling in public/css/style.css"
```

### Phase 3.5: Testing and Validation
```
# Launch T024-T028 together (all different test files):
Task: "Unit tests for date validation logic in tests/unit/test_date_validation.js"
Task: "Unit tests for database migration in tests/unit/test_migration.js"
Task: "Edge case tests for date boundary conditions in tests/edge/test_date_boundaries.js"
Task: "Performance tests for date picker UX in tests/performance/test_date_picker_performance.js"
Task: "Browser compatibility tests for date input in tests/compatibility/test_browser_compatibility.js"
```

## Task Details

### T001: Create database migration script
Create `migrations/004-add-report-run-date.sql` with:
- ALTER TABLE reports ADD COLUMN report_run_date DATETIME
- ALTER TABLE vulnerability_history ADD COLUMN report_run_date DATETIME
- Optional indexes for date-based queries

### T004: Contract test upload endpoint with date field
Implement test for POST /upload according to upload-endpoint.json contract:
- Test successful upload with reportRunDate field
- Verify response includes both upload_date and report_run_date
- Test file formats (JSON and CSV) with date field
- Must fail before T016-T017 implementation

### T010: Database migration - reports table
Execute ALTER TABLE statement to add report_run_date DATETIME column to reports table:
- Column should be nullable for backward compatibility
- Verify existing data remains intact

### T013: Date picker HTML component
Add date picker section to views/index.ejs according to date-picker-component.json:
- Hidden by default, shown when file selected
- HTML5 date input with max=today attribute
- Helper text explaining purpose
- Proper accessibility attributes

### T016: Modify upload handler
Update server.js upload endpoint (around lines 97-123):
- Extract reportRunDate from form data
- Add date validation (not future, not too old)
- Pass date to insertReport() method
- Update response to include both dates

### T022: Update dashboard views
Modify dashboard and vulnerabilities views to display:
- Report generation date alongside upload date
- Clear differentiation between the two timestamps
- Proper date formatting for user readability

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- Commit after each task
- Database migrations are irreversible - test thoroughly
- Date picker must work without JavaScript (graceful degradation)
- Maintain backward compatibility with existing reports

## Validation Checklist
*GATE: Checked before execution*

- [x] All contracts have corresponding tests (T004-T006)
- [x] Database entities have migration tasks (T010-T011)
- [x] All tests come before implementation (T004-T009 before T010-T018)
- [x] Parallel tasks truly independent (different files marked [P])
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Upload handler changes are sequential (T016-T017)
- [x] Frontend components can be parallel (T013-T015)
- [x] Integration tests cover key user scenarios