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

## Installation

1. Navigate to the project directory:
```bash
cd vulnerability-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser to: http://localhost:3010

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