/**
 * SBOM Module Routes
 *
 * This file will contain all routes related to Software Bill of Materials (SBOM)
 * functionality including SBOM analysis, component tracking, and vulnerability mapping.
 */

const express = require('express');
const router = express.Router();

// SBOM dashboard route
router.get('/', (req, res) => {
    res.render('modules/sbom/dashboard', {
        title: 'SBOM Dashboard',
        moduleId: 'sbom'
    });
});

// SBOM upload and parsing routes
router.post('/upload', async (req, res) => {
    try {
        const { sbomData } = req.body;
        const sbomService = require('../../services/sbomService');

        const result = await sbomService.parseSBOM(sbomData, req.db);

        res.json({
            success: true,
            message: 'SBOM uploaded and parsed successfully',
            componentCount: result.componentCount,
            sbomId: result.sbomId
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/sboms', async (req, res) => {
    try {
        const sboms = await req.db.getSBOMs();
        res.render('modules/sbom/list', {
            title: 'SBOM List',
            moduleId: 'sbom',
            sboms
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Component analysis routes
router.get('/components', async (req, res) => {
    try {
        const filters = {
            name: req.query.name,
            version: req.query.version,
            license: req.query.license,
            sbomId: req.query.sbomId
        };

        const components = await req.db.getComponents(filters);

        res.render('modules/sbom/components', {
            title: 'SBOM Components',
            moduleId: 'sbom',
            components,
            filters
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/components/:id', async (req, res) => {
    try {
        const component = await req.db.getComponentById(req.params.id);
        const vulnerabilities = await req.db.getVulnerabilitiesByComponent(req.params.id);

        res.render('modules/sbom/component-detail', {
            title: `Component: ${component.name}`,
            moduleId: 'sbom',
            component,
            vulnerabilities
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Vulnerability correlation routes
router.get('/vulnerabilities', async (req, res) => {
    try {
        const filters = {
            componentId: req.query.componentId,
            severity: req.query.severity,
            status: req.query.status
        };

        const vulnerabilities = await req.db.getSBOMVulnerabilities(filters);

        res.render('modules/sbom/vulnerabilities', {
            title: 'SBOM Vulnerabilities',
            moduleId: 'sbom',
            vulnerabilities,
            filters
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/correlate', async (req, res) => {
    try {
        const { sbomId } = req.body;
        const sbomService = require('../../services/sbomService');

        const correlationResult = await sbomService.correlateVulnerabilities(sbomId, req.db);

        res.json({
            success: true,
            message: 'Vulnerability correlation completed',
            matchedVulnerabilities: correlationResult.matched,
            newVulnerabilities: correlationResult.new
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SBOM export and reporting routes
router.get('/export/:id', async (req, res) => {
    try {
        const { format = 'json' } = req.query;
        const sbom = await req.db.getSBOMById(req.params.id);

        if (format === 'csv') {
            const csvData = await req.db.exportSBOMToCSV(req.params.id);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=sbom-${req.params.id}.csv`);
            res.send(csvData);
        } else {
            res.json({ sbom });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/report/:id', async (req, res) => {
    try {
        const sbomReport = await req.db.generateSBOMReport(req.params.id);

        res.render('modules/sbom/report', {
            title: 'SBOM Security Report',
            moduleId: 'sbom',
            report: sbomReport
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API endpoints for SBOM data
router.get('/api/components', async (req, res) => {
    try {
        const filters = {
            name: req.query.name,
            version: req.query.version,
            license: req.query.license,
            sbomId: req.query.sbomId
        };

        const components = await req.db.getComponents(filters);
        res.json({ data: components });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/vulnerabilities', async (req, res) => {
    try {
        const filters = {
            componentId: req.query.componentId,
            severity: req.query.severity,
            status: req.query.status
        };

        const vulnerabilities = await req.db.getSBOMVulnerabilities(filters);
        res.json({ data: vulnerabilities });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;