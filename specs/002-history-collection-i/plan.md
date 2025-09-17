# Implementation Plan: Vulnerability History Tracking and Fixed Status Reporting

**Branch**: `002-history-collection-i` | **Date**: 2025-09-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-history-collection-i/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, or `QWEN.md` for Qwen Code).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Create vulnerability history tracking system that preserves vulnerability data across report uploads, provides historical comparison logic to identify "fixed" vulnerabilities, and implements a new report page showing vulnerabilities that existed in previous uploads but are absent from current data.

## Technical Context
**Language/Version**: Node.js (JavaScript ES6+)
**Primary Dependencies**: Express.js, EJS, SQLite3, existing vulnerability dashboard architecture
**Storage**: SQLite database with new history table, extending existing schema
**Testing**: Manual testing with sample vulnerability data across multiple uploads
**Target Platform**: Web application (browser + Node.js server)
**Project Type**: web - extending existing Express.js application with EJS views
**Performance Goals**: Efficient history comparison for large datasets, fast fixed vulnerability report generation
**Constraints**: Must maintain backward compatibility, atomic upload operations with rollback capability
**Scale/Scope**: Handle vulnerability datasets of 1000+ items with historical comparison across multiple time periods

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Code Organization**: ✅ New historyService.js for business logic, extend database.js model layer, add new EJS view
**Database Operations**: ✅ Requires new history table schema with proper indexing for comparison queries
**Testing Standards**: ✅ Must test upload workflow with rollback scenarios and edge cases
**Performance Guidelines**: ✅ History comparison queries need optimization, batch processing for large datasets
**Backward Compatibility**: ✅ Existing vulnerability data structure preserved, additive changes only
**Migration Strategy**: ✅ Required for new history table schema

**Constitutional Compliance**: PASS - Aligns with all principles, requires migration planning

## Project Structure

### Documentation (this feature)
```
specs/002-history-collection-i/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Web application (existing structure extended)
├── server.js            # Add history endpoints and upload workflow
├── views/
│   └── fixed-vulnerabilities.ejs  # New view for fixed vulnerabilities report
├── public/
│   ├── css/style.css    # Extend styles for new report page
│   └── js/
│       └── fixed-vulnerabilities.js  # Frontend logic for new page
└── src/
    ├── models/database.js           # Extend with history table and comparison methods
    └── services/
        ├── reportService.js         # Modify upload workflow for history preservation
        └── historyService.js        # New service for history management and comparison
```

**Structure Decision**: Web application (extending existing Express.js app with additional functionality)

## Phase 0: Outline & Research
1. **Resolve NEEDS CLARIFICATION items from spec**:
   - Define which vulnerability attributes to preserve in history
   - Establish vulnerability matching logic for comparison
   - Specify timestamp semantics and rollback requirements
   - Design fixed vulnerabilities report display format

2. **Research technical decisions**:
   - Database schema design for history table with optimal indexes
   - Atomic transaction patterns for upload workflow
   - Vulnerability comparison algorithms for performance
   - Error handling and rollback strategies

3. **Consolidate findings** in `research.md` with decisions and rationale

**Output**: research.md with all NEEDS CLARIFICATION resolved and technical approach defined

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - History table schema with vulnerability data preservation
   - Upload workflow state transitions
   - Fixed vulnerability derived entity structure
   - Database indexes for efficient comparison queries

2. **Generate API contracts** from functional requirements:
   - POST /upload endpoint modifications for history workflow
   - GET /fixed-vulnerabilities endpoint for new report page
   - GET /api/fixed-vulnerabilities for data retrieval
   - Database schema migration contracts

3. **Generate testing scenarios** from user stories:
   - Multi-upload workflow testing
   - History preservation validation
   - Fixed vulnerability identification accuracy
   - Upload failure and rollback scenarios

4. **Update agent context** with new history management patterns

**Output**: data-model.md, /contracts/*, quickstart.md, CLAUDE.md updates

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Database migration tasks for history table creation
- Service layer extensions for history management
- Upload workflow modifications with transaction handling
- New fixed vulnerabilities page and API development
- Testing tasks for multi-upload scenarios

**Ordering Strategy**:
- Database schema changes first (migration)
- Service layer history management
- Upload workflow modifications
- Frontend components for new report page
- Integration testing and validation

**Estimated Output**: 18-22 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

No constitutional violations detected - implementation extends existing patterns appropriately.

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*