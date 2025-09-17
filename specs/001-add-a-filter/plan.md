# Implementation Plan: Date Filter for Vulnerabilities Page

**Branch**: `001-add-a-filter` | **Date**: 2025-09-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-add-a-filter/spec.md`

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
Add calendar date picker to vulnerabilities page allowing users to filter vulnerabilities by lastObservedAt date (equal to or before selected date), with localStorage persistence and integration with existing filter system.

## Technical Context
**Language/Version**: Node.js (JavaScript ES6+)
**Primary Dependencies**: Express.js, EJS, SQLite3, vanilla JavaScript
**Storage**: SQLite database with existing vulnerabilities table
**Testing**: Manual testing with sample vulnerability data
**Target Platform**: Web application (browser + Node.js server)
**Project Type**: web - existing Express.js application with EJS views
**Performance Goals**: Filter response under 500ms for typical dataset sizes
**Constraints**: Must maintain backward compatibility, work with existing filter system
**Scale/Scope**: Existing vulnerability dashboard with filtering capabilities

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Security-First Development**: ✅ No security implications - client-side date filtering with server-side validation
**Database Consistency**: ✅ Existing database schema supports lastObservedAt filtering, no schema changes needed
**Express.js Best Practices**: ✅ Adding filter parameter to existing API endpoints follows current patterns
**Data Processing Standards**: ✅ Date validation and filtering aligns with existing filter processing
**Export & Reporting Quality**: ✅ New filter integrates with existing export functionality

**Constitutional Compliance**: PASS - No violations detected

## Project Structure

### Documentation (this feature)
```
specs/001-add-a-filter/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 2: Web application (existing structure)
├── server.js            # Main Express server
├── public/
│   ├── css/style.css    # Add date picker styles
│   └── js/
│       └── vulnerabilities.js  # Add date filter logic
├── views/
│   └── vulnerabilities.ejs     # Add date picker UI
└── src/
    ├── models/database.js       # Add date filter to queries
    └── services/
```

**Structure Decision**: Web application (Option 2) - existing Express.js app with frontend/backend

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - HTML5 date input vs JavaScript calendar library
   - LocalStorage integration patterns with existing filters
   - Date comparison optimization in SQLite queries

2. **Generate and dispatch research agents**:
   ```
   Task: "Research HTML5 date input vs calendar libraries for vulnerability dashboard"
   Task: "Find best practices for localStorage filter persistence in web apps"
   Task: "Research SQLite date filtering optimization patterns"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with technology decisions documented

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - DateFilter entity with validation rules
   - Integration with existing Vulnerability entity
   - LocalStorage schema for persistence

2. **Generate API contracts** from functional requirements:
   - GET /api/vulnerabilities with lastObservedAt parameter
   - Extend existing filter endpoint patterns
   - Output to `/contracts/vulnerabilities-api.json`

3. **Generate contract tests** from contracts:
   - Test date filter parameter validation
   - Test combined filter scenarios
   - Test null/missing date handling

4. **Extract test scenarios** from user stories:
   - Calendar selection and filtering flow
   - Filter persistence across sessions
   - Integration with existing filters

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/powershell/update-agent-context.ps1 -AgentType claude`
   - Add date filtering patterns to existing context
   - Update with new API endpoints and UI components

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Frontend tasks: Add date picker UI, localStorage integration, filter state management
- Backend tasks: Extend API with date filtering, update database queries
- Integration tasks: Connect frontend date selection to backend filtering
- Testing tasks: Validate date filter functionality and edge cases

**Ordering Strategy**:
- Backend API extension first (database query modifications)
- Frontend UI components (date picker implementation)
- Integration and state management (localStorage, filter coordination)
- Testing and validation

**Estimated Output**: 12-15 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

No constitutional violations detected - implementation follows existing patterns.

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