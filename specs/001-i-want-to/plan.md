# Implementation Plan: Modular Architecture with Tabbed Interface and Settings

**Branch**: `001-i-want-to` | **Date**: 2025-09-16 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-i-want-to/spec.md`

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
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
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
Refactoring AWS Inspector vulnerability dashboard to support modular architecture with configurable modules, implementing tabbed UI navigation and persistent settings management. Initial modules include AWS Inspector (default/enabled) and SBOM (future/disabled by default).

## Technical Context
**Language/Version**: Node.js with JavaScript ES6+
**Primary Dependencies**: Express.js 4.18, EJS 3.1, SQLite3 5.1
**Storage**: SQLite database for all data persistence
**Testing**: None currently (recommend Jest + Supertest)
**Target Platform**: Web browser (server-side rendered)
**Project Type**: web - traditional MPA with SSR
**Performance Goals**: Instant tab switching (<100ms), settings save <200ms
**Constraints**: Must maintain backward compatibility with existing AWS Inspector functionality
**Scale/Scope**: 2 initial modules, extensible to 10+ modules

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Since the constitution file is a template without specific principles defined:
- [ ] Modularity principle - Each module self-contained
- [ ] Persistence principle - Settings must survive restarts
- [ ] Extensibility principle - Easy to add new modules
- [ ] User preference principle - User choices respected

## Project Structure

### Documentation (this feature)
```
specs/001-i-want-to/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 2: Web application (when "frontend" + "backend" detected)
src/
├── components/
│   ├── TabBar/
│   ├── Settings/
│   └── Modules/
├── services/
│   ├── settings/
│   └── modules/
├── hooks/
├── types/
└── lib/
    └── db/

tests/
├── components/
├── integration/
└── unit/
```

**Structure Decision**: Web application structure with frontend components and backend database services

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - Research React tab component best practices
   - Research SQLite schema for settings storage
   - Research module plugin architecture patterns
   - Clarify: What constitutes "unsaved work" for FR-014
   - Clarify: Should at least one module always remain active

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Module entity (id, name, enabled, displayOrder, isDefault)
   - Settings entity (id, userId, moduleSettings, appSettings)
   - ModuleConfiguration entity (moduleId, config)

2. **Generate API contracts** from functional requirements:
   - GET /api/settings - Retrieve user settings
   - PUT /api/settings - Update user settings
   - GET /api/modules - List available modules
   - PUT /api/modules/:id/toggle - Enable/disable module

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Default module display test
   - Tab switching test
   - Settings persistence test
   - Module enable/disable test

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/powershell/update-agent-context.ps1 -AgentType claude` for your AI assistant
   - Add modular architecture context
   - Update recent changes
   - Keep under 150 lines

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Database migration tasks (settings, module_settings tables) [P]
- Database model updates (add settings methods) [P]
- Module system foundation (loader, registry) [P]
- Settings API endpoints (GET/PUT /api/settings)
- Module API endpoints (GET/PUT /api/modules)
- Settings UI page (EJS template + routes)
- Tab navigation component (EJS partial)
- Client-side tab switching logic
- AWS Inspector module refactoring
- SBOM module stub creation
- Integration of modules with tab system

**Ordering Strategy**:
1. Database layer (migrations, models) - Foundation
2. Module system core - Enable module loading
3. API endpoints - Backend functionality
4. UI components - User interface
5. Module refactoring - Migrate existing code
6. Testing - Validation

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

No violations identified - design follows modular, extensible patterns.

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
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*