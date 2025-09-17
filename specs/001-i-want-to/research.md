# Phase 0: Research Findings

**Date**: 2025-09-16
**Feature**: Modular Architecture with Tabbed Interface and Settings

## Executive Summary

Research reveals the application is a traditional Express.js/EJS server-side application, not a React SPA. This significantly changes the implementation approach but presents opportunities for a cleaner modular architecture.

## Technology Stack Analysis

### Current Architecture
- **Backend**: Express.js with EJS templating (server-side rendering)
- **Database**: SQLite3 with custom wrapper class
- **Frontend**: Vanilla JavaScript with DOM manipulation
- **No Build Tools**: Direct serving of static assets
- **No Testing Framework**: Currently untested

### Decision: Implementation Approach
**Choice**: Progressive enhancement with server-side modules and client-side tab switching

**Rationale**:
- Maintains current SSR architecture
- Minimal disruption to existing codebase
- Better performance than full SPA conversion
- Easier to implement incrementally

**Alternatives Considered**:
- Full React SPA conversion: Too disruptive, requires complete rewrite
- Next.js migration: Overkill for current needs
- Pure client-side tabs: Loses SSR benefits

## Module Architecture Pattern Research

### Decision: Plugin-Based Module System
**Choice**: Express router-based modules with dedicated folders

**Rationale**:
- Express routers are designed for modular separation
- Each module gets its own routes, views, and services
- Easy to enable/disable via configuration
- Natural fit with Express.js architecture

**Structure**:
```
modules/
├── aws-inspector/
│   ├── routes.js
│   ├── views/
│   ├── services/
│   └── index.js
└── sbom/
    ├── routes.js
    ├── views/
    ├── services/
    └── index.js
```

**Alternatives Considered**:
- Microservices: Too complex for current scale
- NPM packages: Overcomplicated for internal modules
- Single file modules: Insufficient separation

## Tab Navigation Implementation

### Decision: Hybrid Server/Client Approach
**Choice**: Server-rendered tabs with client-side switching for loaded modules

**Rationale**:
- Initial page load includes enabled module tabs
- Client-side JavaScript handles tab switching without reload
- Lazy loading for module content when first accessed
- Maintains SEO and accessibility benefits

**Implementation**:
- Tabs rendered server-side based on enabled modules
- JavaScript enhancement for smooth switching
- AJAX loading for module content on demand

**Alternatives Considered**:
- Full page reload: Poor UX
- Pure client-side: Loses SSR benefits
- iframe-based: Security and styling issues

## Settings Persistence Strategy

### Decision: Dedicated Settings Table
**Choice**: New `settings` and `module_settings` tables in SQLite

**Schema Design**:
```sql
CREATE TABLE settings (
    id INTEGER PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    type TEXT DEFAULT 'string',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE module_settings (
    id INTEGER PRIMARY KEY,
    module_id TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 0,
    display_order INTEGER,
    config JSON,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Rationale**:
- Flexible key-value for general settings
- Dedicated module settings for clarity
- JSON field for module-specific config
- Maintains SQLite simplicity

**Alternatives Considered**:
- JSON file: No ACID guarantees
- Single settings blob: Hard to query
- Separate config file: Splits configuration

## CLARIFICATIONS RESOLVED

### 1. "What constitutes 'unsaved work' in the current application context?"

**Resolution**: In the current Express.js application, there is no client-side state that persists across navigation. Each page is server-rendered.

**Implementation Decision**:
- For the current phase, no unsaved work protection needed
- Future enhancement: Add beforeunload handler if forms are added
- Module switching will save any form data via AJAX before switching

### 2. "Should at least one module always remain active?"

**Resolution**: Yes, at least one module must remain active.

**Implementation Decision**:
- AWS Inspector module cannot be disabled (it's the core functionality)
- UI will prevent disabling the last active module
- Backend validation ensures at least one module enabled
- Default fallback to AWS Inspector if all disabled somehow

**Rationale**:
- Application needs at least one functional area
- Prevents empty/broken state
- AWS Inspector is the primary use case

## Performance Considerations

### Tab Switching Performance
**Target**: <100ms for tab switch
**Strategy**:
- Pre-render tab content in hidden divs
- CSS-based show/hide for instant switching
- Lazy load heavy content on first access

### Settings Save Performance
**Target**: <200ms for settings persistence
**Strategy**:
- Direct SQLite writes (no ORM overhead)
- Debounced saves for rapid changes
- Optimistic UI updates

## Testing Strategy Discovery

### Current State
- No testing framework present
- No test files found
- Manual testing only

### Recommended Approach
**Framework**: Jest + Supertest for backend
**Strategy**:
- Unit tests for database methods
- Integration tests for module loading
- API tests for settings endpoints
- Manual testing for UI interactions

**Rationale**:
- Jest is standard for Node.js
- Supertest works well with Express
- Minimal configuration needed
- Good documentation and community

## Security Considerations

### Module Loading Security
- Validate module names against whitelist
- Sanitize module configuration
- Prevent path traversal in module loading
- Rate limit settings changes

### Settings Security
- Input validation for all settings
- Type checking for setting values
- Audit log for settings changes
- No sensitive data in client-visible settings

## Migration Strategy

### Incremental Implementation
1. **Phase 1**: Add settings infrastructure
2. **Phase 2**: Implement tab UI with existing content
3. **Phase 3**: Refactor existing code into aws-inspector module
4. **Phase 4**: Add SBOM module stub
5. **Phase 5**: Implement module enable/disable

### Backward Compatibility
- All existing routes remain functional
- Database migrations preserve existing data
- Settings default to current behavior
- No breaking changes to URLs

## Module Interface Definition

### Standard Module Contract
Each module must export:
```javascript
module.exports = {
  id: 'module-name',
  name: 'Display Name',
  description: 'Module description',
  defaultEnabled: false,
  router: express.Router(),
  initialize: async (database) => {},
  getTabContent: () => {}
};
```

This ensures consistent module integration and easy addition of future modules.

## Conclusion

The research phase has successfully:
- Identified the true architecture (Express/EJS not React)
- Resolved all NEEDS CLARIFICATION items
- Defined implementation strategies for all components
- Established patterns for modular architecture
- Set performance and security guidelines

The application's simple architecture makes it well-suited for modular refactoring without requiring a complete rewrite. The proposed approach maintains all existing functionality while adding the requested modular capabilities.