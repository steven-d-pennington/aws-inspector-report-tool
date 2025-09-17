# aws-inspector-report-tool Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-09-16

## Active Technologies
- Node.js/Express.js + EJS templating (server-side rendering)
- SQLite3 database with custom wrapper
- Vanilla JavaScript (no React/build tools)
- Modular architecture with Express routers (001-i-want-to)

## Project Structure
```
src/
├── models/          # Database models
├── services/        # Business logic
└── modules/         # Modular features (new)
    ├── aws-inspector/
    └── sbom/
views/              # EJS templates
public/             # Static assets
db/                 # SQLite database
```

## Commands
npm start           # Start server
npm run dev         # Development mode (if configured)

## Code Style
JavaScript: ES6+ syntax, async/await for promises
Express.js: Modular routers, middleware composition
EJS: Server-side rendering with partials
Database: Promise-based wrapper, parameterized queries

## Recent Changes
- 001-i-want-to: Implementing modular architecture with tabbed UI and settings persistence

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
