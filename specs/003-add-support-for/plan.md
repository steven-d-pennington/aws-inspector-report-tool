# Implementation Plan: Add CSV Format Support for AWS Inspector Reports

**Branch**: `003-add-support-for` | **Date**: 2025-09-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-add-support-for/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ Feature spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✅ Project Type: web (Node.js Express backend with EJS frontend)
   → ✅ Structure Decision: Existing structure maintained
3. Fill the Constitution Check section based on the content of the constitution document.
   → ✅ Constitution loaded and evaluated
4. Evaluate Constitution Check section below
   → ✅ No violations identified - feature maintains existing patterns
   → ✅ Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → ✅ CSV parser research and file format analysis completed
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → ✅ All Phase 1 artifacts generated
7. Re-evaluate Constitution Check section
   → ✅ No new violations - design follows existing service patterns
   → ✅ Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
   → ✅ Task generation strategy documented
9. STOP - Ready for /tasks command
```

## Summary
Add CSV format support for AWS Inspector reports by creating a CSV parser service that transforms CSV data into the same internal JSON structure, enabling automatic file type detection (.json vs .csv) during upload with full backward compatibility for existing JSON uploads.

## Technical Context
**Language/Version**: Node.js (JavaScript ES6+) - existing project
**Primary Dependencies**: Express.js, EJS, SQLite3, multer - existing + csv-parser (new)
**Storage**: SQLite3 database with existing vulnerability schema
**Testing**: npm test (existing test framework)
**Target Platform**: Node.js server environment
**Project Type**: web - Express.js backend with EJS frontend
**Performance Goals**: Handle CSV files up to 100MB (existing file limit)
**Constraints**: Must maintain backward compatibility with existing JSON uploads
**Scale/Scope**: Dual format support for single upload endpoint

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

✅ **Code Organization**: CSV parser will be implemented as a service following existing pattern (reportService.js, exportService.js)
✅ **Database Layer**: Uses existing models/database.js abstraction, no schema changes needed
✅ **Testing Standards**: CSV parser and upload handler will be tested with malformed inputs following existing patterns
✅ **Performance Guidelines**: CSV processing will be memory-efficient, similar to existing file processing
✅ **Backward Compatibility**: All existing JSON upload functionality preserved without changes
✅ **Security Impact**: No new security vectors - same upload validation applies to both formats

## Project Structure

### Documentation (this feature)
```
specs/003-add-support-for/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Existing structure maintained
src/
├── models/             # Existing - no changes needed
├── services/           # Existing - add csvParserService.js
└── ...

server.js               # Existing - modify upload handler
public/                 # Existing - may need frontend file picker updates
uploads/                # Existing - will handle both .json and .csv files
```

**Structure Decision**: Maintain existing Express.js web application structure

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context**: No NEEDS CLARIFICATION items identified
2. **Research CSV parsing libraries**: Evaluate csv-parser, papaparse, and native parsing options
3. **Analyze existing JSON structure**: Map CSV columns to nested JSON objects
4. **Research file type detection**: Best practices for file extension vs content-based detection

**Output**: research.md with CSV parsing approach and library selection

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - File Upload entity (format type, validation status)
   - CSV Column Mapping (CSV field → JSON path mappings)
   - Format Detection rules

2. **Generate API contracts** from functional requirements:
   - Upload endpoint contract (accepts both formats)
   - Error response contracts for format validation
   - Success response contracts (same for both formats)

3. **Generate contract tests** from contracts:
   - CSV upload test scenarios
   - Format detection test cases
   - Error handling test cases

4. **Extract test scenarios** from user stories:
   - JSON upload flow (existing - no regression)
   - CSV upload flow (new functionality)
   - Mixed format scenarios

5. **Update CLAUDE.md incrementally**:
   - Add CSV parser service patterns
   - Document dual format support approach
   - Preserve existing manual additions

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs
- CSV parser service creation tasks
- Upload handler modification tasks
- Test implementation tasks (TDD approach)
- Frontend file picker enhancement tasks

**Ordering Strategy**:
- TDD order: Contract tests first
- CSV parser service implementation
- Upload handler modifications
- Frontend updates
- Integration testing

**Estimated Output**: 15-20 numbered, ordered tasks focusing on service layer and upload flow

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (CSV parser service, upload handler updates)
**Phase 5**: Validation (test both JSON and CSV uploads, verify no regressions)

## Complexity Tracking
*No constitutional violations identified - feature follows existing patterns*

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) ✅
- [x] Phase 1: Design complete (/plan command) ✅
- [x] Phase 2: Task planning complete (/plan command - describe approach only) ✅
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS ✅
- [x] Post-Design Constitution Check: PASS ✅
- [x] All NEEDS CLARIFICATION resolved ✅
- [x] Complexity deviations documented (none required) ✅

**Generated Artifacts**:
- [x] specs/003-add-support-for/research.md ✅
- [x] specs/003-add-support-for/data-model.md ✅
- [x] specs/003-add-support-for/contracts/upload-endpoint.json ✅
- [x] specs/003-add-support-for/contracts/csv-parser-service.json ✅
- [x] specs/003-add-support-for/quickstart.md ✅
- [x] CLAUDE.md updated with new dependencies ✅

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*