const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Database = require('./src/models/database');
const reportService = require('./src/services/reportService');
const exportService = require('./src/services/exportService');

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
            search: req.query.search
        };

        const groupByCVE = req.query.groupByCVE === 'true';

        let vulnerabilities;
        if (groupByCVE) {
            vulnerabilities = await db.getVulnerabilitiesGroupedByCVE(filters);
        } else {
            vulnerabilities = await db.getVulnerabilities(filters);
        }

        const filterOptions = await db.getFilterOptions();

        res.render('vulnerabilities', {
            vulnerabilities,
            filters,
            filterOptions,
            groupByCVE: groupByCVE || false
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
            search: req.query.search
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

// Initialize database and start server
db.initialize().then(() => {
    app.listen(PORT, () => {
        console.log(`Vulnerability Dashboard running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});