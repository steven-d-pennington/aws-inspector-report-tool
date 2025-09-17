# Tasks: Modular Architecture with Tabbed Interface and Settings

**Input**: Design documents from `/specs/001-i-want-to/`
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
- **Current structure**: Express.js app with EJS templates
- **Module structure**: `src/modules/[module-name]/`
- **Database**: `src/models/` for data layer
- **Services**: `src/services/` for business logic
- **Tests**: `tests/` at repository root

## Phase 3.1: Setup & Database Foundation
- [ ] T001 Create database migration script in scripts/migrate.js for settings and module_settings tables
- [ ] T002 Run migration to create settings and module_settings tables with default data
- [ ] T003 [P] Create src/models/settings.js with methods for reading/writing settings
- [ ] T004 [P] Create src/models/moduleSettings.js with methods for managing module configuration
- [ ] T005 Update src/models/database.js to include settings and module_settings table initialization

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### API Contract Tests
- [ ] T006 [P] Contract test GET /api/settings in tests/contract/test_settings_get.js
- [ ] T007 [P] Contract test PUT /api/settings in tests/contract/test_settings_put.js
- [ ] T008 [P] Contract test GET /api/modules in tests/contract/test_modules_get.js
- [ ] T009 [P] Contract test PUT /api/modules/:id/toggle in tests/contract/test_modules_toggle.js
- [ ] T010 [P] Contract test GET /api/modules/:id/config in tests/contract/test_modules_config_get.js
- [ ] T011 [P] Contract test PUT /api/modules/:id/config in tests/contract/test_modules_config_put.js
- [ ] T012 [P] Contract test PUT /api/modules/reorder in tests/contract/test_modules_reorder.js

### Integration Tests
- [ ] T013 [P] Integration test for default module state in tests/integration/test_default_state.js
- [ ] T014 [P] Integration test for tab switching in tests/integration/test_tab_switching.js
- [ ] T015 [P] Integration test for settings persistence in tests/integration/test_settings_persist.js
- [ ] T016 [P] Integration test for module enable/disable in tests/integration/test_module_toggle.js
- [ ] T017 [P] Integration test for minimum module enforcement in tests/integration/test_min_module.js

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Module System Foundation
- [ ] T018 Create src/modules/ directory structure for modular architecture
- [ ] T019 Create src/modules/moduleLoader.js for dynamic module discovery and loading
- [ ] T020 Create src/modules/moduleRegistry.js for runtime module registration
- [ ] T021 Define module interface contract in src/modules/ModuleInterface.js

### Services Layer
- [ ] T022 [P] Create src/services/settingsService.js with business logic for settings management
- [ ] T023 [P] Create src/services/moduleService.js with module enable/disable logic
- [ ] T024 Implement module validation in moduleService (at least one active, default protection)

### API Endpoints Implementation
- [ ] T025 Implement GET /api/settings endpoint in server.js
- [ ] T026 Implement PUT /api/settings endpoint in server.js
- [ ] T027 Implement GET /api/modules endpoint in server.js
- [ ] T028 Implement PUT /api/modules/:id/toggle endpoint in server.js
- [ ] T029 Implement GET /api/modules/:id/config endpoint in server.js
- [ ] T030 Implement PUT /api/modules/:id/config endpoint in server.js
- [ ] T031 Implement PUT /api/modules/reorder endpoint in server.js

## Phase 3.4: UI Implementation

### Settings UI
- [ ] T032 Create views/settings.ejs template for settings management page
- [ ] T033 Create public/js/settings.js for client-side settings interactions
- [ ] T034 Add GET /settings route in server.js to render settings page
- [ ] T035 Style settings page in public/css/style.css with module toggles

### Tab Navigation
- [ ] T036 Create views/partials/tabs.ejs partial for tab navigation bar
- [ ] T037 Update views/dashboard.ejs to include tabs partial
- [ ] T038 Create public/js/tabs.js for client-side tab switching (<100ms)
- [ ] T039 Update public/css/style.css with tab styling and active states

## Phase 3.5: Module Migration

### AWS Inspector Module
- [ ] T040 Create src/modules/aws-inspector/ directory structure
- [ ] T041 Move existing inspector routes to src/modules/aws-inspector/routes.js
- [ ] T042 Move inspector services to src/modules/aws-inspector/services/
- [ ] T043 Create src/modules/aws-inspector/index.js implementing ModuleInterface
- [ ] T044 Update server.js to load AWS Inspector as a module

### SBOM Module Stub
- [ ] T045 [P] Create src/modules/sbom/ directory structure
- [ ] T046 [P] Create src/modules/sbom/index.js with minimal ModuleInterface implementation
- [ ] T047 [P] Create src/modules/sbom/views/index.ejs with "Coming Soon" placeholder
- [ ] T048 [P] Create src/modules/sbom/routes.js with basic route handler

## Phase 3.6: Integration & Middleware

### Module Integration
- [ ] T049 Update server.js to dynamically load enabled modules on startup
- [ ] T050 Implement module route mounting based on enabled state
- [ ] T051 Create middleware for module access control
- [ ] T052 Add module context to request object for view rendering

### Performance & Error Handling
- [ ] T053 Add caching layer for settings (60 second TTL)
- [ ] T054 Implement rate limiting for settings API (10 req/min)
- [ ] T055 Add error handling for database unavailable scenarios
- [ ] T056 Add validation middleware for settings API requests

## Phase 3.7: Polish & Documentation

### Testing & Performance
- [ ] T057 [P] Unit tests for settingsService in tests/unit/test_settings_service.js
- [ ] T058 [P] Unit tests for moduleService in tests/unit/test_module_service.js
- [ ] T059 Performance test tab switching (<100ms) in tests/performance/test_tab_speed.js
- [ ] T060 Performance test settings save (<200ms) in tests/performance/test_settings_speed.js

### Documentation
- [ ] T061 [P] Create src/modules/README.md documenting module interface
- [ ] T062 [P] Update main README.md with modular architecture description
- [ ] T063 [P] Create MIGRATION.md with upgrade instructions
- [ ] T064 Run quickstart.md validation checklist

## Dependencies
- Database setup (T001-T005) must complete first
- All tests (T006-T017) before implementation (T018-T048)
- Module system (T018-T021) before services (T022-T024)
- Services before endpoints (T025-T031)
- Module migration (T040-T044) before integration (T049-T052)
- Everything before polish (T057-T064)

## Parallel Execution Examples

### Launch all contract tests together (T006-T012):
```javascript
// Run these Task agents in parallel:
Task: "Contract test GET /api/settings in tests/contract/test_settings_get.js"
Task: "Contract test PUT /api/settings in tests/contract/test_settings_put.js"
Task: "Contract test GET /api/modules in tests/contract/test_modules_get.js"
Task: "Contract test PUT /api/modules/:id/toggle in tests/contract/test_modules_toggle.js"
Task: "Contract test GET /api/modules/:id/config in tests/contract/test_modules_config_get.js"
Task: "Contract test PUT /api/modules/:id/config in tests/contract/test_modules_config_put.js"
Task: "Contract test PUT /api/modules/reorder in tests/contract/test_modules_reorder.js"
```

### Launch all integration tests together (T013-T017):
```javascript
// Run these Task agents in parallel:
Task: "Integration test for default module state in tests/integration/test_default_state.js"
Task: "Integration test for tab switching in tests/integration/test_tab_switching.js"
Task: "Integration test for settings persistence in tests/integration/test_settings_persist.js"
Task: "Integration test for module enable/disable in tests/integration/test_module_toggle.js"
Task: "Integration test for minimum module enforcement in tests/integration/test_min_module.js"
```

### Launch model creation in parallel (T003-T004):
```javascript
// Run these Task agents in parallel:
Task: "Create src/models/settings.js with methods for reading/writing settings"
Task: "Create src/models/moduleSettings.js with methods for managing module configuration"
```

### Launch SBOM module stub in parallel (T045-T048):
```javascript
// Run these Task agents in parallel:
Task: "Create src/modules/sbom/ directory structure"
Task: "Create src/modules/sbom/index.js with minimal ModuleInterface implementation"
Task: "Create src/modules/sbom/views/index.ejs with Coming Soon placeholder"
Task: "Create src/modules/sbom/routes.js with basic route handler"
```

## Notes
- [P] tasks work on different files with no dependencies
- All tests must fail first (TDD approach)
- Commit after each task completion
- API endpoints in server.js are sequential (same file)
- Module tasks can be parallel (different directories)
- Performance targets: <100ms tab switch, <200ms settings save

## Validation Checklist
*GATE: Checked before execution*

- [x] All 5 API endpoints have contract tests (7 test files)
- [x] Both entities (settings, module_settings) have model tasks
- [x] All tests come before implementation (T006-T017 before T018+)
- [x] Parallel tasks work on different files
- [x] Each task specifies exact file path
- [x] No parallel tasks modify the same file
- [x] Integration scenarios from quickstart.md covered
- [x] Performance requirements have test tasks

## Estimated Completion
- **Total Tasks**: 64
- **Parallel Groups**: 6 (can reduce time by ~40%)
- **Critical Path**: Setup → Tests → Module System → Services → Endpoints → UI → Migration
- **Estimated Time**: 8-10 hours with parallel execution