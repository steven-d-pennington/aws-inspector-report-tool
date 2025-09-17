# Implementation Tasks: Vulnerability History Tracking Feature

**Branch**: `002-history-collection-i` | **Date**: 2025-09-17 | **Spec**: [spec.md](./spec.md)

## Task Overview

Based on the completed plan, research, and data model artifacts, this implementation follows Test-Driven Development (TDD) principles and atomic workflow patterns. Tasks are ordered by dependencies: database schema → services → upload workflow → frontend → integration testing.

**Estimated Tasks**: 25 | **Target Completion**: 2-3 development sessions

---

## Phase 1: Database Foundation (Tasks T001-T005)

### T001: Execute Database Migration
**Priority**: Critical | **Estimated Time**: 15 minutes | **Dependencies**: None

**Description**: Execute the database migration script to create history tracking tables and indexes.

**Acceptance Criteria**:
- [ ] Run `contracts/database-migration.sql` against SQLite database
- [ ] Verify tables created: `vulnerability_history`, `resource_history`, `upload_events`
- [ ] Verify all indexes created successfully
- [ ] Verify foreign key constraints are active
- [ ] Confirm existing data is preserved and unaffected

**Implementation Steps**:
1. Back up current database file
2. Execute migration script via SQLite CLI or database connection
3. Run verification queries to confirm table creation
4. Test foreign key constraint functionality

**Testing**: Run verification queries from migration script

---

### T002: Extend Database Service for History Operations
**Priority**: Critical | **Estimated Time**: 45 minutes | **Dependencies**: T001

**Description**: Extend `src/models/database.js` with new methods for history management and upload event tracking.

**Acceptance Criteria**:
- [ ] Add `archiveVulnerabilities(reportId, transaction)` method
- [ ] Add `getFixedVulnerabilities(filters)` method with pagination
- [ ] Add `getVulnerabilityTimeline(findingArn)` method
- [ ] Add `createUploadEvent(filename)` method
- [ ] Add `updateUploadEvent(uploadId, status, metadata)` method
- [ ] All methods support transaction contexts
- [ ] Error handling for constraint violations

**Implementation Notes**:
- Use prepared statements for all queries
- Implement proper transaction handling
- Add JSDoc documentation for all new methods

**Testing**: Write unit tests for each new database method

---

### T003: Create History Service Layer
**Priority**: Critical | **Estimated Time**: 30 minutes | **Dependencies**: T002

**Description**: Create `src/services/historyService.js` for vulnerability history business logic.

**Acceptance Criteria**:
- [ ] Implement `archiveCurrentVulnerabilities(reportId)` method
- [ ] Implement `findFixedVulnerabilities(filters)` with derivation logic
- [ ] Implement `getVulnerabilityHistory(findingArn)` method
- [ ] Handle vulnerability matching logic (ARN primary, CVE+resource secondary)
- [ ] Calculate derived fields (days_active, fix_was_available)
- [ ] Proper error handling and logging

**Implementation Notes**:
- Use the database service for all data access
- Implement filtering and pagination logic
- Add comprehensive JSDoc documentation

**Testing**: Write unit tests for history service methods

---

### T004: Add Transaction Support to Database Service
**Priority**: High | **Estimated Time**: 20 minutes | **Dependencies**: T002

**Description**: Enhance database service with transaction management for atomic upload operations.

**Acceptance Criteria**:
- [ ] Add `beginTransaction()` method
- [ ] Add `commitTransaction()` method
- [ ] Add `rollbackTransaction()` method
- [ ] Modify existing methods to accept optional transaction parameter
- [ ] Handle nested transaction scenarios
- [ ] Proper error handling for transaction failures

**Implementation Notes**:
- SQLite supports nested transactions via savepoints
- Ensure all operations within upload workflow use same transaction
- Add transaction logging for debugging

**Testing**: Write tests for transaction rollback scenarios

---

### T005: Create Database Migration Test Suite
**Priority**: Medium | **Estimated Time**: 25 minutes | **Dependencies**: T001-T004

**Description**: Create comprehensive tests for database migration and new schema functionality.

**Acceptance Criteria**:
- [ ] Test migration script execution on clean database
- [ ] Test migration script execution on existing database with data
- [ ] Test all new table constraints and validations
- [ ] Test foreign key relationship integrity
- [ ] Test index usage in query plans
- [ ] Test rollback script functionality

**Implementation Notes**:
- Use separate test database for migration testing
- Include performance tests for indexed queries
- Test edge cases for constraint violations

**Testing**: Run against multiple database states

---

## Phase 2: Upload Workflow Enhancement (Tasks T006-T012)

### T006: Create Upload Event Tracking
**Priority**: Critical | **Estimated Time**: 25 minutes | **Dependencies**: T002

**Description**: Implement upload event tracking for workflow state management and error recovery.

**Acceptance Criteria**:
- [ ] Create `UploadEvent` class for state management
- [ ] Track upload lifecycle: STARTED → ARCHIVING → CLEARING → IMPORTING → COMPLETED
- [ ] Handle FAILED state with error details and rollback
- [ ] Log records_archived and records_imported counts
- [ ] Generate unique upload_id for each operation
- [ ] Persist state changes to database

**Implementation Notes**:
- Use UUID for upload_id generation
- Update event status after each workflow step
- Include filename and timestamp metadata

**Testing**: Write tests for all state transitions

---

### T007: Modify Report Service for History Workflow
**Priority**: Critical | **Estimated Time**: 35 minutes | **Dependencies**: T003, T006

**Description**: Modify `src/services/reportService.js` to implement the new upload workflow with history preservation.

**Acceptance Criteria**:
- [ ] Modify `processReport()` to include history archiving
- [ ] Implement atomic workflow: archive → clear → import
- [ ] Add transaction support throughout upload process
- [ ] Handle upload failures with automatic rollback
- [ ] Update progress tracking via upload events
- [ ] Maintain backward compatibility

**Implementation Notes**:
- Wrap entire workflow in database transaction
- Archive current data before clearing tables
- Rollback on any step failure
- Preserve original upload behavior for first report

**Testing**: Write integration tests for upload workflow

---

### T008: Implement Atomic Upload Transaction
**Priority**: Critical | **Estimated Time**: 30 minutes | **Dependencies**: T004, T007

**Description**: Ensure upload workflow executes atomically with proper rollback on failure.

**Acceptance Criteria**:
- [ ] Begin transaction before any data modifications
- [ ] Archive existing vulnerabilities and resources
- [ ] Clear current tables only after successful archiving
- [ ] Import new data with validation
- [ ] Commit transaction only on complete success
- [ ] Rollback and restore state on any failure
- [ ] Log detailed error information

**Implementation Notes**:
- Use database transactions for atomicity
- Validate data before clearing existing tables
- Include comprehensive error handling
- Test rollback scenarios thoroughly

**Testing**: Write tests for transaction rollback and data consistency

---

### T009: Add Upload Progress Tracking
**Priority**: Medium | **Estimated Time**: 20 minutes | **Dependencies**: T006

**Description**: Enhance upload UI with progress tracking and status updates.

**Acceptance Criteria**:
- [ ] Show upload progress during workflow execution
- [ ] Display current step: archiving, clearing, importing
- [ ] Show record counts for archived and imported data
- [ ] Handle upload errors with user-friendly messages
- [ ] Provide upload history view
- [ ] Support upload cancellation where possible

**Implementation Notes**:
- Use WebSocket or polling for real-time updates
- Store progress in upload_events table
- Display progress in existing upload UI

**Testing**: Test progress updates during upload workflow

---

### T010: Create Upload Failure Recovery
**Priority**: High | **Estimated Time**: 25 minutes | **Dependencies**: T008

**Description**: Implement robust failure recovery and system consistency validation.

**Acceptance Criteria**:
- [ ] Detect incomplete upload states on server restart
- [ ] Provide manual recovery options for failed uploads
- [ ] Validate data consistency after recovery
- [ ] Log detailed failure analysis
- [ ] Support retry of failed uploads
- [ ] Cleanup orphaned upload events

**Implementation Notes**:
- Check for incomplete uploads on server startup
- Provide admin interface for manual recovery
- Include data validation and consistency checks

**Testing**: Test recovery from various failure scenarios

---

### T011: Add Upload Event API Endpoints
**Priority**: Low | **Estimated Time**: 15 minutes | **Dependencies**: T006

**Description**: Create API endpoints for upload event monitoring and management.

**Acceptance Criteria**:
- [ ] GET /api/upload-events endpoint for event history
- [ ] GET /api/upload-events/{uploadId} for specific event details
- [ ] Support filtering by status and date range
- [ ] Include pagination for large event lists
- [ ] Proper error handling and validation

**Implementation Notes**:
- Follow existing API patterns in server.js
- Use upload event database methods
- Include proper HTTP status codes

**Testing**: Write API endpoint tests

---

### T012: Write Upload Workflow Integration Tests
**Priority**: Medium | **Estimated Time**: 30 minutes | **Dependencies**: T007-T010

**Description**: Create comprehensive integration tests for the complete upload workflow.

**Acceptance Criteria**:
- [ ] Test successful multi-upload scenario
- [ ] Test upload failure and rollback
- [ ] Test large dataset upload performance
- [ ] Test concurrent upload handling
- [ ] Test data consistency validation
- [ ] Test error recovery scenarios

**Implementation Notes**:
- Use real AWS Inspector JSON test data
- Test with varying dataset sizes
- Include performance benchmarks

**Testing**: Run tests against complete workflow

---

## Phase 3: Fixed Vulnerabilities Feature (Tasks T013-T020)

### T013: Implement Fixed Vulnerabilities API
**Priority**: Critical | **Estimated Time**: 40 minutes | **Dependencies**: T003

**Description**: Create `/api/fixed-vulnerabilities` endpoint following the API contract specification.

**Acceptance Criteria**:
- [ ] Implement GET /api/fixed-vulnerabilities endpoint
- [ ] Support filtering by severity, date range, resource type
- [ ] Include pagination with limit and offset
- [ ] Return fixed vulnerabilities with derived fields
- [ ] Calculate summary statistics (total_fixed, avg_days_active)
- [ ] Validate query parameters and return appropriate errors
- [ ] Follow OpenAPI contract specification

**Implementation Notes**:
- Use historyService for fixed vulnerability logic
- Implement robust parameter validation
- Include performance optimization for large datasets

**Testing**: Write API tests covering all filters and edge cases

---

### T014: Create Fixed Vulnerabilities Report Page
**Priority**: Critical | **Estimated Time**: 35 minutes | **Dependencies**: T013

**Description**: Create `/fixed-vulnerabilities` route and EJS template for the fixed vulnerabilities report.

**Acceptance Criteria**:
- [ ] Create GET /fixed-vulnerabilities route in server.js
- [ ] Create `views/fixed-vulnerabilities.ejs` template
- [ ] Display fixed vulnerabilities in tabular format
- [ ] Include filtering controls (severity, date range, resource type)
- [ ] Show summary statistics and metrics
- [ ] Implement pagination for large result sets
- [ ] Handle empty state gracefully

**Implementation Notes**:
- Follow existing page patterns in the application
- Use consistent styling with other views
- Include responsive design considerations

**Testing**: Test page rendering with various data scenarios

---

### T015: Add Fixed Vulnerabilities Navigation
**Priority**: Medium | **Estimated Time**: 10 minutes | **Dependencies**: T014

**Description**: Add navigation links to access the fixed vulnerabilities report from main application.

**Acceptance Criteria**:
- [ ] Add "Fixed Vulnerabilities" link to main navigation
- [ ] Update header navigation in views/partials/header.ejs
- [ ] Include appropriate navigation highlighting
- [ ] Ensure consistent styling with existing navigation
- [ ] Add breadcrumb navigation if applicable

**Implementation Notes**:
- Follow existing navigation patterns
- Consider adding count badge if performance allows
- Ensure accessibility compliance

**Testing**: Test navigation functionality across all pages

---

### T016: Implement Fixed Vulnerabilities Filtering UI
**Priority**: High | **Estimated Time**: 30 minutes | **Dependencies**: T014

**Description**: Create interactive filtering interface for the fixed vulnerabilities report page.

**Acceptance Criteria**:
- [ ] Add severity filter dropdown
- [ ] Add date range picker for fixed after/before dates
- [ ] Add resource type filter dropdown
- [ ] Implement filter persistence with localStorage
- [ ] Add clear filters functionality
- [ ] Show active filter indicators
- [ ] Implement client-side filter validation

**Implementation Notes**:
- Use HTML5 date inputs with fallback
- Follow existing filter patterns from vulnerabilities page
- Include real-time filter application

**Testing**: Test filtering functionality with various combinations

---

### T017: Add Fixed Vulnerabilities Frontend JavaScript
**Priority**: Medium | **Estimated Time**: 25 minutes | **Dependencies**: T016

**Description**: Create JavaScript functionality for fixed vulnerabilities page interactions.

**Acceptance Criteria**:
- [ ] Create `public/js/fixed-vulnerabilities.js`
- [ ] Implement filter persistence with localStorage
- [ ] Add pagination navigation functionality
- [ ] Implement table sorting capabilities
- [ ] Add export functionality (CSV, JSON)
- [ ] Handle loading states and error conditions
- [ ] Include accessibility features

**Implementation Notes**:
- Follow existing JavaScript patterns
- Use progressive enhancement approach
- Include proper error handling

**Testing**: Test all JavaScript functionality across browsers

---

### T018: Implement Vulnerability History Timeline API
**Priority**: Medium | **Estimated Time**: 25 minutes | **Dependencies**: T003

**Description**: Create `/api/vulnerability-history/{findingArn}` endpoint for individual vulnerability timelines.

**Acceptance Criteria**:
- [ ] Implement GET /api/vulnerability-history/{findingArn} endpoint
- [ ] Return chronological history for specific vulnerability
- [ ] Include current status (ACTIVE or FIXED)
- [ ] Support URL-encoded finding ARN parameters
- [ ] Handle not found scenarios appropriately
- [ ] Include proper error handling and validation

**Implementation Notes**:
- Use historyService.getVulnerabilityHistory method
- Handle URL encoding for ARN parameters
- Follow existing API error patterns

**Testing**: Test with various finding ARN formats

---

### T019: Add Fixed Vulnerabilities Styling
**Priority**: Low | **Estimated Time**: 20 minutes | **Dependencies**: T014

**Description**: Add CSS styling for the fixed vulnerabilities report page and components.

**Acceptance Criteria**:
- [ ] Style fixed vulnerabilities table with consistent design
- [ ] Add styling for filter controls and form elements
- [ ] Include responsive design for mobile devices
- [ ] Style summary statistics display
- [ ] Add loading and empty state styles
- [ ] Ensure accessibility compliance (contrast, focus states)
- [ ] Maintain consistency with existing application design

**Implementation Notes**:
- Extend existing `public/css/style.css`
- Use existing color scheme and typography
- Include hover and active states

**Testing**: Test styling across different browsers and devices

---

### T020: Write Fixed Vulnerabilities Feature Tests
**Priority**: Medium | **Estimated Time**: 35 minutes | **Dependencies**: T013-T019

**Description**: Create comprehensive tests for the fixed vulnerabilities feature.

**Acceptance Criteria**:
- [ ] Write API endpoint tests for all scenarios
- [ ] Write page rendering tests
- [ ] Test filtering and pagination functionality
- [ ] Test error handling and edge cases
- [ ] Write performance tests for large datasets
- [ ] Test accessibility compliance
- [ ] Create integration tests with upload workflow

**Implementation Notes**:
- Use existing test framework and patterns
- Include both unit and integration tests
- Test with realistic data scenarios

**Testing**: Run all tests and ensure coverage

---

## Phase 4: Integration and Validation (Tasks T021-T025)

### T021: Execute Quickstart Test Scenarios
**Priority**: Critical | **Estimated Time**: 45 minutes | **Dependencies**: T020

**Description**: Execute all test scenarios from `quickstart.md` to validate complete feature functionality.

**Acceptance Criteria**:
- [ ] Execute Scenario 1: Initial Report Upload with History Setup
- [ ] Execute Scenario 2: Second Report Upload with History Preservation
- [ ] Execute Scenario 3: Fixed Vulnerabilities Report Filtering
- [ ] Execute Scenario 4: Vulnerability History Timeline
- [ ] Execute Scenario 5: Upload Failure and Rollback
- [ ] Execute Scenario 6: Large Dataset Performance
- [ ] Validate all API endpoints and database queries
- [ ] Confirm all acceptance criteria are met

**Implementation Notes**:
- Follow quickstart.md step-by-step instructions
- Document any deviations or issues found
- Validate performance benchmarks

**Testing**: Complete quickstart validation checklist

---

### T022: Performance Optimization and Benchmarking
**Priority**: Medium | **Estimated Time**: 30 minutes | **Dependencies**: T021

**Description**: Optimize query performance and validate benchmarks for large datasets.

**Acceptance Criteria**:
- [ ] Optimize fixed vulnerabilities comparison queries
- [ ] Verify database index usage with EXPLAIN QUERY PLAN
- [ ] Test performance with 1000+ vulnerability datasets
- [ ] Optimize pagination queries for large result sets
- [ ] Implement query result caching where appropriate
- [ ] Meet performance benchmarks from quickstart.md
- [ ] Add monitoring for slow queries

**Implementation Notes**:
- Use SQLite query analysis tools
- Consider adding query result caching
- Profile memory usage during large operations

**Testing**: Run performance benchmarks and validate results

---

### T023: Add Error Handling and Logging
**Priority**: High | **Estimated Time**: 20 minutes | **Dependencies**: T021

**Description**: Implement comprehensive error handling and logging throughout the feature.

**Acceptance Criteria**:
- [ ] Add structured logging for all upload workflow steps
- [ ] Implement error handling for database constraint violations
- [ ] Add user-friendly error messages for UI components
- [ ] Log performance metrics for monitoring
- [ ] Handle edge cases gracefully
- [ ] Include error recovery guidance in logs

**Implementation Notes**:
- Use existing logging patterns in the application
- Include contextual information in error messages
- Add monitoring hooks for production deployment

**Testing**: Test error handling scenarios

---

### T024: Update Documentation and Comments
**Priority**: Low | **Estimated Time**: 25 minutes | **Dependencies**: T023

**Description**: Update code documentation and add implementation comments for maintainability.

**Acceptance Criteria**:
- [ ] Add JSDoc comments to all new functions and methods
- [ ] Update README with new feature information
- [ ] Document new API endpoints
- [ ] Add inline comments for complex logic
- [ ] Update deployment notes for database migration
- [ ] Include troubleshooting guide for common issues

**Implementation Notes**:
- Follow existing documentation patterns
- Include examples for API usage
- Add migration instructions for production

**Testing**: Review documentation for completeness and accuracy

---

### T025: Final Integration Testing and Cleanup
**Priority**: Medium | **Estimated Time**: 30 minutes | **Dependencies**: T024

**Description**: Perform final integration testing and code cleanup before feature completion.

**Acceptance Criteria**:
- [ ] Run complete test suite for all functionality
- [ ] Test integration with existing vulnerability dashboard features
- [ ] Validate backward compatibility with existing workflows
- [ ] Clean up any temporary code or debug statements
- [ ] Verify no regression in existing functionality
- [ ] Confirm all acceptance criteria are met
- [ ] Prepare feature for production deployment

**Implementation Notes**:
- Run full regression testing
- Check for any unused code or dependencies
- Validate production readiness

**Testing**: Complete integration test suite

---

## Summary

**Total Tasks**: 25
**Critical Tasks**: 8
**High Priority Tasks**: 3
**Medium Priority Tasks**: 10
**Low Priority Tasks**: 4

**Implementation Order**:
1. **Phase 1** (T001-T005): Database foundation and schema migration
2. **Phase 2** (T006-T012): Upload workflow enhancement with atomic transactions
3. **Phase 3** (T013-T020): Fixed vulnerabilities reporting interface
4. **Phase 4** (T021-T025): Integration testing and production readiness

**Key Dependencies**:
- Database migration must complete before service implementation
- Upload workflow changes must be atomic and tested thoroughly
- Fixed vulnerabilities feature depends on history service implementation
- All features must pass quickstart validation scenarios

**Success Criteria**:
- All 25 tasks completed with acceptance criteria met
- Quickstart.md scenarios execute successfully
- Performance benchmarks achieved
- Backward compatibility maintained
- Production-ready code with comprehensive testing

---

*Task list generated on 2025-09-17 based on completed plan, research, and data model artifacts*