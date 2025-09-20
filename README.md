# AWS Inspector Vulnerability Dashboard

A comprehensive web application for uploading, processing, and analyzing AWS Inspector vulnerability reports.

## Features

- **Upload JSON Reports**: Drag-and-drop or browse to upload AWS Inspector JSON reports
- **Dashboard Summary**: Visual overview of vulnerabilities by severity
- **Advanced Filtering**: Filter vulnerabilities by:
  - Severity (Critical, High, Medium, Low)
  - Status (Active, Suppressed, Closed)
  - Resource Type (EC2 Instance, ECR Container Image)
  - Platform (Windows, Ubuntu, Alpine, etc.)
  - Fix availability
  - Vulnerability ID (CVE)
  - Resource ID
  - Full-text search
- **Export Options**:
  - PDF reports with professional formatting
  - Notion-compatible markdown text
- **Data Management**: PostgreSQL database with connection pooling for reliable persistence

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2 for the containerized stack
- Node.js 18+ (optional, only required for running the app directly on your machine)
- npm (ships with Node.js)

## Quick start (Docker)

1. Copy the example environment file and adjust it to your needs:
   ```bash
   cp .env.example .env
   ```

2. Start the full stack (application + PostgreSQL) using Docker Compose:
   ```bash
   docker compose up --build
   ```

   The first startup will take a little longer because the PostgreSQL container applies the schema from `migrations/postgresql/000-initial-seed.sql`.

3. Open your browser to http://localhost:3010 and begin uploading AWS Inspector reports.

4. To stop the stack, press <kbd>Ctrl</kbd> + <kbd>C</kbd> and then optionally remove containers with:
   ```bash
   docker compose down
   ```

Persistent application uploads/backups and the PostgreSQL data directory are stored in Docker volumes so that data survives restarts.

## Configuration

The application reads its configuration from environment variables. The `.env.example` file documents all supported options and sensible defaults for the bundled PostgreSQL instance. Common settings include:

| Variable | Description | Default |
| --- | --- | --- |
| `DB_HOST` | Database hostname | `db` (Docker) / `localhost` (manual) |
| `DB_PORT` | Database port | `5432` |
| `DB_NAME` | Database name | `vulnerability_reports` |
| `DB_USER` | Database user | `report_gen` |
| `DB_PASSWORD` | Database password | `StarDust` |
| `DB_SSL` | Enable SSL when connecting to a managed PostgreSQL service | `false` |
| `DB_POOL_MAX` | Maximum number of pooled connections | `20` |

To connect to an external database (for example in production), set the `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and `DB_SSL` values in your `.env` file accordingly. When these variables are omitted the application automatically connects to the co-located PostgreSQL container.

The same `.env` file is shared by Docker Compose and the Node.js application so you only have to define credentials once.

## Deploying to the cloud

Build and push the Docker image to your preferred registry:

```bash
docker build -t <your-registry>/aws-inspector-report-tool:latest .
docker push <your-registry>/aws-inspector-report-tool:latest
```

Provision a managed PostgreSQL instance (or reuse an existing one) and configure the required environment variables on your hosting platform (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and optionally `DB_SSL`). When the container starts without those variables it will fall back to the bundled database configuration, making it easy to run the application in single-node environments as well.

## Running locally without Docker

If you prefer running the Node.js app directly on your workstation:

1. Ensure PostgreSQL is running and accessible. Create the database, user, and run the schema from `migrations/postgresql/000-initial-seed.sql`.
2. Copy and adjust the environment file:
   ```bash
   cp .env.example .env
   ```
3. Update the database variables in `.env` to point to your local PostgreSQL instance (for example, set `DB_HOST=localhost`).
4. Install dependencies and start the development server:
   ```bash
   npm install
   npm start
   ```
5. Visit http://localhost:3010 in your browser.

## Usage

### Uploading Reports

1. Go to the Upload page (default landing page)
2. Drag and drop your AWS Inspector JSON report file or click to browse
3. The file will be processed and vulnerabilities stored in the database

### Viewing the Dashboard

- Navigate to the Dashboard page to see:
  - Total vulnerability count
  - Breakdown by severity
  - Number of fixable issues
  - Recent reports
  - Visual charts

### Filtering Vulnerabilities

1. Go to the Vulnerabilities page
2. Use the filter controls at the top to narrow down results
3. Select vulnerabilities using checkboxes for export

### Exporting Data

#### PDF Export
- Select vulnerabilities using checkboxes
- Click "Export to PDF"
- A professionally formatted PDF will download

#### Notion Export
- Select vulnerabilities using checkboxes
- Click "Export for Notion"
- Copy the generated markdown text
- Paste directly into Notion

## Database Schema

The application uses PostgreSQL with the following tables:
- `reports`: Metadata about uploaded reports
- `vulnerabilities`: Core vulnerability information
- `resources`: Affected AWS resources
- `packages`: Vulnerable software packages
- `references`: CVE references and documentation links

## File Structure

```
vulnerability-dashboard/
├── server.js                 # Main Express server
├── package.json             # Dependencies
├── migrations/              # Database migration scripts
├── uploads/                 # Temporary file uploads
├── views/                   # EJS templates
│   ├── index.ejs           # Upload page
│   ├── dashboard.ejs       # Dashboard page
│   └── vulnerabilities.ejs # Vulnerabilities list
├── public/                  # Static assets
│   ├── css/
│   │   └── style.css       # Application styles
│   └── js/
│       ├── upload.js       # Upload functionality
│       └── vulnerabilities.js # Filtering/export logic
└── src/
    ├── models/
    │   └── database.js     # Database operations
    └── services/
        ├── reportService.js # Report processing
        └── exportService.js # PDF/Notion export

```

## Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Frontend**: EJS templates, Vanilla JavaScript
- **PDF Generation**: Puppeteer
- **Markdown**: Marked
- **File Upload**: Multer

## API Endpoints

- `GET /` - Upload page
- `GET /dashboard` - Dashboard view
- `GET /vulnerabilities` - Filtered vulnerability list
- `POST /upload` - Process report upload
- `GET /api/vulnerabilities` - JSON vulnerability data
- `POST /api/export/pdf` - Generate PDF report
- `POST /api/export/notion` - Generate Notion text
- `GET /api/reports` - List all reports
- `DELETE /api/reports/:id` - Delete a report

## Sample Report

The application expects AWS Inspector JSON reports in the format:
```json
{
  "findings": [
    {
      "awsAccountId": "123456789",
      "severity": "HIGH",
      "title": "CVE-2024-12345",
      "description": "...",
      "status": "ACTIVE",
      "fixAvailable": "YES",
      ...
    }
  ]
}
```