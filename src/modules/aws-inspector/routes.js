/**
 * AWS Inspector Module Routes
 *
 * This file will contain all routes related to AWS Inspector functionality
 * including vulnerability reporting, dashboard views, and data management.
 */

const express = require('express');
const router = express.Router();

// Dashboard routes
router.get('/', (req, res) => {
    res.render('modules/aws-inspector/dashboard', {
        title: 'AWS Inspector Dashboard',
        moduleId: 'aws-inspector'
    });
});

// Vulnerability report routes
router.get('/vulnerabilities', async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            severity: req.query.severity,
            resourceType: req.query.resourceType,
            platform: req.query.platform
        };

        // Get vulnerabilities from database
        const vulnerabilities = await req.db.getVulnerabilities(filters);

        res.render('modules/aws-inspector/vulnerabilities', {
            title: 'AWS Inspector Vulnerabilities',
            moduleId: 'aws-inspector',
            vulnerabilities,
            filters
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Data import/export routes
router.post('/import', async (req, res) => {
    try {
        const { reportData } = req.body;
        const reportService = require('../../services/reportService');

        const reportId = await reportService.processReport(reportData, req.db, 'aws-inspector-import');

        res.json({
            success: true,
            message: 'AWS Inspector report imported successfully',
            reportId
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/export', async (req, res) => {
    try {
        const { format = 'json', vulnerabilityIds } = req.query;
        const exportService = require('../../services/exportService');

        const vulnerabilities = await req.db.getVulnerabilitiesByIds(vulnerabilityIds);

        if (format === 'pdf') {
            const pdfBuffer = await exportService.generatePDF(vulnerabilities);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=aws-inspector-report.pdf');
            res.send(pdfBuffer);
        } else {
            res.json({ vulnerabilities });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API endpoints for vulnerability data
router.get('/api/vulnerabilities', async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            severity: req.query.severity,
            resourceType: req.query.resourceType,
            platform: req.query.platform,
            search: req.query.search
        };

        const vulnerabilities = await req.db.getVulnerabilities(filters);
        res.json({ data: vulnerabilities });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/summary', async (req, res) => {
    try {
        const summary = await req.db.getSummary();
        res.json({ summary });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch('/api/vulnerabilities/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        await req.db.updateVulnerabilityStatus(id, status);
        res.json({ success: true, message: 'Vulnerability status updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;