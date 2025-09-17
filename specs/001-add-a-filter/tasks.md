# Tasks: Date Filter for Vulnerabilities Page

**Input**: Design documents from `/specs/001-add-a-filter/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Web app structure**: Existing Express.js application with EJS views
- Frontend: `public/js/`, `public/css/`, `views/`
- Backend: `src/models/`, `src/services/`, `server.js`
- Tests: Manual testing using quickstart scenarios

## Phase 3.1: Setup
- [ ] T001 Analyze existing codebase structure and identify integration points for date filter
- [ ] T002 [P] Add HTML5 date input fallback dependencies (if needed for older browser support)
- [ ] T003 [P] Configure Express.js request validation for date parameters using express-validator

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T004 [P] Create manual test scenarios in `tests/manual/date-filter-basic.md` for basic date selection functionality
- [ ] T005 [P] Create manual test scenarios in `tests/manual/date-filter-persistence.md` for localStorage persistence testing
- [ ] T006 [P] Create manual test scenarios in `tests/manual/date-filter-integration.md` for existing filter system integration
- [ ] T007 [P] Create API contract validation test script in `tests/contract/test-vulnerabilities-date-filter.js` for /api/vulnerabilities with lastObservedAt parameter

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Backend Implementation
- [ ] T008 [P] Extend Database.getVulnerabilities() method in `src/models/database.js` to support lastObservedAt filtering with null exclusion
- [ ] T009 [P] Add express-validator middleware for date parameter validation in vulnerability routes
- [ ] T010 Update GET /api/vulnerabilities endpoint in `server.js` to accept and process lastObservedAt query parameter
- [ ] T011 Add date filtering logic to existing vulnerability query builder with proper SQL parameterization

### Frontend Implementation
- [ ] T012 [P] Add HTML5 date input element to vulnerabilities filter section in `views/vulnerabilities.ejs`
- [ ] T013 [P] Implement DateFilter class for client-side state management in `public/js/dateFilter.js`
- [ ] T014 [P] Add date filter styles and responsive design in `public/css/style.css`
- [ ] T015 Extend existing filter management in `public/js/vulnerabilities.js` to include date filtering
- [ ] T016 Implement localStorage persistence for date filter state in existing filter persistence logic
- [ ] T017 Add clear date filter functionality to existing clear filters implementation

## Phase 3.4: Integration
- [ ] T018 Integrate date filter with existing vulnerability list updates and ensure immediate filtering response
- [ ] T019 Ensure date filter works correctly with existing filter combinations (severity, status, etc.)
- [ ] T020 Update existing export functionality (PDF/Notion) to respect date filter parameters
- [ ] T021 Add date filter information to existing export headers and filter summaries

## Phase 3.5: Polish
- [ ] T022 [P] Add form validation and user feedback for invalid date selections
- [ ] T023 [P] Implement quick preset buttons (30/60/90 days) as defined in research decisions
- [ ] T024 [P] Add accessibility attributes (ARIA labels) to date picker components
- [ ] T025 Optimize database query performance for date filtering with existing indexes
- [ ] T026 [P] Add loading states and performance monitoring for date filter operations
- [ ] T027 Execute complete quickstart.md test scenarios to validate all functionality
- [ ] T028 [P] Update user documentation with date filter usage instructions

## Dependencies
- Setup (T001-T003) before everything
- Tests (T004-T007) before implementation (T008-T021)
- Backend data layer (T008) blocks API endpoints (T010-T011)
- Frontend components (T012-T014) blocks integration (T015-T017)
- Core implementation (T008-T017) before integration (T018-T021)
- Integration complete before polish (T022-T028)

## Parallel Example - Phase 3.2 Tests
```bash
# Launch T004-T007 together (different test files):
Task: "Create manual test scenarios in tests/manual/date-filter-basic.md for basic date selection functionality"
Task: "Create manual test scenarios in tests/manual/date-filter-persistence.md for localStorage persistence testing"
Task: "Create manual test scenarios in tests/manual/date-filter-integration.md for existing filter integration"
Task: "Create API contract validation test script in tests/contract/test-vulnerabilities-date-filter.js for API testing"
```

## Parallel Example - Phase 3.3 Core Components
```bash
# Launch T008, T009, T012, T013, T014 together (different files):
Task: "Extend Database.getVulnerabilities() method in src/models/database.js to support lastObservedAt filtering"
Task: "Add express-validator middleware for date parameter validation in vulnerability routes"
Task: "Add HTML5 date input element to vulnerabilities filter section in views/vulnerabilities.ejs"
Task: "Implement DateFilter class for client-side state management in public/js/dateFilter.js"
Task: "Add date filter styles and responsive design in public/css/style.css"
```

## Task Details

### Key Files to Modify
- `src/models/database.js` - Add date filtering to getVulnerabilities() and getVulnerabilitiesGroupedByCVE()
- `server.js` - Add lastObservedAt parameter validation and processing
- `views/vulnerabilities.ejs` - Add date picker UI components
- `public/js/vulnerabilities.js` - Extend existing filter logic
- `public/css/style.css` - Add date picker styling

### API Contract Implementation
- Extend existing `/api/vulnerabilities` endpoint with `lastObservedAt` query parameter
- Add validation using express-validator for ISO 8601 date format
- Maintain backward compatibility with existing filter parameters
- Return 400 Bad Request for invalid date formats

### Database Query Extensions
```sql
-- Add to existing WHERE clause in getVulnerabilities()
AND (? IS NULL OR (v.lastObservedAt IS NOT NULL AND v.lastObservedAt <= ?))
```

### Frontend State Management
- Extend existing `filterState` object with `lastObservedAt` property
- Implement persistence using existing localStorage pattern
- Integrate with existing filter clearing mechanisms

## Notes
- [P] tasks = different files, no dependencies
- Manual testing approach using quickstart scenarios (no automated test framework)
- Integration with existing Express.js/EJS/SQLite architecture
- Backward compatibility maintained throughout
- Performance target: <500ms filter response time

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests (T007 covers API contract)
- [x] All entities have model tasks (DateFilter state management in T013, T015, T016)
- [x] All tests come before implementation (T004-T007 before T008+)
- [x] Parallel tasks truly independent (different files marked with [P])
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Integration with existing system components identified
- [x] Performance and accessibility requirements included