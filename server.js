const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Database = require('./src/models/database');
const reportService = require('./src/services/reportService');
const exportService = require('./src/services/exportService');
const HistoryService = require('./src/services/historyService');

const app = express();
const PORT = 3010;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// File upload configuration
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads');
        await fs.mkdir(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Initialize database
const db = new Database();

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/dashboard', async (req, res) => {
    try {
        const summary = await db.getSummary();
        const recentReports = await db.getRecentReports(5);
        res.render('dashboard', { summary, recentReports });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/vulnerabilities', async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            severity: req.query.severity,
            resourceType: req.query.resourceType,
            platform: req.query.platform,
            fixAvailable: req.query.fixAvailable,
            vulnerabilityId: req.query.vulnerabilityId,
            resourceId: req.query.resourceId,
            search: req.query.search,
            lastObservedAt: req.query.lastObservedAt
        };

        const groupByCVE = req.query.groupByCVE === 'true';

        // Check if any filters are applied
        const hasFilters = Object.values(filters).some(value => value && value.trim() !== '') || groupByCVE;

        let vulnerabilities = [];
        if (hasFilters) {
            if (groupByCVE) {
                vulnerabilities = await db.getVulnerabilitiesGroupedByCVE(filters);
            } else {
                vulnerabilities = await db.getVulnerabilities(filters);
            }
        }

        const filterOptions = await db.getFilterOptions();

        res.render('vulnerabilities', {
            vulnerabilities,
            filters,
            filterOptions,
            groupByCVE: groupByCVE || false,
            hasFilters
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/upload', upload.single('reportFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const reportData = JSON.parse(fileContent);

        // Process and store the report
        const reportId = await reportService.processReport(reportData, db, req.file.originalname);

        // Clean up uploaded file
        await fs.unlink(filePath);

        res.json({
            success: true,
            message: 'Report processed successfully',
            reportId: reportId,
            vulnerabilityCount: reportData.findings ? reportData.findings.length : 0
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/vulnerabilities', async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            severity: req.query.severity,
            resourceType: req.query.resourceType,
            platform: req.query.platform,
            fixAvailable: req.query.fixAvailable,
            vulnerabilityId: req.query.vulnerabilityId,
            resourceId: req.query.resourceId,
            search: req.query.search,
            lastObservedAt: req.query.lastObservedAt
        };

        const vulnerabilities = await db.getVulnerabilities(filters);
        res.json(vulnerabilities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/export/pdf', async (req, res) => {
    try {
        const { vulnerabilityIds } = req.body;
        const vulnerabilities = await db.getVulnerabilitiesByIds(vulnerabilityIds);
        const pdfBuffer = await exportService.generatePDF(vulnerabilities);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=vulnerability-report.pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('PDF export error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/export/notion', async (req, res) => {
    try {
        const { vulnerabilityIds } = req.body;
        const vulnerabilities = await db.getVulnerabilitiesByIds(vulnerabilityIds);
        const notionText = exportService.generateNotionText(vulnerabilities);

        res.json({ content: notionText });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/reports', async (req, res) => {
    try {
        const reports = await db.getAllReports();
        res.json(reports);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/reports/:id', async (req, res) => {
    try {
        await db.deleteReport(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// FIXED VULNERABILITIES API ENDPOINTS
// ============================================================================

// Fixed Vulnerabilities Report Page
app.get('/fixed-vulnerabilities', async (req, res) => {
    try {
        // We'll render the page template here (T014 will implement the template)
        res.render('fixed-vulnerabilities', {
            title: 'Fixed Vulnerabilities Report'
        });
    } catch (error) {
        console.error('Fixed vulnerabilities page error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Fixed Vulnerabilities API Endpoint
app.get('/api/fixed-vulnerabilities', async (req, res) => {
    try {
        // Initialize history service
        const historyService = new HistoryService(db);

        // Parse and validate query parameters
        const filters = {};

        // Severity filter
        if (req.query.severity) {
            const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
            if (!validSeverities.includes(req.query.severity.toUpperCase())) {
                return res.status(400).json({
                    errors: [{
                        field: 'severity',
                        message: 'Invalid severity value. Must be one of: CRITICAL, HIGH, MEDIUM, LOW',
                        value: req.query.severity
                    }]
                });
            }
            filters.severity = req.query.severity.toUpperCase();
        }

        // Date filters
        if (req.query.fixedAfter) {
            const fixedAfterDate = new Date(req.query.fixedAfter);
            if (isNaN(fixedAfterDate.getTime())) {
                return res.status(400).json({
                    errors: [{
                        field: 'fixedAfter',
                        message: 'Invalid date format. Expected YYYY-MM-DD',
                        value: req.query.fixedAfter
                    }]
                });
            }
            filters.fixedAfter = req.query.fixedAfter;
        }

        if (req.query.fixedBefore) {
            const fixedBeforeDate = new Date(req.query.fixedBefore);
            if (isNaN(fixedBeforeDate.getTime())) {
                return res.status(400).json({
                    errors: [{
                        field: 'fixedBefore',
                        message: 'Invalid date format. Expected YYYY-MM-DD',
                        value: req.query.fixedBefore
                    }]
                });
            }
            filters.fixedBefore = req.query.fixedBefore;
        }

        // Resource type filter
        if (req.query.resourceType) {
            filters.resourceType = req.query.resourceType;
        }

        // Pagination
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        if (limit < 1 || limit > 1000) {
            return res.status(400).json({
                errors: [{
                    field: 'limit',
                    message: 'Limit must be between 1 and 1000',
                    value: req.query.limit
                }]
            });
        }

        if (offset < 0) {
            return res.status(400).json({
                errors: [{
                    field: 'offset',
                    message: 'Offset must be 0 or greater',
                    value: req.query.offset
                }]
            });
        }

        filters.limit = limit;
        filters.offset = offset;

        // Get fixed vulnerabilities data
        const result = await historyService.findFixedVulnerabilities(filters);

        res.json(result);
    } catch (error) {
        console.error('Fixed vulnerabilities API error:', error);
        res.status(500).json({
            message: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Vulnerability History Timeline API
app.get('/api/vulnerability-history/:findingArn', async (req, res) => {
    try {
        // Initialize history service
        const historyService = new HistoryService(db);

        // Decode the finding ARN (it may be URL encoded)
        const findingArn = decodeURIComponent(req.params.findingArn);

        // Validate finding ARN format (basic validation)
        if (!findingArn.startsWith('arn:aws:inspector2:')) {
            return res.status(400).json({
                message: 'Invalid finding ARN format',
                code: 'INVALID_ARN'
            });
        }

        // Get vulnerability history timeline
        const timeline = await historyService.getVulnerabilityHistory(findingArn);

        res.json(timeline);
    } catch (error) {
        console.error('Vulnerability history API error:', error);

        if (error.message.includes('not found')) {
            return res.status(404).json({
                message: 'Vulnerability not found in history or current data',
                code: 'NOT_FOUND'
            });
        }

        res.status(500).json({
            message: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Upload Events API (for monitoring)
app.get('/api/upload-events', async (req, res) => {
    try {
        const filters = {};

        if (req.query.status) {
            filters.status = req.query.status;
        }

        if (req.query.since) {
            filters.since = req.query.since;
        }

        if (req.query.limit) {
            filters.limit = parseInt(req.query.limit) || 50;
        }

        const uploadHistory = await reportService.getUploadHistory(filters);

        res.json(uploadHistory);
    } catch (error) {
        console.error('Upload events API error:', error);
        res.status(500).json({
            message: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const historyService = new HistoryService(db);

        const healthChecks = {
            database: 'unknown',
            history_service: 'unknown',
            report_service: 'unknown'
        };

        // Test database connectivity
        try {
            await db.getSummary();
            healthChecks.database = 'healthy';
        } catch (error) {
            healthChecks.database = 'error';
        }

        // Test history service
        try {
            const historyHealth = await historyService.healthCheck();
            healthChecks.history_service = historyHealth.status;
        } catch (error) {
            healthChecks.history_service = 'error';
        }

        // Test report service
        try {
            const reportHealth = await reportService.healthCheck();
            healthChecks.report_service = reportHealth.status;
        } catch (error) {
            healthChecks.report_service = 'error';
        }

        const allHealthy = Object.values(healthChecks).every(status => status === 'healthy');

        res.json({
            status: allHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            components: healthChecks
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Initialize database and start server
db.initialize().then(() => {
    app.listen(PORT, () => {
        console.log(`Vulnerability Dashboard running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});