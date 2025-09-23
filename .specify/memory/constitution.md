<!--
Sync Impact Report
Version: 2.1.1 -> 3.0.0
Modified Principles:
- Article I. Library-First -> I. Security-First Vulnerability Handling
- Article III. Test-First (NON-NEGOTIABLE) -> III. Tests Before Delivery (NON-NEGOTIABLE)
- Article IV. Integration Testing -> III. Tests Before Delivery (integration flows made explicit)
- Article V. Observability -> IV. Observability & Incident Readiness
- Article VI. Versioning & Breaking Changes -> V. Deployment Parity & Change Control
- Article VII. Simplicity -> Governance guardrails under V and Governance
Added Sections:
- Platform Guardrails
- Delivery Workflow Expectations
Removed Sections:
- Article II. CLI Interface (superseded by Platform Guardrails and Deployment Parity)
Templates requiring updates:
- ✅ .specify/templates/plan-template.md
- ✅ .specify/templates/spec-template.md
- ✅ .specify/templates/tasks-template.md
- ✅ .claude/commands/plan.md
- ✅ .claude/commands/tasks.md
- ✅ .claude/commands/specify.md
- ✅ CLAUDE.md
Deferred TODOs:
- TODO(RATIFICATION_DATE): Original ratification date not recorded in repository history
-->
# AWS Inspector Vulnerability Dashboard Constitution

## Core Principles

### I. Security-First Vulnerability Handling (NON-NEGOTIABLE)
- Only authenticated, role-scoped users may ingest, view, or export findings; unauthenticated paths are prohibited.
- Vulnerability data MUST remain encrypted in transit (TLS 1.2 or higher) and at rest (PostgreSQL column-level or disk encryption) across all environments.
- Secrets, API keys, and account identifiers are stored exclusively via `.env` templates backed by a secrets manager; never hard-coded or committed.
- Sample data used for tests or demos must be anonymised; no live AWS account IDs, resource ARNs, or CVE metadata from customers.
**Rationale**: The application processes high-sensitivity risk data; any leakage creates immediate exploitation risk for customers and AWS accounts.

### II. Source-of-Truth Integrity
- The AWS Inspector raw payload is the canonical record; every transformation must be traceable and reproducible via commit-reviewed scripts.
- Database changes flow through versioned migrations in `/migrations`; ad-hoc edits to production data are forbidden.
- Reports export MUST cite the originating upload (timestamp, checksum, account scope) to keep analysts anchored to the evidence trail.
- Automated validations compare row counts, severities, and suppression states before and after transforms; divergences block deployment.
**Rationale**: Executives and security teams rely on precise metrics to prioritise remediation; drift erodes trust and compliance posture.

### III. Tests Before Delivery (NON-NEGOTIABLE)
- Contract and integration tests for ingestion, filtering, and export endpoints are written and executed before implementation work begins.
- Each regression fix adds a test covering the vulnerable scenario before code changes merge.
- Test suites run via `npm test` (unit and contract) and Playwright flows for UI regressions; CI must fail fast when any suite breaks.
- Test data mirrors production schemas using sanitised fixtures; breaking schema changes require migration plus test updates in the same pull request.
**Rationale**: Early failing tests are the control that proves risk calculations stay correct as the dashboard evolves.

### IV. Observability & Incident Readiness
- Structured JSON logging captures ingestion outcomes, export attempts, and anomaly alerts with correlation IDs for every request.
- Health and readiness probes surface through `/health` endpoints backed by real dependency checks (database, storage, job queue).
- Metrics for finding counts, processing latency, export success, and sanitisation errors feed into dashboards before release.
- Every release updates runbooks covering backup and restore of the Postgres volume and recovery for failed PDF or Notion exports.
**Rationale**: Without transparent signals, teams cannot triage spikes in vulnerabilities or verify that automation is holding the line.

### V. Deployment Parity & Change Control
- Dockerfiles and compose manifests define the only supported environments; manual configuration drift is a release blocker.
- Environment variables, secrets, and feature flags are declared in `.env.example` with documented defaults before code ships.
- Schema migrations, cron jobs, and background workers are versioned, reversible, and included in release notes with rollback steps.
- Breaking changes to exported formats or APIs require an announced migration path, feature flag rollout, and semantic version bump.
**Rationale**: Parity keeps local, staging, and production behaviour consistent, ensuring findings and exports remain trustworthy.

## Platform Guardrails
- Primary stack: Node.js 18 LTS, Express.js, EJS frontend, PostgreSQL version 14 or higher, Puppeteer for PDF export; deviations require constitution amendment.
- Container baseline: `node:18-alpine` (or stricter) images with trivy scans; compose files must declare resource limits and named volumes.
- Database schema changes land in `/migrations` with idempotent `db:migrate`; destructive migrations must ship with verified backups.
- Frontend assets stay server-rendered (EJS) unless a ratified plan approves migration to a single page application with compensating auth controls.
- External integrations (email, ticketing, SIEM) mandate threat modeling and configuration captured in documentation before enabling.

## Delivery Workflow Expectations
- Follow the Specify workflow: `/specify` generates specs, `/plan` produces design artifacts, `/tasks` sequences implementation; no skipping phases.
- Constitution checks in plans document compliance per principle and justify any temporary deviation in Complexity Tracking.
- Pull requests cite affected principles in their description and attach evidence (tests, logs, migrations) before seeking review.
- Releases validate: migrations applied in staging, exports regenerated, observability dashboards updated, and backup plus restore rehearsed.
- Post-release reviews sample live dashboards against uploaded fixtures to confirm counts, severities, and suppressions are unchanged.

## Governance
- Amendments start with a written RFC that includes constitution deltas, template impacts, migration or rollback plans, and the proposed version bump.
- Reviews require at least one security owner and one engineering owner to attest that principles remain enforceable and tooling updated.
- Semantic versioning applies: MAJOR for principle or section rewrites, MINOR for new enforceable guidance, PATCH for clarifications.
- Compliance spot-checks run quarterly: select a recent release and verify adherence to every principle using logs, tests, and change records.
- Deferred TODOs (for example, the ratification date) must be resolved before the next MINOR release or explicitly waived by governance review.

**Version**: 3.0.0 | **Ratified**: TODO(RATIFICATION_DATE) | **Last Amended**: 2025-09-22

