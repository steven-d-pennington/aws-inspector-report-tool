# Modules Architecture

This directory contains the modular architecture for the AWS Inspector Report Tool. Each module is self-contained and follows a consistent structure to promote maintainability and scalability.

## Module Structure

Each module follows this standardized structure:

```
src/modules/[module-name]/
├── index.js          # Module entry point and configuration
├── routes.js         # Express routes for the module
├── services/         # Business logic and data processing
│   └── index.js     # Service exports
└── views/           # View helpers and templates
    └── index.js     # View configurations
```

## Available Modules

### aws-inspector
**Purpose**: AWS Inspector vulnerability reporting and management
- Handles vulnerability data processing
- Provides dashboard functionality
- Manages vulnerability reports and analytics
- Integrates with AWS Inspector APIs

**Key Features**:
- Vulnerability dashboard views
- Report generation and export
- Data import/export capabilities
- Real-time vulnerability tracking

### sbom
**Purpose**: Software Bill of Materials (SBOM) analysis and vulnerability correlation
- Parses and analyzes SBOM files
- Correlates components with known vulnerabilities
- Provides component-level security insights
- Generates SBOM-based security reports

**Key Features**:
- SBOM file parsing (SPDX, CycloneDX, SWID)
- Component vulnerability correlation
- Dependency analysis and visualization
- Security risk assessment for software components

## Module Integration

Modules are designed to be:
- **Self-contained**: Each module manages its own routes, services, and views
- **Loosely coupled**: Modules communicate through well-defined interfaces
- **Pluggable**: Modules can be enabled/disabled as needed
- **Testable**: Each module can be tested independently

## Adding New Modules

To add a new module:

1. Create the module directory structure under `src/modules/[module-name]/`
2. Implement the required files:
   - `index.js` - Module configuration and exports
   - `routes.js` - Express routes
   - `services/index.js` - Business logic services
   - `views/index.js` - View configurations
3. Register the module in the main application
4. Add appropriate tests for the module

## Development Guidelines

- Follow the established naming conventions
- Keep modules focused on a single domain
- Use dependency injection for cross-module communication
- Implement proper error handling in each module
- Document module APIs and configurations
- Write unit tests for each module component

## Future Modules

Planned modules for future development:
- **compliance**: Regulatory compliance reporting (SOC 2, PCI DSS, etc.)
- **integrations**: Third-party tool integrations (Jira, Slack, etc.)
- **reporting**: Advanced reporting and analytics
- **user-management**: User authentication and authorization
- **api**: REST API endpoints for external integrations