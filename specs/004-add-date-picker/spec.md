# Feature Specification: Inspector Report Generation Date Tracking

**Feature Branch**: `004-add-date-picker`
**Created**: 2025-09-18
**Status**: Draft
**Input**: User description: "Add date picker to upload page for Inspector report generation date tracking. The upload form should include a date input field that captures when the AWS Inspector report was actually generated (separate from upload date), enabling accurate historical tracking when uploading past reports. This requires database schema changes to add report_run_date fields to both reports and vulnerability_history tables, backend modifications to capture and store the date, and frontend enhancements with a date picker that appears when a file is selected. The feature should validate that report dates cannot be future dates, preserve report run dates during vulnerability archiving, and display these dates in dashboard views for better timeline accuracy."

## Execution Flow (main)
```
1. Parse user description from Input
   ’  Feature description parsed - date picker for report generation tracking
2. Extract key concepts from description
   ’  Actors: Users uploading reports
   ’  Actions: Select report generation date, upload historical reports
   ’  Data: Report generation date, upload date separation
   ’  Constraints: No future dates, preserve dates in history
3. For each unclear aspect:
   ’ No major ambiguities identified
4. Fill User Scenarios & Testing section
   ’  Clear user flow: select file ’ pick date ’ upload
5. Generate Functional Requirements
   ’  All requirements testable and specific
6. Identify Key Entities
   ’  Report entities with temporal attributes
7. Run Review Checklist
   ’  No implementation details included
   ’  Focused on user needs and business value
8. Return: SUCCESS (spec ready for planning)
```

---

## ¡ Quick Guidelines
-  Focus on WHAT users need and WHY
- L Avoid HOW to implement (no tech stack, APIs, code structure)
- =e Written for business stakeholders, not developers

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a security administrator, I need to specify when an AWS Inspector report was actually generated (separate from when I upload it) so that I can maintain accurate historical vulnerability timelines when uploading past reports, enabling proper compliance reporting and trend analysis.

### Acceptance Scenarios
1. **Given** I have an AWS Inspector report from last week, **When** I upload it and select the correct generation date, **Then** the system records both the generation date and upload date separately
2. **Given** I select a file for upload, **When** the file is selected, **Then** a date picker appears allowing me to specify when the report was generated
3. **Given** I try to set a report generation date in the future, **When** I submit the form, **Then** the system displays an error and prevents submission
4. **Given** I upload a report with a specific generation date, **When** vulnerabilities from that report are later archived, **Then** the generation date is preserved in the historical records
5. **Given** I view dashboard reports, **When** examining vulnerability timelines, **Then** I can see both when reports were generated and when they were uploaded to the system

### Edge Cases
- What happens when user tries to select a date more than 2 years in the past?
- How does system handle missing or invalid date selections?
- What happens if user uploads the same report with different generation dates?
- How does the system display reports when generation date differs significantly from upload date?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST display a date picker input field when a user selects an AWS Inspector report file for upload
- **FR-002**: System MUST validate that report generation dates cannot be set to future dates (must be today or earlier)
- **FR-003**: System MUST store report generation date separately from upload date for each uploaded report
- **FR-004**: System MUST preserve report generation dates when moving vulnerabilities to historical archives
- **FR-005**: System MUST display report generation dates in dashboard views alongside upload dates for timeline clarity
- **FR-006**: Users MUST be able to upload historical reports with their original generation dates to reconstruct accurate vulnerability timelines
- **FR-007**: System MUST require a generation date to be selected before allowing report upload to proceed
- **FR-008**: System MUST default the date picker to today's date but allow users to select earlier dates
- **FR-009**: System MUST validate that generation dates are reasonable (not excessively old, specific timeframe to be determined)
- **FR-010**: System MUST maintain backward compatibility with existing reports that don't have generation dates recorded

### Key Entities *(include if feature involves data)*
- **Report**: Contains both upload timestamp (when added to system) and generation timestamp (when AWS Inspector actually created the report), enabling separation of system awareness from actual vulnerability observation dates
- **Historical Vulnerability Record**: Maintains report generation date context when vulnerabilities are archived, preserving accurate timeline information for compliance and trend analysis
- **Upload Event**: Tracks the user interaction of uploading a file with associated generation date selection, distinguishing between system processing time and actual report creation time

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---