# Implementation Plan: Inspector Report Generation Date Tracking

**Branch**: `004-add-date-picker` | **Date**: 2025-09-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-add-date-picker/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ Feature spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✅ Project Type: web (Node.js Express + EJS frontend)
   → ✅ Structure Decision: Existing Express.js structure
3. Fill the Constitution Check section based on constitution document
   → ✅ Constitution loaded and analyzed
4. Evaluate Constitution Check section below
   → ✅ No violations identified
   → ✅ Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → ✅ All technical context clear, no NEEDS CLARIFICATION
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → ✅ All design documents generated
7. Re-evaluate Constitution Check section
   → ✅ No new violations after design
   → ✅ Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Task generation approach described
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Add date picker to upload page for capturing when AWS Inspector reports were actually generated (separate from upload date), enabling accurate historical vulnerability tracking when uploading past reports. Technical approach involves database schema changes to add report_run_date fields, frontend date picker integration, and backend validation to ensure temporal data integrity.

## Technical Context
**Language/Version**: Node.js (JavaScript ES6+)
**Primary Dependencies**: Express.js, EJS templating, SQLite3, multer for file uploads
**Storage**: SQLite3 database with existing vulnerability and history tables
**Testing**: npm test framework (existing)
**Target Platform**: Web application (server-side rendering with EJS)
**Project Type**: web - Express.js backend with EJS frontend
**Performance Goals**: <500ms form submission response, seamless date picker UX
**Constraints**: No future dates allowed, reasonable historical date limits (2+ years max)
**Scale/Scope**: Existing single-user vulnerability dashboard, ~1000s reports annually

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Database schema changes**: ✅ PASS - Additive only, maintains backward compatibility
**Existing data preservation**: ✅ PASS - NULL report_run_date for existing records is acceptable
**Performance impact**: ✅ PASS - Minimal impact, single additional field per report
**Testing requirements**: ✅ PASS - Date validation and edge cases will be tested
**Memory usage**: ✅ PASS - Negligible additional memory for date field
**Migration strategy**: ✅ PASS - ALTER TABLE statements are safe and reversible

## Project Structure

### Documentation (this feature)
```
specs/004-add-date-picker/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Existing Express.js structure
server.js                # Main application file
src/
├── models/
│   └── database.js      # SQLite database layer
├── services/
│   ├── reportService.js
│   └── csvParserService.js
└── utils/
    └── fileTypeDetector.js

views/
├── index.ejs            # Upload page (requires date picker)
├── dashboard.ejs
└── vulnerabilities.ejs

public/
├── js/
│   └── upload.js        # Frontend upload logic (requires modification)
└── css/
    └── style.css        # Styling (requires date picker styles)

tests/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: Existing Express.js structure maintained - no restructuring needed

## Phase 0: Outline & Research

All technical context is clear from existing codebase analysis. No NEEDS CLARIFICATION items require research.

**Key Research Findings**:
- **Date Input Validation**: HTML5 date input with max attribute for future date prevention
- **Database Migration Strategy**: ALTER TABLE with NULL defaults for backward compatibility
- **History Preservation**: Extend archiveCurrentVulnerabilities() to include report_run_date
- **UI/UX Pattern**: Show date picker on file selection, default to today, require before upload

**Output**: research.md with consolidated technical decisions

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

**Entity Changes**:
1. **Report Entity**: Add report_run_date DATETIME field to reports table
2. **Vulnerability History Entity**: Add report_run_date DATETIME field to vulnerability_history table
3. **Upload Event Entity**: Include report_run_date in upload workflow tracking

**API Contracts**:
- POST /upload endpoint modified to accept reportRunDate form field
- File upload validation includes date validation
- Response includes both upload_date and report_run_date

**Contract Tests**:
- Date picker appears when file selected
- Future dates rejected with error message
- Upload succeeds with valid historical date
- History archiving preserves report run date
- Dashboard displays both dates correctly

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Database migration tasks: ALTER TABLE statements for both tables
- Backend validation tasks: Date validation middleware and error handling
- Frontend integration tasks: Date picker HTML, JavaScript, and CSS styling
- History preservation tasks: Update archiving methods to include report_run_date
- Display enhancement tasks: Add date fields to dashboard views
- Testing tasks: Contract tests, integration tests, edge case validation

**Ordering Strategy**:
- Database migration first (foundation)
- Backend validation second (data integrity)
- Frontend integration third (user interface)
- History preservation fourth (archiving workflow)
- Display enhancements fifth (user visibility)
- Testing throughout each phase

**Estimated Output**: 20-25 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No violations requiring justification*

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) - research.md created
- [x] Phase 1: Design complete (/plan command) - data-model.md, contracts/, quickstart.md, CLAUDE.md created
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented

**Generated Artifacts**:
- ✅ research.md - Technical foundation and approach decisions
- ✅ data-model.md - Database schema changes and entity relationships
- ✅ contracts/upload-endpoint.json - API contract for modified upload endpoint
- ✅ contracts/date-picker-component.json - UI component specifications
- ✅ quickstart.md - End-to-end testing scenarios
- ✅ CLAUDE.md - Updated agent context with new technologies

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*