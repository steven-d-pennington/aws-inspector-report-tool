# Research: Inspector Report Generation Date Tracking

**Feature**: Add date picker for report generation date tracking
**Research Phase**: Phase 0 - Technical Foundation
**Date**: 2025-09-18

## Research Objectives

Investigate technical approaches for implementing date picker functionality in the existing Express.js/EJS vulnerability dashboard to capture when AWS Inspector reports were actually generated (separate from upload date).

## Key Research Areas

### 1. HTML5 Date Input Implementation

**Decision**: Use native HTML5 `<input type="date">` with validation attributes
**Rationale**:
- Native browser support provides consistent UX across platforms
- Built-in date picker UI without additional JavaScript libraries
- Automatic date format handling and validation
- Accessibility features included by default

**Implementation Pattern**:
```html
<input type="date"
       id="reportRunDate"
       name="reportRunDate"
       max="2025-09-18"
       required>
```

**Alternatives Considered**:
- **Flatpickr/Pikaday libraries**: Rejected due to unnecessary complexity for simple date selection
- **Bootstrap Datepicker**: Rejected to avoid additional dependencies
- **Custom date input**: Rejected due to accessibility and UX concerns

### 2. Database Schema Migration Strategy

**Decision**: Use ALTER TABLE with NULL defaults for backward compatibility
**Rationale**:
- Existing reports without generation dates remain functional
- Additive changes only - no data loss risk
- SQLite ALTER TABLE ADD COLUMN is safe and atomic
- Migration is reversible if needed

**Migration Approach**:
```sql
ALTER TABLE reports ADD COLUMN report_run_date DATETIME;
ALTER TABLE vulnerability_history ADD COLUMN report_run_date DATETIME;
```

**Alternatives Considered**:
- **Create new tables**: Rejected due to complexity and foreign key management
- **Migrate all existing data**: Rejected due to inability to determine historical generation dates
- **Version-based schema**: Rejected as overkill for single field addition

### 3. Date Validation Strategy

**Decision**: Multi-layer validation (client-side + server-side + database constraints)
**Rationale**:
- Client-side: Immediate feedback, better UX
- Server-side: Security and data integrity
- Business logic: Reasonable historical limits

**Validation Rules**:
- Must not be future date (max = today)
- Must not be excessively old (min = 2 years ago)
- Required field for new uploads
- Format validation (YYYY-MM-DD)

**Implementation Pattern**:
```javascript
// Client-side
document.getElementById('reportRunDate').max = new Date().toISOString().split('T')[0];

// Server-side
const reportDate = new Date(req.body.reportRunDate);
if (reportDate > new Date()) throw new Error('Future dates not allowed');
```

### 4. History Preservation Strategy

**Decision**: Extend existing archiveCurrentVulnerabilities() method to preserve report_run_date
**Rationale**:
- Maintains temporal context when vulnerabilities are archived
- Enables accurate historical timeline reconstruction
- Consistent with existing archiving workflow

**Implementation Approach**:
- Modify archive INSERT statement to include report_run_date
- Update queries to join with reports table for date context
- Preserve NULL values for legacy data

### 5. User Experience Flow

**Decision**: Progressive disclosure - show date picker after file selection
**Rationale**:
- Reduces cognitive load on initial page load
- Contextual appearance makes purpose clear
- Prevents confusion when no file is selected

**UX Flow**:
1. User selects file → Date picker appears
2. Date defaults to today → User can select earlier date
3. Validation feedback → Upload button enables
4. Success confirmation → Shows both dates

**Alternatives Considered**:
- **Always visible date picker**: Rejected as premature without file context
- **Modal dialog for date**: Rejected as unnecessary interruption
- **Separate page for date selection**: Rejected as poor UX flow

## Technical Dependencies

### Required Libraries
- **None additional**: Leveraging existing Express.js, EJS, and SQLite3 stack
- **HTML5 date input**: Native browser support (97%+ compatibility)

### Browser Compatibility
- **Chrome/Edge**: Full support for `<input type="date">`
- **Firefox**: Full support with native date picker
- **Safari**: Full support on both desktop and mobile
- **Fallback**: Text input with pattern validation for legacy browsers

## Performance Considerations

### Database Impact
- **Storage**: 8 bytes per record (DATETIME field)
- **Indexing**: Optional index on report_run_date for filtering
- **Query Impact**: Minimal - single additional field in SELECT/INSERT

### Frontend Impact
- **Page Load**: No additional JavaScript libraries required
- **Form Submission**: Single additional form field (+20 bytes)
- **Rendering**: Native date picker has no performance impact

## Security Considerations

### Input Validation
- **SQL Injection**: Parameterized queries prevent injection
- **Date Manipulation**: Server-side validation prevents invalid dates
- **Business Logic**: Reasonable date range limits prevent abuse

### Data Integrity
- **Temporal Consistency**: Report run date ≤ upload date enforced
- **Historical Accuracy**: NULL values acceptable for legacy data
- **Audit Trail**: Both dates preserved for compliance tracking

## Integration Points

### Existing Codebase Integration
- **Upload Handler**: Modify server.js POST /upload route
- **Database Layer**: Extend database.js insertReport method
- **Frontend**: Update views/index.ejs and public/js/upload.js
- **History System**: Update archiveCurrentVulnerabilities method

### API Contract Changes
- **Request**: Add reportRunDate field to upload form data
- **Response**: Include both upload_date and report_run_date in responses
- **Validation**: Return date-specific error messages

## Conclusion

The research confirms that implementing date picker functionality for report generation dates is straightforward with the existing technology stack. Using native HTML5 date inputs with multi-layer validation provides optimal user experience while maintaining system integrity. The database schema changes are minimal and backward-compatible, preserving all existing functionality.

**Next Phase**: Proceed to Phase 1 design with confidence in technical approach.