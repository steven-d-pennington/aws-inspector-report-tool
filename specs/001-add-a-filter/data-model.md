# Data Model: Date Filter Feature

## Core Entities

### DateFilter
**Purpose**: Represents user-selected date filtering criteria for vulnerability queries.

**Fields**:
- `selectedDate: string` - ISO 8601 date string (YYYY-MM-DD format)
- `isActive: boolean` - Whether the date filter is currently applied
- `filterType: 'before' | 'exact'` - Type of date comparison (requirement specifies 'before')

**Validation Rules**:
- `selectedDate` must be valid ISO 8601 date format
- `selectedDate` cannot be in the future (validation warning, but not blocking)
- `filterType` defaults to 'before' per requirements

**State Transitions**:
```
Initial → DateSelected → FilterApplied
Initial → DateCleared → FilterRemoved
FilterApplied → DateChanged → FilterUpdated
FilterApplied → FilterCleared → Initial
```

### Vulnerability (Extended)
**Purpose**: Existing entity extended with date filtering context.

**Relevant Fields for Date Filtering**:
- `lastObservedAt: string | null` - ISO 8601 timestamp when vulnerability was last detected
- `firstObservedAt: string | null` - ISO 8601 timestamp when vulnerability was first detected

**Filtering Behavior**:
- Include vulnerability if `lastObservedAt <= selectedDate`
- Exclude vulnerability if `lastObservedAt` is null when date filter is active
- Sort by `lastObservedAt` DESC within filtered results

### FilterState (Extended)
**Purpose**: Existing filter state object extended with date filtering.

**Extended Fields**:
```javascript
{
  // Existing filter fields
  severity: string | null,
  status: string | null,
  resourceType: string | null,
  platform: string | null,
  fixAvailable: string | null,
  vulnerabilityId: string | null,
  resourceId: string | null,
  search: string | null,

  // New date filter field
  lastObservedAt: string | null  // ISO date string or null
}
```

**Persistence Schema (localStorage)**:
```javascript
{
  "vulnerabilityFilters": {
    "lastObservedAt": "2025-09-17",
    "severity": "HIGH",
    "status": "ACTIVE",
    // ... other filters
  }
}
```

## Database Schema Impact

### No Schema Changes Required
The existing `vulnerabilities` table already contains the necessary `lastObservedAt` field:

```sql
-- Existing field in vulnerabilities table
lastObservedAt DATETIME  -- ISO 8601 string format
```

### Query Modifications
**New filtering logic to be added to existing query builder**:

```sql
-- Base query with date filter extension
SELECT DISTINCT v.*, r.resource_type, r.platform, r.resource_id, r.details, r.tags
FROM vulnerabilities v
LEFT JOIN resources r ON v.id = r.vulnerability_id
WHERE 1=1
  -- Existing filter conditions continue to work
  AND (? IS NULL OR v.severity = ?)
  AND (? IS NULL OR v.status = ?)
  -- New date filter condition
  AND (? IS NULL OR (v.lastObservedAt IS NOT NULL AND v.lastObservedAt <= ?))
ORDER BY v.severity DESC, v.inspector_score DESC
```

### Index Optimization
**Existing index on `lastObservedAt` field supports efficient date filtering**:
- Current index: `idx_vulnerabilities_lastObservedAt`
- Query pattern: Range scan with NULL exclusion
- Performance: O(log n) for date comparison + linear scan for NULL filtering

## API Contract Extensions

### Request Schema Extension
**GET /api/vulnerabilities** - Extended query parameters:

```typescript
interface VulnerabilityFilterRequest {
  // Existing parameters
  severity?: string;
  status?: string;
  resourceType?: string;
  platform?: string;
  fixAvailable?: string;
  vulnerabilityId?: string;
  resourceId?: string;
  search?: string;

  // New date filter parameter
  lastObservedAt?: string;  // ISO 8601 date string (YYYY-MM-DD)
}
```

### Response Schema (No Changes)
**Response format remains unchanged** - existing vulnerability objects returned with same structure.

### Validation Rules
**Server-side validation for new parameter**:

```javascript
const { query } = require('express-validator');

// Validation middleware for date filter
query('lastObservedAt')
  .optional()
  .isISO8601({ strict: false })
  .withMessage('lastObservedAt must be valid ISO 8601 date')
  .custom((value) => {
    const date = new Date(value);
    const today = new Date();
    if (date > today) {
      // Warning but not blocking - allow future dates with warning
      console.warn(`Date filter set to future date: ${value}`);
    }
    return true;
  })
```

## Client-Side State Management

### Filter State Object
**Unified filter state management**:

```javascript
class FilterState {
  constructor() {
    this.filters = {
      severity: null,
      status: null,
      resourceType: null,
      platform: null,
      fixAvailable: null,
      vulnerabilityId: null,
      resourceId: null,
      search: null,
      lastObservedAt: null  // New date filter
    };
  }

  setDateFilter(dateString) {
    this.filters.lastObservedAt = dateString;
    this.persistToStorage();
    this.applyFilters();
  }

  clearDateFilter() {
    this.filters.lastObservedAt = null;
    this.persistToStorage();
    this.applyFilters();
  }

  persistToStorage() {
    localStorage.setItem('vulnerabilityFilters', JSON.stringify(this.filters));
  }

  loadFromStorage() {
    const stored = localStorage.getItem('vulnerabilityFilters');
    if (stored) {
      this.filters = { ...this.filters, ...JSON.parse(stored) };
    }
  }
}
```

### UI Component State
**Date picker component state**:

```javascript
class DateFilterComponent {
  constructor(containerElement) {
    this.container = containerElement;
    this.dateInput = null;
    this.clearButton = null;
    this.presetButtons = [];
    this.onFilterChange = null;  // Callback for filter changes
  }

  render() {
    // Create date picker UI elements
    // Bind event handlers
    // Set initial state from localStorage
  }

  setDate(dateString) {
    if (this.dateInput) {
      this.dateInput.value = dateString;
      this.onFilterChange && this.onFilterChange(dateString);
    }
  }

  clearDate() {
    if (this.dateInput) {
      this.dateInput.value = '';
      this.onFilterChange && this.onFilterChange(null);
    }
  }
}
```

## Error Handling

### Validation Errors
**Client-side validation**:
- Invalid date format: Show user-friendly error message
- Future date selection: Show warning but allow (as per research findings)
- Empty date: Clear filter, no error

**Server-side validation**:
- Invalid date parameter: Return 400 Bad Request with validation details
- Malformed request: Return 400 Bad Request with specific error

### Edge Cases
**Data consistency**:
- Null `lastObservedAt` values: Excluded from results when date filter active
- Empty result sets: Show "No vulnerabilities found" message
- Filter combination conflicts: Show appropriate "No results" state

### Performance Safeguards
**Query optimization**:
- Maximum date range validation (prevent full table scans)
- Query timeout handling (5 second limit)
- Result set limits (existing pagination applies)

## Integration Points

### Existing Filter System
**No breaking changes to existing filter logic**:
- Date filter adds to existing WHERE clause conditions
- Filter clearing mechanisms remain unchanged
- Export functionality automatically includes date filtering

### Export Functions
**PDF and Notion exports automatically respect date filter**:
- Export queries use same filtering logic
- Export headers include date filter information
- Filter state preserved during export operations

### URL State Management
**Optional URL synchronization**:
- Date filter can be reflected in URL hash for bookmarking
- Browser back/forward navigation respects filter state
- Shareable URLs include date filter parameters

---

## Summary

The date filter feature extends the existing data model with minimal changes:
- **No database schema modifications** required
- **Backward compatible** API extensions
- **Unified state management** with existing filters
- **Performance optimized** using existing indexes
- **Constitutional compliance** maintained throughout

All entity relationships and data flows remain consistent with the existing vulnerability dashboard architecture.