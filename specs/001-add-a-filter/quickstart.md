# Quickstart: Date Filter Feature Testing

## Overview
This quickstart guide provides step-by-step instructions to validate the date filter functionality on the vulnerabilities page. Follow these scenarios to ensure the feature works as specified.

## Prerequisites
- Vulnerability dashboard is running on http://localhost:3010
- Database contains sample vulnerability data with various `lastObservedAt` dates
- Browser with developer tools access for localStorage verification

## Test Scenarios

### Scenario 1: Basic Date Selection and Filtering

**Objective**: Verify that selecting a date filters vulnerabilities by lastObservedAt

**Steps**:
1. Navigate to http://localhost:3010/vulnerabilities
2. Locate the date filter section (should be added to the existing filter controls)
3. Note the current number of vulnerabilities displayed
4. Select a date from the calendar picker (e.g., 30 days ago)
5. Observe that the vulnerability list updates immediately

**Expected Results**:
- ✅ Date picker is visible and functional
- ✅ Vulnerability list updates without page refresh
- ✅ Only vulnerabilities with `lastObservedAt <= selected_date` are shown
- ✅ Vulnerabilities with null `lastObservedAt` are excluded
- ✅ Vulnerability count updates to reflect filtered results

**Sample Test Data**:
```
Use these dates for testing (replace with actual dates based on your data):
- Select: 2025-09-01 (should show vulnerabilities from Sept 1 and earlier)
- Select: 2025-08-15 (should show fewer vulnerabilities)
- Select: 2025-07-01 (should show even fewer vulnerabilities)
```

### Scenario 2: Filter Persistence Across Sessions

**Objective**: Verify that date filter persists in localStorage and across browser sessions

**Steps**:
1. Select a specific date in the date filter (e.g., 2025-09-10)
2. Verify vulnerabilities are filtered correctly
3. Open browser Developer Tools → Application/Storage → Local Storage
4. Verify `vulnerabilityFilters` contains the selected date
5. Refresh the page (F5)
6. Verify the date filter is still selected and applied
7. Close the browser completely
8. Reopen browser and navigate to vulnerabilities page
9. Verify the date filter is still applied

**Expected Results**:
- ✅ localStorage contains: `{"vulnerabilityFilters": {"lastObservedAt": "2025-09-10", ...}}`
- ✅ Date filter survives page refresh
- ✅ Date filter survives browser restart
- ✅ Filtered results remain consistent

**Verification Commands**:
```javascript
// Check localStorage in browser console
JSON.parse(localStorage.getItem('vulnerabilityFilters'))

// Should return object with lastObservedAt field
```

### Scenario 3: Clear Date Filter

**Objective**: Verify that clearing the date filter removes filtering and shows all vulnerabilities

**Steps**:
1. Apply a date filter (select any date)
2. Note the filtered vulnerability count
3. Click the "Clear Date Filter" button or clear the date input
4. Observe that all vulnerabilities are displayed again

**Expected Results**:
- ✅ Clear button/action removes the date selection
- ✅ All vulnerabilities are displayed (including those with null lastObservedAt)
- ✅ localStorage is updated to remove date filter
- ✅ URL state is updated if applicable

**Verification**:
- Vulnerability count should return to original (pre-filter) number
- localStorage should show `"lastObservedAt": null` or field should be absent

### Scenario 4: Integration with Existing Filters

**Objective**: Verify that date filter works correctly with other existing filters

**Steps**:
1. Apply an existing filter (e.g., Severity = "HIGH")
2. Note the filtered count
3. Add a date filter on top of the severity filter
4. Verify both filters are applied simultaneously
5. Clear the severity filter, leaving only the date filter
6. Verify only date filtering remains active
7. Clear all filters

**Expected Results**:
- ✅ Multiple filters can be active simultaneously
- ✅ Combined filters show intersection of results (AND operation)
- ✅ Clearing individual filters works correctly
- ✅ Filter state is maintained in localStorage for all active filters

**Test Matrix**:
```
Severity: HIGH + Date: 2025-09-01 = Vulnerabilities that are HIGH AND observed before/on 2025-09-01
Status: ACTIVE + Date: 2025-08-15 = Vulnerabilities that are ACTIVE AND observed before/on 2025-08-15
```

### Scenario 5: Edge Cases and Error Handling

**Objective**: Verify proper handling of edge cases and invalid inputs

**Steps**:
1. **Future Date Test**:
   - Select a future date (e.g., tomorrow)
   - Verify all vulnerabilities are shown (no vulnerability can be observed in future)

2. **Invalid Date Test**:
   - Manually enter invalid date in input (if possible)
   - Verify appropriate error handling

3. **Empty Results Test**:
   - Select a very old date (e.g., 2020-01-01)
   - Verify "No vulnerabilities found" message is displayed

4. **Null Data Test**:
   - Ensure vulnerabilities with null `lastObservedAt` are properly excluded when filter is active

**Expected Results**:
- ✅ Future dates don't break the application
- ✅ Invalid inputs are handled gracefully
- ✅ Empty result states are user-friendly
- ✅ Null data is consistently excluded

### Scenario 6: Performance and UX Validation

**Objective**: Verify performance and user experience meets expectations

**Steps**:
1. Load page with large dataset (if available)
2. Apply date filter and measure response time
3. Test filter responsiveness during rapid date changes
4. Verify filter works on mobile/responsive layout
5. Test keyboard navigation and accessibility

**Expected Results**:
- ✅ Filter response time < 500ms for typical datasets
- ✅ UI remains responsive during filtering
- ✅ No visible delays or loading states needed
- ✅ Accessible via keyboard navigation
- ✅ Works on mobile browsers

**Performance Benchmarks**:
```
Dataset Size: < 1000 vulnerabilities → Response time < 200ms
Dataset Size: 1000-5000 vulnerabilities → Response time < 500ms
Dataset Size: > 5000 vulnerabilities → Response time < 1000ms
```

## API Testing (Optional)

### Direct API Endpoint Testing

**Test the API directly using browser dev tools or curl**:

```bash
# Test date filter parameter
curl "http://localhost:3010/api/vulnerabilities?lastObservedAt=2025-09-01"

# Test combined filters
curl "http://localhost:3010/api/vulnerabilities?severity=HIGH&lastObservedAt=2025-09-01"

# Test invalid date
curl "http://localhost:3010/api/vulnerabilities?lastObservedAt=invalid-date"
```

**Expected API Responses**:
- ✅ Valid date: Returns filtered vulnerability array
- ✅ Combined filters: Returns intersection of filters
- ✅ Invalid date: Returns 400 Bad Request with validation error

## Troubleshooting

### Common Issues and Solutions

**Issue**: Date picker not appearing
- **Solution**: Check browser support for HTML5 date input, verify fallback calendar library is loaded

**Issue**: Filter not persisting across sessions
- **Solution**: Check localStorage permissions, verify JSON serialization/deserialization

**Issue**: Slow filter performance
- **Solution**: Check database indexes on `lastObservedAt` field, verify query optimization

**Issue**: Null dates causing issues
- **Solution**: Verify NULL exclusion logic in SQL queries, check frontend null handling

### Debug Commands

```javascript
// Check filter state
console.log(JSON.parse(localStorage.getItem('vulnerabilityFilters')));

// Simulate filter change
document.getElementById('lastObservedFilter').value = '2025-09-01';
document.getElementById('lastObservedFilter').dispatchEvent(new Event('change'));

// Check current URL parameters
console.log(new URLSearchParams(window.location.search));
```

## Success Criteria

**All scenarios pass when**:
- ✅ Date filtering works accurately (only shows vulnerabilities ≤ selected date)
- ✅ Filter persistence works across page refreshes and browser sessions
- ✅ Integration with existing filters functions correctly
- ✅ Clear functionality removes date filter completely
- ✅ Edge cases are handled gracefully
- ✅ Performance meets specified benchmarks (< 500ms response)
- ✅ User experience is intuitive and accessible

## Next Steps

After successful quickstart validation:
1. Run full test suite (when available)
2. Perform cross-browser compatibility testing
3. Validate with production-scale datasets
4. Conduct user acceptance testing with security analysts
5. Monitor performance metrics in production environment

---

**Feature Validation Complete**: Date filter feature is ready for production use when all quickstart scenarios pass successfully.