# Tasks: Database Migration from SQLite to PostgreSQL

**Input**: Design documents from `/specs/006-database-refactor-sqlite/`
**Prerequisites**: plan.md (✅), research.md (✅), data-model.md (✅), contracts.md (✅), quickstart.md (✅)

## Execution Flow (main)
```
1. Load plan.md from feature directory ✅
   → Extract: Node.js + Express.js + PostgreSQL, pg library
   → Structure: Single project (src/, tests/ at root)
2. Load design documents ✅
   → data-model.md: 9 tables (reports, vulnerabilities, resources, packages, references, settings, vulnerability_history, resource_history, upload_events)
   → contracts.md: Database service interface with PostgreSQL implementations
   → quickstart.md: 8 validation scenarios
3. Generate tasks by category ✅
   → Setup: PostgreSQL dependencies, schema creation
   → Tests: Contract tests, validation scenarios
   → Core: Database service migration, table models
   → Integration: Connection pooling, settings migration
   → Polish: Performance tests, documentation
4. Apply task rules ✅
   → Different files = mark [P] for parallel
   → Schema creation before service migration
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T030) ✅
6. Dependencies validated ✅
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **Tech Stack**: Node.js (JavaScript ES6+) + Express.js + PostgreSQL + pg library
- **Migration**: Selective (settings preserved, vulnerability data fresh start)

## Phase 3.1: Setup and Dependencies
- [ ] T001 Install PostgreSQL dependencies (`pg` library) in package.json
- [ ] T002 [P] Create PostgreSQL schema scripts in `migrations/postgresql/`
- [ ] T003 [P] Update environment configuration for PostgreSQL connection pool
- [ ] T004 [P] Create database backup script for SQLite settings export in `scripts/export-settings.js`

## Phase 3.2: Schema and Infrastructure
- [ ] T005 Create PostgreSQL database schema in `migrations/postgresql/001-create-tables.sql`
- [ ] T006 Create settings data migration script in `migrations/postgresql/002-migrate-settings.sql`
- [ ] T007 [P] Create database connection pool module in `src/config/database-pool.js`
- [ ] T008 [P] Create schema validation script in `scripts/validate-schema.js`

## Phase 3.3: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.4
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T009 [P] Database connection test in `tests/database/test-connection.js`
- [ ] T010 [P] Schema validation test in `tests/database/test-schema.js`
- [ ] T011 [P] Settings migration test in `tests/database/test-settings-migration.js`
- [ ] T012 [P] CRUD operations contract test in `tests/database/test-crud-operations.js`
- [ ] T013 [P] Bulk operations performance test in `tests/performance/test-bulk-operations.js`
- [ ] T014 [P] Connection pool test in `tests/database/test-connection-pool.js`
- [ ] T015 [P] Transaction handling test in `tests/database/test-transactions.js`
- [ ] T016 [P] Constraint validation test in `tests/database/test-constraints.js`

## Phase 3.4: Core Implementation (ONLY after tests are failing)
- [ ] T017 Create PostgreSQL database service base class in `src/models/postgresql-database.js`
- [ ] T018 Implement reports table operations in PostgreSQL service
- [ ] T019 Implement vulnerabilities table operations in PostgreSQL service
- [ ] T020 Implement resources table operations in PostgreSQL service
- [ ] T021 [P] Implement packages table operations in PostgreSQL service
- [ ] T022 [P] Implement references table operations in PostgreSQL service
- [ ] T023 [P] Implement settings table operations in PostgreSQL service
- [ ] T024 Implement vulnerability_history table operations in PostgreSQL service
- [ ] T025 Implement resource_history table operations in PostgreSQL service
- [ ] T026 [P] Implement upload_events table operations in PostgreSQL service

## Phase 3.5: Integration and Migration
- [ ] T027 Execute settings data migration from SQLite to PostgreSQL
- [ ] T028 Update main database service factory in `src/models/database.js` to use PostgreSQL
- [ ] T029 Implement bulk operations with optimized performance
- [ ] T030 Add error handling and connection retry logic
- [ ] T031 [P] Create database health check endpoint in `src/routes/health.js`
- [ ] T032 [P] Add connection pool monitoring in `src/utils/pool-monitor.js`

## Phase 3.6: Validation and Testing
- [ ] T033 [P] Run Scenario 1: Database connection and schema creation (quickstart.md)
- [ ] T034 [P] Run Scenario 2: Basic CRUD operations validation (quickstart.md)
- [ ] T035 [P] Run Scenario 3: Performance improvement validation (quickstart.md)
- [ ] T036 [P] Run Scenario 4: Concurrent user access validation (quickstart.md)
- [ ] T037 [P] Run Scenario 5: Data integrity and constraint validation (quickstart.md)
- [ ] T038 [P] Run Scenario 6: Transaction and rollback validation (quickstart.md)
- [ ] T039 [P] Run Scenario 7: Historical data and archive functions (quickstart.md)
- [ ] T040 [P] Run Scenario 8: Error handling and recovery (quickstart.md)

## Phase 3.7: Performance and Polish
- [ ] T041 [P] Benchmark query performance against SQLite baseline
- [ ] T042 [P] Optimize indexes based on query analysis
- [ ] T043 [P] Create performance monitoring dashboard
- [ ] T044 [P] Update API documentation for PostgreSQL changes
- [ ] T045 Create deployment checklist and rollback procedures
- [ ] T046 [P] Clean up temporary files and unused SQLite dependencies

## Dependencies

### Critical Path
```
T001 → T002,T003,T004 → T005,T006 → T007,T008 → T009-T016 → T017 → T018-T026 → T027-T032 → T033-T040 → T041-T046
```

### Detailed Dependencies
- **Setup**: T001 must complete before T002-T004
- **Schema**: T005,T006 must complete before T007,T008
- **Tests**: T009-T016 must complete and FAIL before T017-T026
- **Service Migration**: T017 blocks T018-T026 (PostgreSQL service implementation)
- **Core Tables**: T018,T019,T020 (main tables) before T024,T025 (history tables)
- **Integration**: T027-T032 require T018-T026 completion
- **Validation**: T033-T040 require T027-T032 completion
- **Polish**: T041-T046 require all validation scenarios to pass

### Parallel Groups
- **Group 1** (Setup): T002, T003, T004
- **Group 2** (Infrastructure): T007, T008
- **Group 3** (Tests): T009, T010, T011, T012, T013, T014, T015, T016
- **Group 4** (Table Operations): T021, T022, T023, T026
- **Group 5** (Integration): T031, T032
- **Group 6** (Validation): T033, T034, T035, T036, T037, T038, T039, T040
- **Group 7** (Polish): T041, T042, T043, T044, T046

## Parallel Execution Examples

### Setup Phase (After T001)
```
Task: "Create PostgreSQL schema scripts in migrations/postgresql/"
Task: "Update environment configuration for PostgreSQL connection pool"
Task: "Create database backup script for SQLite settings export in scripts/export-settings.js"
```

### Test Development Phase (After T008)
```
Task: "Database connection test in tests/database/test-connection.js"
Task: "Schema validation test in tests/database/test-schema.js"
Task: "Settings migration test in tests/database/test-settings-migration.js"
Task: "CRUD operations contract test in tests/database/test-crud-operations.js"
Task: "Bulk operations performance test in tests/performance/test-bulk-operations.js"
Task: "Connection pool test in tests/database/test-connection-pool.js"
Task: "Transaction handling test in tests/database/test-transactions.js"
Task: "Constraint validation test in tests/database/test-constraints.js"
```

### Table Implementation Phase (After T020)
```
Task: "Implement packages table operations in PostgreSQL service"
Task: "Implement references table operations in PostgreSQL service"
Task: "Implement settings table operations in PostgreSQL service"
Task: "Implement upload_events table operations in PostgreSQL service"
```

### Validation Phase (After T032)
```
Task: "Run Scenario 1: Database connection and schema creation"
Task: "Run Scenario 2: Basic CRUD operations validation"
Task: "Run Scenario 3: Performance improvement validation"
Task: "Run Scenario 4: Concurrent user access validation"
Task: "Run Scenario 5: Data integrity and constraint validation"
Task: "Run Scenario 6: Transaction and rollback validation"
Task: "Run Scenario 7: Historical data and archive functions"
Task: "Run Scenario 8: Error handling and recovery"
```

## Success Criteria
- All 8 validation scenarios pass (T033-T040)
- 50% performance improvement demonstrated (T041)
- Settings data successfully migrated (T027)
- Zero data corruption in testing (T037)
- Connection pool handles 10+ concurrent users (T036)
- All existing functionality preserved (T034)

## Notes
- **[P] tasks**: Different files, no dependencies, can run in parallel
- **Migration Strategy**: Selective (preserve settings, fresh start for vulnerability data)
- **Database**: PostgreSQL `vulnerability_reports` with user `report_gen`
- **Testing**: TDD approach - all tests must fail before implementation
- **Performance Target**: 50% faster processing for datasets >1000 records
- **Rollback**: SQLite database preserved as backup during migration

## File Path Conventions
- **Migrations**: `migrations/postgresql/`
- **Source**: `src/models/`, `src/config/`, `src/routes/`, `src/utils/`
- **Tests**: `tests/database/`, `tests/performance/`
- **Scripts**: `scripts/`
- **Documentation**: `docs/`

## Validation Checklist
*Verified before task execution*

- [x] All database tables have corresponding implementation tasks
- [x] All validation scenarios have test tasks
- [x] All tests come before implementation (T009-T016 before T017-T026)
- [x] Parallel tasks are truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Critical path dependencies clearly defined
- [x] Settings migration explicitly included (T027)
- [x] Performance requirements addressed (T041-T043)