# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   - If not found: ERROR "No implementation plan found"
   - Extract: tech stack, libraries, structure, constitutional obligations
2. Load optional design documents:
   - data-model.md: Extract entities -> model or migration tasks
   - contracts/: Each file -> contract test task
   - research.md: Extract decisions -> setup tasks
   - quickstart.md: Extract end-to-end scenarios -> integration tests
3. Generate tasks by category:
   - Setup: project init, dependencies, env configuration
   - Tests: contract, integration, regression
   - Core: parsing, database writes, filtering, exports
   - Observability: logging, metrics, runbooks
   - Deployment parity: migrations, docker, configuration
4. Apply task rules:
   - Different files = mark [P] for parallel
   - Same file = sequential (no [P])
   - Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   - All contracts have tests?
   - All entities have storage tasks?
   - All observability and change-control items covered?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- Application entry point lives in `server.js` with modules under `src/`
- Database migrations reside in `migrations/`
- Frontend templates and assets stay under `views/` and `public/`
- Adjust paths if plan.md selects an alternate structure (frontend/backend split, etc.)

## Phase 3.1: Setup
- [ ] T001 Ensure `.env` aligns with constitution secrets policy and update `.env.example`
- [ ] T002 Install or update Node/Express dependencies defined by the plan (`npm install`)
- [ ] T003 [P] Prepare test database configuration in `config/test.json` or equivalent

## Phase 3.2: Tests First (TDD) — MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T004 [P] Contract test for POST `/upload` ingestion in `tests/contract/upload.post.test.js`
- [ ] T005 [P] Contract test for GET `/api/vulnerabilities` filters in `tests/contract/vulnerabilities.get.test.js`
- [ ] T006 [P] Integration test for PDF export flow in `tests/integration/export_pdf.test.js`
- [ ] T007 [P] Integration test for suppression toggles in `tests/integration/suppressions.test.js`

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [ ] T008 Parse AWS Inspector payload and persist metadata in `src/services/reportService.js`
- [ ] T009 Build filtering logic in `src/services/queryService.js`
- [ ] T010 [P] Implement PDF and Markdown exporters in `src/services/exportService.js`
- [ ] T011 Secure upload controller in `src/controllers/uploadController.js`
- [ ] T012 Apply role-based access checks in `src/middleware/auth.js`
- [ ] T013 Update UI views in `views/dashboard.ejs` for new filters or metrics

## Phase 3.4: Observability & Recovery
- [ ] T014 Structured logging for ingestion/export paths using shared logger utility
- [ ] T015 Metrics emission to StatsD/Prometheus adapter (counts, latency, failures)
- [ ] T016 Document runbook updates in `docs/runbooks/ingestion.md`
- [ ] T017 Verify backup and restore instructions for PostgreSQL volume in `docs/operations/backup.md`

## Phase 3.5: Deployment Parity & Change Control
- [ ] T018 Update migrations in `migrations/` to reflect schema changes and backfill scripts
- [ ] T019 Refresh Dockerfiles and compose manifests with new services/env vars
- [ ] T020 [P] Regenerate sample fixtures in `specs/[###-feature-name]/fixtures/` with anonymised data
- [ ] T021 Update README quickstart and `.specify/templates` references if workflows change
- [ ] T022 Final verification: run `npm test`, build exporters, and capture constitution sign-off in plan.md

## Dependencies
- Tests (T004-T007) before implementation (T008-T013)
- Ingestion (T008) blocks filtering (T009) and exports (T010)
- Auth middleware (T012) blocks controllers (T011) from completion
- Observability tasks depend on core services being in place
- Deployment parity tasks run after migrations and services are finalised

## Parallel Example
```
# Launch T004-T007 together:
Task: "Contract test POST /upload in tests/contract/upload.post.test.js"
Task: "Contract test GET /api/vulnerabilities in tests/contract/vulnerabilities.get.test.js"
Task: "Integration test export flow in tests/integration/export_pdf.test.js"
Task: "Integration test suppression toggles in tests/integration/suppressions.test.js"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing core logic
- Commit after each task
- Keep secrets out of fixtures and committed artefacts

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - Each contract file -> contract test task [P]
   - Each endpoint -> controller/service implementation task

2. **From Data Model**:
   - Each entity -> migration/model task [P]
   - Relationships -> query or service layer tasks

3. **From User Stories**:
   - Each story -> integration test [P]
   - Quickstart scenarios -> verification tasks in Phase 3.5

4. **Constitution Alignment**:
   - Ensure tasks cover security, data integrity, observability, and deployment parity obligations identified in plan.md

5. **Ordering**:
   - Setup -> Tests -> Core -> Observability -> Deployment parity
   - Dependencies block parallel execution

## Validation Checklist
*GATE: Checked by main() before returning*

- [ ] All contracts have corresponding tests
- [ ] All entities have model or migration tasks
- [ ] All tests come before implementation
- [ ] Observability and recovery work captured
- [ ] Deployment parity tasks present (docker, env vars, migrations)
- [ ] Parallel tasks truly independent
- [ ] Each task specifies exact file path
- [ ] No task modifies same file as another [P] task
