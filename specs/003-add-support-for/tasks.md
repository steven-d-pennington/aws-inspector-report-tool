# Tasks: Add CSV Format Support for AWS Inspector Reports

**Input**: Design documents from `/specs/003-add-support-for/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✅ Implementation plan loaded - Node.js Express web app
   → ✅ Tech stack: Express.js, SQLite3, multer + csv-parser (new)
2. Load optional design documents:
   → ✅ data-model.md: CSV parser service, file upload entities
   → ✅ contracts/: upload-endpoint.json, csv-parser-service.json
   → ✅ research.md: csv-parser library selection, transformation logic
3. Generate tasks by category:
   → ✅ Setup: csv-parser dependency, file type detection
   → ✅ Tests: contract tests for both JSON and CSV uploads
   → ✅ Core: CSV parser service, upload handler modifications
   → ✅ Integration: file type detection, error handling
   → ✅ Polish: validation tests, regression tests
4. Apply task rules:
   → ✅ Different files = marked [P] for parallel execution
   → ✅ Same file = sequential (upload handler modifications)
   → ✅ Tests before implementation (TDD approach)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → ✅ Upload endpoint contract has tests
   → ✅ CSV parser service contract has tests
   → ✅ File upload entity has validation
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Existing Express.js structure**: `src/services/`, `server.js`, `tests/` at repository root
- Paths follow existing project structure per plan.md

## Phase 3.1: Setup
- [ ] T001 Install csv-parser dependency and update package.json
- [ ] T002 [P] Add CSV file type support to frontend file picker in public/js/upload.js
- [ ] T003 [P] Configure test framework for CSV parsing validation

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T004 [P] Contract test CSV upload endpoint in tests/contract/test_csv_upload.js
- [ ] T005 [P] Contract test JSON upload regression in tests/contract/test_json_upload_regression.js
- [ ] T006 [P] Contract test unsupported format rejection in tests/contract/test_unsupported_format.js
- [ ] T007 [P] Integration test CSV parser service in tests/integration/test_csv_parser_service.js
- [ ] T008 [P] Integration test CSV to JSON transformation in tests/integration/test_csv_transformation.js
- [ ] T009 [P] Integration test malformed CSV handling in tests/integration/test_malformed_csv.js

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [ ] T010 [P] CSV parser service in src/services/csvParserService.js
- [ ] T011 [P] File format detection utility in src/utils/fileTypeDetector.js
- [ ] T012 [P] CSV validation service in src/services/csvValidationService.js
- [ ] T013 Modify upload handler for dual format support in server.js
- [ ] T014 Add format-specific error handling in server.js
- [ ] T015 Add CSV processing to upload endpoint response in server.js

## Phase 3.4: Integration
- [ ] T016 Connect CSV parser to existing reportService workflow
- [ ] T017 Update upload progress tracking for CSV files
- [ ] T018 Add CSV format logging and monitoring
- [ ] T019 Integrate CSV validation with upload error responses

## Phase 3.5: Polish
- [ ] T020 [P] Unit tests for CSV column mapping in tests/unit/test_csv_mapping.js
- [ ] T021 [P] Unit tests for file type detection in tests/unit/test_file_detection.js
- [ ] T022 [P] Performance tests for large CSV files in tests/performance/test_large_csv.js
- [ ] T023 [P] Regression tests for existing JSON functionality in tests/regression/test_json_compatibility.js
- [ ] T024 [P] Edge case tests for CSV parsing in tests/edge_cases/test_csv_edge_cases.js
- [ ] T025 Validate quickstart.md testing scenarios
- [ ] T026 Update API documentation for dual format support

## Dependencies
- Setup (T001-T003) before tests (T004-T009)
- Tests (T004-T009) before implementation (T010-T015)
- T010 (CSV parser) blocks T007, T008, T016
- T011 (file detection) blocks T013, T014
- T013 (upload handler) blocks T014, T015
- Implementation (T010-T015) before integration (T016-T019)
- Integration before polish (T020-T026)

## Parallel Execution Examples

### Phase 3.2: Contract and Integration Tests
```
# Launch T004-T009 together (all different test files):
Task: "Contract test CSV upload endpoint in tests/contract/test_csv_upload.js"
Task: "Contract test JSON upload regression in tests/contract/test_json_upload_regression.js"
Task: "Contract test unsupported format rejection in tests/contract/test_unsupported_format.js"
Task: "Integration test CSV parser service in tests/integration/test_csv_parser_service.js"
Task: "Integration test CSV to JSON transformation in tests/integration/test_csv_transformation.js"
Task: "Integration test malformed CSV handling in tests/integration/test_malformed_csv.js"
```

### Phase 3.3: Core Services
```
# Launch T010-T012 together (all different service files):
Task: "CSV parser service in src/services/csvParserService.js"
Task: "File format detection utility in src/utils/fileTypeDetector.js"
Task: "CSV validation service in src/services/csvValidationService.js"
```

### Phase 3.5: Unit and Performance Tests
```
# Launch T020-T024 together (all different test files):
Task: "Unit tests for CSV column mapping in tests/unit/test_csv_mapping.js"
Task: "Unit tests for file type detection in tests/unit/test_file_detection.js"
Task: "Performance tests for large CSV files in tests/performance/test_large_csv.js"
Task: "Regression tests for existing JSON functionality in tests/regression/test_json_compatibility.js"
Task: "Edge case tests for CSV parsing in tests/edge_cases/test_csv_edge_cases.js"
```

## Task Details

### T001: Install csv-parser dependency
```bash
npm install csv-parser@^3.0.0
npm test  # Verify no breaking changes
```

### T004: Contract test CSV upload endpoint
Implement test for POST /upload with CSV file according to upload-endpoint.json contract:
- Test successful CSV upload response format
- Verify fileFormat: "csv" in response
- Test error responses for malformed CSV
- Must fail before T010-T015 implementation

### T010: CSV parser service
Create src/services/csvParserService.js implementing csv-parser-service.json contract:
- parseInspectorCSV() method for stream-based parsing
- validateCSVSchema() for column validation
- transformRowToFinding() for CSV-to-JSON conversion
- Error handling for all malformed CSV scenarios

### T013: Modify upload handler for dual format support
Update server.js upload endpoint (lines 97-123):
- Add file extension detection (.json vs .csv)
- Route to appropriate parser based on format
- Maintain existing JSON processing path unchanged
- Add comprehensive error handling for both formats

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- Commit after each task
- Existing JSON upload functionality must remain unchanged
- CSV processing must produce identical database structure as JSON

## Validation Checklist
*GATE: Checked before execution*

- [x] All contracts have corresponding tests (T004-T009)
- [x] CSV parser service has comprehensive tests (T007, T008)
- [x] All tests come before implementation (T004-T009 before T010-T015)
- [x] Parallel tasks truly independent (different files marked [P])
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Upload handler changes are sequential (T013-T015)
- [x] Regression testing included (T005, T023)