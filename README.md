# AWS Inspector Vulnerability Dashboard

A comprehensive web application for uploading, processing, and analyzing AWS Inspector vulnerability reports. Now available as a fully containerized solution with Docker.

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
- **Containerized Deployment**: Docker and Docker Compose support for easy deployment
- **Health Monitoring**: Built-in health checks and configuration management APIs
- **Data Persistence**: Volume-based storage with backup and restore capabilities

## Quick Start with Docker (Recommended)

### Prerequisites
- Docker Desktop 4.0+ or Docker Engine 20.10+
- Docker Compose v2.0+
- 4GB RAM available for containers
- 10GB disk space for images and data

### 1. Clone and Setup
```bash
git clone <repository-url>
cd aws-inspector-report-tool

# Copy environment template
cp .env.example .env

# Edit .env file with your database password
# For quick start, only DB_PASSWORD is required
```

### 2. Start Application
```bash
# Development mode (with hot-reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production mode
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 3. Access Application
- **Web Interface**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **API Documentation**: http://localhost:3000/api/config

### 4. Verify Installation
```bash
# Check services
docker compose ps

# View logs
docker compose logs -f app

# Test database connection
curl http://localhost:3000/health/ready
```

## Traditional Installation (Without Docker)

1. Navigate to the project directory:
```bash
cd aws-inspector-report-tool
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your database settings
```

4. Start the server:
```bash
npm start
```

5. Open your browser to: http://localhost:3000

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

## Docker Operations

### Development Workflow
```bash
# Start in development mode with hot-reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Make code changes - they'll be reflected immediately
# View logs
docker compose logs -f app

# Run tests in container
docker compose exec app npm test

# Access database
docker compose exec postgres psql -U appuser -d vulnerability_dashboard
```

### Production Deployment
```bash
# Start in production mode
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check status
docker compose ps

# View logs
docker compose logs app

# Scale if needed (app only, not database)
docker compose up -d --scale app=2
```

### Data Management

#### Backup Database
```bash
# Manual backup
docker compose exec postgres pg_dump -U appuser vulnerability_dashboard > backup.sql

# Using backup script
docker compose exec postgres /backups/backup-postgres.sh
```

#### Restore Database
```bash
# Restore from backup
cat backup.sql | docker compose exec -T postgres psql -U appuser vulnerability_dashboard

# Using restore script
docker compose exec postgres /backups/restore-postgres.sh backup_file.sql.gz
```

#### Volume Management
```bash
# List volumes
docker volume ls | grep aws-inspector

# Backup volume data
docker run --rm -v postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_data_backup.tar.gz -C /data .

# Restore volume data
docker run --rm -v postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres_data_backup.tar.gz -C /data
```

### Environment Configuration

#### Development (.env)
```bash
NODE_ENV=development
PORT=3000
DB_PASSWORD=dev_password_123
LOG_LEVEL=debug
ENABLE_HOT_RELOAD=true
```

#### Production (.env)
```bash
NODE_ENV=production
PORT=3000
DB_PASSWORD=secure_production_password
DB_SSL_MODE=require
LOG_LEVEL=warn
ENABLE_HOT_RELOAD=false
```

### Health Monitoring

#### Health Check Endpoints
- **Basic Health**: `GET /health` - Overall application health
- **Readiness**: `GET /health/ready` - Ready to serve traffic
- **Liveness**: `GET /health/live` - Application is alive

#### Configuration API
- **Get Config**: `GET /api/config` - Current configuration (non-sensitive)
- **Validate Config**: `POST /api/config/validate` - Validate configuration
- **Reload Config**: `POST /api/config/reload` - Reload from environment

#### Monitoring Commands
```bash
# Check application health
curl http://localhost:3000/health

# Check container resource usage
docker stats

# Monitor logs in real-time
docker compose logs -f app

# Check database connectivity
docker compose exec app node -e "
  const { Pool } = require('pg');
  const pool = new Pool({
    host: 'postgres',
    user: 'appuser',
    password: process.env.DB_PASSWORD,
    database: 'vulnerability_dashboard'
  });
  pool.query('SELECT 1').then(() => console.log('DB OK')).catch(console.error);
"
```

### Troubleshooting

#### Container Won't Start
```bash
# Check logs
docker compose logs app
docker compose logs postgres

# Verify configuration
docker compose config

# Check port availability
netstat -an | grep 3000
```

#### Database Connection Issues
```bash
# Verify postgres container
docker compose ps postgres

# Test connectivity
docker compose exec app nc -zv postgres 5432

# Check database logs
docker compose logs postgres
```

#### Performance Issues
```bash
# Check resource usage
docker stats

# Adjust memory limits in docker-compose.yml
# Restart containers
docker compose restart
```

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