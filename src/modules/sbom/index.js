/**
 * SBOM Module Entry Point
 *
 * This module handles Software Bill of Materials (SBOM) analysis and management.
 * It exports the main module configuration and initialization.
 */

const routes = require('./routes');

module.exports = {
    name: 'sbom',
    displayName: 'SBOM Analysis',
    description: 'Software Bill of Materials analysis and vulnerability correlation',
    version: '1.0.0',
    routes: routes,

    // Module configuration
    config: {
        enabled: true,
        icon: '📋',
        route: '/sbom',
        displayOrder: 2,
        permissions: ['read', 'write', 'admin'],
        settings: {
            autoCorrelate: {
                type: 'boolean',
                default: true,
                description: 'Automatically correlate vulnerabilities on SBOM upload'
            },
            supportedFormats: {
                type: 'array',
                default: ['SPDX', 'CycloneDX', 'SWID'],
                options: ['SPDX', 'CycloneDX', 'SWID', 'PackageJSON'],
                description: 'Supported SBOM formats'
            },
            maxComponents: {
                type: 'number',
                default: 10000,
                min: 100,
                max: 100000,
                description: 'Maximum components per SBOM'
            },
            correlationDepth: {
                type: 'number',
                default: 3,
                min: 1,
                max: 5,
                description: 'Dependency correlation depth'
            }
        }
    },

    // Service initialization
    async initialize(db, services) {
        console.log('Initializing SBOM module...');

        // Initialize SBOM specific database tables
        try {
            await this.initializeDatabase(db);
            console.log('SBOM database initialized');
        } catch (error) {
            console.error('Failed to initialize SBOM database:', error);
            throw error;
        }

        // Initialize SBOM parsing engines
        try {
            await this.initializeParsers();
            console.log('SBOM parsers initialized');
        } catch (error) {
            console.error('Failed to initialize SBOM parsers:', error);
            throw error;
        }

        console.log('SBOM module initialized successfully');
        return true;
    },

    // Database initialization
    async initializeDatabase(db) {
        // SBOM table
        const createSBOMTable = `
            CREATE TABLE IF NOT EXISTS sboms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                version TEXT,
                format TEXT NOT NULL,
                namespace TEXT,
                creation_date DATETIME,
                creator TEXT,
                supplier TEXT,
                document_hash TEXT,
                uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'active'
            )
        `;

        // Components table
        const createComponentsTable = `
            CREATE TABLE IF NOT EXISTS sbom_components (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sbom_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                version TEXT,
                type TEXT,
                supplier TEXT,
                license TEXT,
                package_url TEXT,
                cpe TEXT,
                hash TEXT,
                download_location TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sbom_id) REFERENCES sboms(id) ON DELETE CASCADE
            )
        `;

        // Component dependencies table
        const createDependenciesTable = `
            CREATE TABLE IF NOT EXISTS sbom_dependencies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                parent_component_id INTEGER NOT NULL,
                child_component_id INTEGER NOT NULL,
                dependency_type TEXT,
                scope TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_component_id) REFERENCES sbom_components(id) ON DELETE CASCADE,
                FOREIGN KEY (child_component_id) REFERENCES sbom_components(id) ON DELETE CASCADE
            )
        `;

        // Component vulnerabilities correlation table
        const createComponentVulnerabilitiesTable = `
            CREATE TABLE IF NOT EXISTS sbom_component_vulnerabilities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                component_id INTEGER NOT NULL,
                vulnerability_id TEXT NOT NULL,
                correlation_method TEXT,
                confidence_score REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (component_id) REFERENCES sbom_components(id) ON DELETE CASCADE
            )
        `;

        await db.run(createSBOMTable);
        await db.run(createComponentsTable);
        await db.run(createDependenciesTable);
        await db.run(createComponentVulnerabilitiesTable);

        // Create indexes for performance
        await db.run('CREATE INDEX IF NOT EXISTS idx_sbom_components_name ON sbom_components(name, version)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_sbom_components_cpe ON sbom_components(cpe)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_sbom_dependencies_parent ON sbom_dependencies(parent_component_id)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_component_vulnerabilities ON sbom_component_vulnerabilities(component_id, vulnerability_id)');
    },

    // Initialize SBOM parsing engines
    async initializeParsers() {
        this.parsers = {
            'SPDX': require('./parsers/spdxParser'),
            'CycloneDX': require('./parsers/cycloneDxParser'),
            'SWID': require('./parsers/swidParser'),
            'PackageJSON': require('./parsers/packageJsonParser')
        };

        // Validate parsers
        for (const [format, parser] of Object.entries(this.parsers)) {
            if (!parser.parse || typeof parser.parse !== 'function') {
                throw new Error(`Invalid parser for format ${format}: missing parse method`);
            }
        }
    },

    // Vulnerability correlation logic
    async correlateVulnerabilities(sbomId, db) {
        const components = await db.all(
            'SELECT * FROM sbom_components WHERE sbom_id = ?',
            [sbomId]
        );

        const correlations = [];
        let matched = 0;
        let newVulns = 0;

        for (const component of components) {
            // Correlate by CPE
            if (component.cpe) {
                const vulns = await this.findVulnerabilitiesByCPE(component.cpe, db);
                correlations.push(...vulns.map(v => ({
                    componentId: component.id,
                    vulnerabilityId: v.id,
                    method: 'CPE',
                    confidence: 0.9
                })));
                matched += vulns.length;
            }

            // Correlate by package name/version
            if (component.name && component.version) {
                const vulns = await this.findVulnerabilitiesByPackage(component.name, component.version, db);
                correlations.push(...vulns.map(v => ({
                    componentId: component.id,
                    vulnerabilityId: v.id,
                    method: 'Package',
                    confidence: 0.8
                })));
                newVulns += vulns.length;
            }
        }

        // Save correlations
        for (const correlation of correlations) {
            await db.run(
                `INSERT OR REPLACE INTO sbom_component_vulnerabilities
                 (component_id, vulnerability_id, correlation_method, confidence_score)
                 VALUES (?, ?, ?, ?)`,
                [correlation.componentId, correlation.vulnerabilityId, correlation.method, correlation.confidence]
            );
        }

        return { matched, new: newVulns };
    },

    async findVulnerabilitiesByCPE(cpe, db) {
        return await db.all(
            `SELECT DISTINCT v.* FROM vulnerabilities v
             JOIN vulnerability_resources vr ON v.id = vr.vulnerability_id
             WHERE vr.resourceId LIKE ?`,
            [`%${cpe}%`]
        );
    },

    async findVulnerabilitiesByPackage(name, version, db) {
        return await db.all(
            `SELECT DISTINCT v.* FROM vulnerabilities v
             WHERE v.title LIKE ? OR v.description LIKE ?`,
            [`%${name}%`, `%${name}%`]
        );
    },

    // Module-specific middleware
    middleware: [
        // Database injection middleware
        (req, res, next) => {
            if (!req.db) {
                return res.status(500).json({ error: 'Database not available' });
            }
            next();
        },

        // SBOM format validation middleware
        (req, res, next) => {
            if (req.path.includes('/upload') && req.method === 'POST') {
                const { sbomData } = req.body;
                if (!sbomData) {
                    return res.status(400).json({ error: 'SBOM data is required' });
                }
            }
            next();
        }
    ]
};