# AWS Inspector Vulnerability Dashboard Constitution

## Core Principles



## Development Workflow

### Code Organization
- Services handle business logic (reportService.js, exportService.js)
- Database layer abstracted through models/database.js
- Views use EJS templating with consistent styling
- Static assets served from public/ directory

### Testing Standards
- Database operations must be tested with sample data
- File upload/processing tested with malformed inputs
- Export functionality validated with various data sizes
- Error handling tested for edge cases

### Performance Guidelines
- Database queries optimized with proper indexing
- Large datasets processed in batches
- Memory usage monitored during file processing
- Puppeteer PDF generation with resource limits

## Governance

Constitution supersedes all other development practices; Changes require documentation of security impact; Database schema changes must include migration strategy; All features must maintain backward compatibility with existing vulnerability data

**Version**: 1.0.0 | **Ratified**: 2025-09-17 | **Last Amended**: 2025-09-17