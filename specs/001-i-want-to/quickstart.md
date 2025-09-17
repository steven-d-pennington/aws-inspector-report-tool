# Quick Start Guide: Modular Architecture with Settings

## Overview
This guide demonstrates the new modular architecture with tabbed interface and persistent settings management.

## Prerequisites
1. Node.js installed (v14 or higher)
2. SQLite3 database support
3. Application running on local development server

## Feature Verification Steps

### 1. Initial Setup
```bash
# Install dependencies
npm install

# Run database migrations
node scripts/migrate.js

# Start the server
npm start
```

### 2. Verify Default State
**Expected**: Application starts with AWS Inspector module enabled by default

1. Navigate to `http://localhost:3000`
2. Verify AWS Inspector tab is visible and active
3. Verify SBOM tab is NOT visible (disabled by default)
4. Check that existing AWS Inspector functionality works

### 3. Access Settings Screen
**Test**: Settings screen is accessible from main interface

1. Look for Settings icon/link in navigation bar
2. Click to open Settings screen
3. Verify Settings screen displays:
   - Application settings section
   - Modules section with toggle switches
   - AWS Inspector: Enabled (locked as default)
   - SBOM Reports: Disabled (toggleable)

### 4. Enable Additional Module
**Test**: Enable SBOM module and verify tab appears

1. In Settings, toggle SBOM Reports to "Enabled"
2. Click "Save Settings" button
3. Verify success message appears
4. Return to main dashboard
5. Verify SBOM tab now appears in tab bar
6. Click SBOM tab to switch to SBOM module

### 5. Test Tab Switching
**Test**: Smooth switching between module tabs

1. Click AWS Inspector tab
   - Content switches to AWS Inspector dashboard
   - Tab shows as active
2. Click SBOM tab
   - Content switches to SBOM interface
   - Tab shows as active
3. Verify switching is instant (<100ms)

### 6. Test Settings Persistence
**Test**: Settings survive application restart

1. Note current settings (SBOM enabled)
2. Stop the application (Ctrl+C)
3. Restart the application
4. Navigate to dashboard
5. Verify SBOM tab is still visible
6. Open Settings screen
7. Verify SBOM is still marked as enabled

### 7. Test Disable Module
**Test**: Disable non-default module

1. In Settings, toggle SBOM Reports to "Disabled"
2. Save settings
3. Return to dashboard
4. Verify SBOM tab is no longer visible
5. Verify only AWS Inspector tab remains

### 8. Test Default Module Protection
**Test**: Cannot disable default module

1. Open Settings screen
2. Verify AWS Inspector toggle is locked/disabled
3. Verify tooltip explains "Default module cannot be disabled"
4. Confirm at least one module always remains active

### 9. Test Module Reordering (if implemented)
**Test**: Reorder module tabs

1. Enable both modules in Settings
2. Look for drag handles or order controls
3. Change display order
4. Save settings
5. Verify tabs appear in new order

### 10. Test Error Scenarios

**Database Unavailable**:
1. Stop the application
2. Rename database file temporarily
3. Start application
4. Try to save settings
5. Verify appropriate error message
6. Restore database file

**Invalid Settings Data**:
1. Open browser developer tools
2. Navigate to Settings
3. Modify request to send invalid data
4. Verify validation errors displayed
5. Verify settings not corrupted

## API Testing

### Get Settings
```bash
curl http://localhost:3000/api/settings
```
Expected: JSON with current settings

### Get Modules
```bash
curl http://localhost:3000/api/modules
```
Expected: Array of available modules with status

### Toggle Module
```bash
curl -X PUT http://localhost:3000/api/modules/sbom/toggle \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```
Expected: Success response, module enabled

### Update Settings
```bash
curl -X PUT http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{"settings": {"theme": "dark"}}'
```
Expected: Settings updated successfully

## Performance Verification

### Tab Switching Speed
1. Open browser developer tools
2. Go to Performance tab
3. Start recording
4. Click between tabs 10 times
5. Stop recording
6. Verify average switch time <100ms

### Settings Save Speed
1. Open Network tab in developer tools
2. Change settings and save
3. Verify request completes in <200ms

## Troubleshooting

### Tabs Not Appearing
- Check browser console for errors
- Verify modules are enabled in settings
- Check database for module_settings records
- Verify JavaScript is enabled

### Settings Not Persisting
- Check database file permissions
- Verify database migrations completed
- Check server logs for errors
- Ensure cookies are enabled

### Module Not Loading
- Check module exists in modules/ directory
- Verify module exports correct interface
- Check server startup logs
- Validate module configuration

## Success Criteria

✅ **All tests pass when**:
- [ ] Default module (AWS Inspector) always visible
- [ ] Additional modules can be enabled/disabled
- [ ] Tab interface updates dynamically
- [ ] Settings persist across sessions
- [ ] At least one module always remains active
- [ ] Tab switching is instant (<100ms)
- [ ] Settings save quickly (<200ms)
- [ ] Error states handled gracefully
- [ ] Existing functionality unchanged

## Next Steps

After verification:
1. Test with multiple users (if applicable)
2. Test with production data
3. Document any module-specific configuration
4. Plan additional modules
5. Consider adding module marketplace/discovery