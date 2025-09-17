# AWS Inspector Report Tool Constitution

## Core Principles

### I. Modular Architecture
Every major feature must be implemented as a self-contained module with clear boundaries. Modules must be independently loadable, testable, and maintainable. Each module exposes its functionality through a standard interface contract.

### II. Progressive Enhancement
Start with server-side rendering for core functionality, then enhance with client-side JavaScript for improved UX. The application must remain functional without JavaScript. API endpoints support both HTML and JSON responses.

### III. Data Integrity First
All data operations must maintain ACID properties. Database migrations must be reversible. Settings and configurations must validate before persistence. At least one module must always remain active.

### IV. Backward Compatibility
Existing functionality must not break when adding new features. URL routes must remain stable. Database schema changes must preserve existing data. Module additions must not affect existing modules.

### V. Security by Design
Input validation on all user data. Parameterized queries for all database operations. No sensitive data in client-visible settings. Rate limiting on state-changing operations. Audit logging for configuration changes.

## Development Standards

### Testing Requirements
- Unit tests for all database model methods
- Integration tests for API endpoints
- Manual testing checklist for UI changes
- Performance benchmarks for critical paths (<100ms tab switch, <200ms saves)

### Code Organization
- Express routers for route separation
- Service layer for business logic
- Model layer for data access
- Views for presentation only
- Modules follow standard structure: routes, services, views, index

### Documentation Standards
- README for each module
- JSDoc comments for public APIs
- Migration notes for schema changes
- Quickstart guide for new features

## Performance Standards

### Response Time Targets
- Page loads: <500ms
- API responses: <200ms
- Tab switching: <100ms
- Settings save: <200ms
- Database queries: <50ms

### Resource Limits
- SQLite database: <100MB
- Uploaded files: <10MB per file
- Module config: <1KB per module
- Memory usage: <256MB Node.js heap

## Governance

### Change Management
- Constitution amendments require documented rationale
- Breaking changes require migration path
- Module interface changes need compatibility layer
- Performance degradation must be justified

### Review Gates
- Code changes must not violate principles
- New modules must follow standard interface
- Database changes require migration scripts
- Settings additions need validation rules

### Compliance Verification
- All PRs must pass constitution check
- Complexity additions require justification
- Performance targets must be maintained
- Security principles must be upheld

**Version**: 1.0.0 | **Ratified**: 2025-09-16 | **Last Amended**: 2025-09-16