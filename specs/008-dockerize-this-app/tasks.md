# Tasks: Dockerize Application with PostgreSQL

**Input**: Design documents from `/specs/008-dockerize-this-app/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: Node.js 18+, Express.js, PostgreSQL, Jest
   → Structure: Web application with src/ directory
2. Load optional design documents:
   → data-model.md: DockerConfig, DatabaseConfig, VolumeConfig, HealthCheck
   → contracts/: health-check.yaml, container-config.yaml
   → research.md: Docker best practices, multi-stage builds
3. Generate tasks by category:
   → Setup: Docker files, environment templates
   → Tests: contract tests for health/config APIs
   → Core: Dockerfile, compose files, init scripts
   → Integration: health endpoints, config management
   → Polish: documentation, validation tests
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- Project uses existing structure: `src/`, `tests/` at repository root
- Docker files at repository root
- Database scripts in `db/` directory

## Phase 3.1: Setup & Environment
- [ ] T001 Create `.env.example` template with all required environment variables
- [ ] T002 [P] Create `.dockerignore` file to exclude node_modules, .git, tests
- [ ] T003 [P] Create `db/init/` directory for database initialization scripts

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T004 [P] Contract test GET /health endpoint in `tests/contract/health-check.test.js` (already created, verify it fails)
- [ ] T005 [P] Contract test GET /health/ready endpoint in `tests/contract/health-check.test.js` (already created, verify it fails)
- [ ] T006 [P] Contract test GET /health/live endpoint in `tests/contract/health-check.test.js` (already created, verify it fails)
- [ ] T007 [P] Contract test GET /api/config endpoint in `tests/contract/container-config.test.js` (already created, verify it fails)
- [ ] T008 [P] Contract test POST /api/config/validate in `tests/contract/container-config.test.js` (already created, verify it fails)
- [ ] T009 [P] Contract test POST /api/config/reload in `tests/contract/container-config.test.js` (already created, verify it fails)
- [ ] T010 [P] Integration test for container startup in `tests/integration/container-startup.test.js`
- [ ] T011 [P] Integration test for data persistence across restarts in `tests/integration/data-persistence.test.js`
- [ ] T012 [P] Integration test for hot-reload in development in `tests/integration/hot-reload.test.js`

## Phase 3.3: Core Docker Implementation
- [ ] T013 Create multi-stage `Dockerfile` with node:18-alpine base image
- [ ] T014 Create base `docker-compose.yml` with app and postgres services
- [ ] T015 Create `docker-compose.dev.yml` with development overrides and volume mounts
- [ ] T016 Create `docker-compose.prod.yml` with production configurations and resource limits
- [ ] T017 [P] Create database initialization script in `db/init/01-schema.sql`
- [ ] T018 [P] Create database seed script in `db/init/02-seed.sql` for development

## Phase 3.4: Application Endpoints
- [ ] T019 Implement GET /health endpoint in `src/routes/health.js`
- [ ] T020 Implement GET /health/ready endpoint in `src/routes/health.js`
- [ ] T021 Implement GET /health/live endpoint in `src/routes/health.js`
- [ ] T022 Create configuration service in `src/services/configService.js`
- [ ] T023 Implement GET /api/config endpoint in `src/routes/config.js`
- [ ] T024 Implement POST /api/config/validate endpoint in `src/routes/config.js`
- [ ] T025 Implement POST /api/config/reload endpoint in `src/routes/config.js`

## Phase 3.5: Environment & Database Integration
- [ ] T026 Update `src/models/database.js` to use environment variables for connection
- [ ] T027 Create environment configuration loader in `src/config/environment.js`
- [ ] T028 Update `server.js` to register health and config routes
- [ ] T029 Add Docker health check command to application startup
- [ ] T030 Implement graceful shutdown handler for SIGTERM signals

## Phase 3.6: Volume & Persistence
- [ ] T031 Configure named volumes for PostgreSQL data persistence
- [ ] T032 Configure uploads volume for application file storage
- [ ] T033 [P] Create backup script `scripts/backup-postgres.sh`
- [ ] T034 [P] Create restore script `scripts/restore-postgres.sh`

## Phase 3.7: Documentation & Validation
- [ ] T035 Update `README.md` with Docker setup and usage instructions
- [ ] T036 Validate quickstart guide fresh installation test
- [ ] T037 Validate quickstart guide data persistence test
- [ ] T038 Validate quickstart guide hot reload test
- [ ] T039 Validate quickstart guide resource limits test
- [ ] T040 [P] Create `docs/docker-troubleshooting.md` guide
- [ ] T041 Run all contract tests and ensure they pass
- [ ] T042 Run all integration tests in containerized environment
- [ ] T043 Performance test container startup time (<30 seconds)
- [ ] T044 Memory usage test under load (<1GB limit)

## Dependencies
- Environment setup (T001-T003) before everything
- Tests (T004-T012) before implementation (T013-T034)
- Docker files (T013-T016) before endpoints (T019-T025)
- Configuration service (T022) before config endpoints (T023-T025)
- Health endpoints (T019-T021) enable container health checks
- Database updates (T026-T027) before integration tests pass
- All implementation before documentation (T035-T040)
- All implementation before validation (T041-T044)

## Parallel Execution Examples

### Contract Tests (can run together):
```
Task: "Verify contract test GET /health fails in tests/contract/health-check.test.js"
Task: "Verify contract test GET /api/config fails in tests/contract/container-config.test.js"
Task: "Create integration test for container startup in tests/integration/container-startup.test.js"
Task: "Create integration test for data persistence in tests/integration/data-persistence.test.js"
```

### Docker Setup Files (can run together):
```
Task: "Create .dockerignore file to exclude node_modules, .git, tests"
Task: "Create db/init/ directory for database initialization scripts"
Task: "Create database initialization script in db/init/01-schema.sql"
Task: "Create database seed script in db/init/02-seed.sql"
```

### Documentation (can run together):
```
Task: "Create backup script scripts/backup-postgres.sh"
Task: "Create restore script scripts/restore-postgres.sh"
Task: "Create docs/docker-troubleshooting.md guide"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify contract tests fail before implementing endpoints
- Commit after each major phase
- Test container builds after T013-T016
- Validate health checks work before T029
- Ensure volumes persist data before T035

## Task Validation Checklist
- ✅ All contracts have corresponding tests (T004-T009)
- ✅ All configuration entities have implementation (T022-T027)
- ✅ All tests come before implementation
- ✅ Parallel tasks truly independent (different files)
- ✅ Each task specifies exact file path
- ✅ No parallel task modifies same file as another [P] task
- ✅ Quickstart validation tests included (T036-T039)