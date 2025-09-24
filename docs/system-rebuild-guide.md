# AWS Inspector Vulnerability Dashboard — Rebuild Blueprint

## Purpose
This document gives an AI agent or engineering team the full context needed to recreate the AWS Inspector Vulnerability Dashboard from first principles. It focuses on the product goals, workflows, data expectations, and operational guardrails that must be satisfied, while leaving room for the implementer to select the most appropriate technology stack.

> **Guiding philosophy**: Treat this as a requirements blueprint, not a prescription. Any modern web platform that can satisfy the behaviors below is acceptable.

---

## Product Goals
- Accept bulk uploads of AWS Inspector finding exports (JSON and CSV) without timeouts or data loss.
- Present a responsive dashboard for security analysts to explore current vulnerabilities, filter by multiple dimensions, and export curated subsets.
- Maintain a comprehensive historical trail that highlights what was fixed between uploads and how long remediation took.
- Provide optional administrative tooling for backups, data lifecycle operations, and environment health monitoring.

### Primary Users
| Persona | Needs |
| --- | --- |
| **Security analyst** | Reliable ingestion, powerful filtering, historical insights, export-ready reports. |
| **Engineering lead** | Assurance that ingestion is safe for large datasets, visibility into remediation velocity. |
| **Platform admin** | Operational levers (backups, clears, system metrics) and deployment telemetry. |

---

## Functional Overview
1. **Report Intake**
   - Supports single or multi-file uploads via a browser UI and optional API endpoint.
   - Derives a canonical "report run" timestamp per file (from filename metadata or embedded timestamps) and processes uploads in chronological order to preserve history integrity.
   - Performs format detection (JSON vs CSV) and schema validation. Invalid files fail fast with clear feedback and are not persisted.
   - Ensures duplicate reports are either rejected or flagged, depending on business preference, to avoid skewed analytics.

2. **Ingestion & Normalization**
   - Converts AWS Inspector findings into a normalized relational model. Core entities include report metadata, individual findings, affected resources, vulnerable packages, references, and related tags/attributes.
   - Executes ingestion transactionally so that either the entire upload succeeds or the prior state is retained. Historical snapshots must be captured *before* overwriting the current live tables.
   - Calculates derived metrics during ingest (severity counts, fix availability, first/last seen timestamps) for quick querying.

3. **Historical Tracking**
   - Archives the previous "current" dataset to append-only history tables on each new upload.
   - Identifies findings that disappeared between uploads (interpreted as "fixed") and records when they were first observed, when they disappeared, and how long they were active.
   - Retains enough metadata (finding ARN, CVE, resource identifiers, package/version, AWS account) to support future analytics and auditing.

4. **Dashboards & Explorer**
   - Landing page summarizing recent uploads, trend indicators, and system status.
   - Vulnerability explorer with server-side or API-backed filtering on severity, status, resource type, platform, AWS account, remediation status, date ranges, text search, and optional grouping (e.g., by CVE).
   - Historical views showing fixed vulnerabilities, remediation timelines, and the ability to drill into the lifecycle of a single finding.
   - Exports (PDF, CSV, Markdown/Notion-compatible) for sharing results; allow asynchronous generation for large datasets.

5. **Admin & Maintenance (optional feature flag)**
   - Trigger point-in-time backups and view their status.
   - Clear and reseed data with explicit confirmation safeguards.
   - Access health probes (liveness/readiness), environment info, and ingest telemetry.

---

## Data Design Requirements
### Core Tables / Collections
Recreate equivalents of the following logical structures (table names may differ):
- **Reports**: upload identifier, run timestamp, source filename, AWS account, counts of findings, ingest status, and processing duration.
- **Findings**: normalized current findings with severity, status, remediation info, associated resource, package details, CVE list, and timestamps.
- **Resources**: resource ARN/type/platform/metadata linked to findings.
- **Packages**: vulnerable package name/version/language linked to findings.
- **References**: URLs or remediation references linked to findings.
- **Upload Events**: ingest lifecycle tracking (queued, archiving, clearing, importing, completed/failed) with progress metrics.
- **History Tables**: append-only store containing the previous snapshot of findings/resources/packages for each ingest, including the triggering report ID and archival timestamps.

### Indexing & Performance Expectations
- Enable efficient filtering on severity, status, resource type, AWS account, fix availability, timestamps, and text search across finding titles/descriptions.
- Maintain pagination-friendly queries; default page size ~50 with the ability to adjust.
- Ensure uploads up to ~100 MB per file complete within practical time limits (aim for <5 minutes) without exhausting memory.

### Data Integrity Rules
- Enforce chronological ingest order based on derived report timestamps.
- Prevent partial refreshes: the live dataset should only represent a consistent snapshot.
- Preserve provenance: every historical record should point back to the report/upload that created it.

---

## System Architecture Expectations
While the implementer may choose the stack, the system should roughly align with the following conceptual components:

| Component | Responsibilities | Implementation Notes |
| --- | --- | --- |
| **Presentation layer** | Browser-accessible UI plus REST/GraphQL APIs for automation. | Server-rendered, SPA, or hybrid approaches are all acceptable. Ensure accessibility and responsive layout. |
| **Ingestion pipeline** | Receive uploads, validate formats, orchestrate transactional import, record progress, manage temporary storage. | Can run inline with the web app or as background workers. Use durable storage (filesystem/object store) for staging files. |
| **Data storage** | Structured relational database for normalized data plus history. | PostgreSQL was used previously; any relational store with transaction support and indexing is fine. |
| **Background processing** | Archive management, export generation, scheduled maintenance (backups, retention policies). | Use job queues, cron-like schedulers, or managed task runners. |
| **Telemetry & admin services** | Health endpoints, metrics collection, audit logs, backup orchestration. | Expose endpoints compatible with common orchestrators (Docker, Fly.io, Kubernetes, etc.). |

---

## External Interfaces
- **AWS Inspector exports**: Expect both JSON (native Inspector format) and CSV (spreadsheet exports). Document parsing rules and required fields (finding ARN, severity, title, description, resource ID, remediation guidance, timestamps, status).
- **Exports**: Provide endpoints that return PDF and Markdown/Notion-compatible summaries. Consider streaming large exports or generating them asynchronously.
- **Authentication (if required)**: The original build assumed internal access and relied on environment-protected routing. Include optional hooks for SSO or basic auth if needed.

---

## Deployment & Operations
- **Containerization**: Support container-based deployment (Docker image). Ensure configuration via environment variables for DB credentials, upload limits, feature toggles, and admin access.
- **Horizontal scaling**: Design ingestion and querying with the assumption that multiple application instances may run concurrently. Use advisory locks or work queues to avoid duplicate ingestion.
- **Storage**: Provide persistent volumes for uploads (temporary) and backups. Consider object storage integration for long-term retention.
- **Monitoring**: Implement health endpoints (liveness/readiness) and optional metrics for ingest duration, upload sizes, and export queue depth.
- **Disaster recovery**: Document backup frequency, retention, and restore procedures. Ensure backups capture both schema and data.

---

## User Experience Highlights
- **Upload workspace**: Drag-and-drop plus progress feedback, list of recent uploads, clear messaging on validation results.
- **Dashboard**: Severity breakdown charts, counts of open vs fixed findings, last ingest time, trend indicators.
- **Explorer**: Faceted filters, search-as-you-type (debounced), grouping toggle, column visibility controls, pagination summary.
- **Historical view**: Table of fixed findings with filters (severity, resource type, date ranges, AWS account) and visual timeline per finding.
- **Admin console**: Card-based layout showing system health, backup actions, long-running operation status, and audit logs.

---

## Performance & Reliability Requirements
- Handle multi-file uploads totaling several hundred thousand findings without UI lockups.
- Provide ingestion progress updates (e.g., via polling or websockets).
- Ensure exports remain responsive: large PDFs may be generated asynchronously with downloadable links.
- Implement retry logic or resumable steps for ingestion failures, and surface actionable errors to users.

---

## Security & Compliance Considerations
- Sanitize uploaded filenames and content to avoid injection attacks.
- Store sensitive configuration in secure secrets management; avoid hard-coded credentials.
- Log significant events (ingest success/failure, admin actions) with timestamps and actor identity.
- Optionally integrate with organization SSO or enforce IP allowlists depending on deployment context.

---

## Rebuild Checklist
1. Choose the application stack (language, framework, front-end approach) that best fits the team’s expertise while satisfying the requirements above.
2. Model the database (or equivalent storage) to capture reports, findings, related entities, and historical snapshots.
3. Implement the ingestion workflow with chronological enforcement, transactional safety, and archival of previous data.
4. Build the analyst-facing UI and APIs: upload, dashboard, vulnerability explorer, historical reporting, and exports.
5. Add administrative surfaces for backups, health checks, and data lifecycle operations (feature-flagged if desired).
6. Provide deployment artifacts (container image, environment configuration) and document how to run in Docker, Fly.io, or similar platforms.
7. Validate with representative AWS Inspector datasets, focusing on large-file performance, historical accuracy, and export integrity.

---

## Known Pain Points & Future Enhancements
- CSV parsing can be memory-intensive; consider streaming parsers or chunked processing for very large files.
- Secondary matching for "fixed" findings may produce false positives if CVE overlaps are broad—refine matching logic as needed.
- Backups currently described as on-demand; adding scheduled retention policies and remote storage would improve resilience.
- Consider adding API keys or token-based auth for automation clients.

By following this blueprint, an implementer can reproduce the core experience—efficient ingest, powerful exploration, and rich historical insight—while retaining freedom to choose the architecture best suited to the task.
