/**
 * AWS Inspector Module Entry Point
 *
 * This module handles AWS Inspector vulnerability reporting and management.
 * It exports the main module configuration and initialization.
 */

const routes = require('./routes');

module.exports = {
    name: 'aws-inspector',
    displayName: 'AWS Inspector',
    description: 'AWS Inspector vulnerability reporting and management',
    version: '1.0.0',
    routes: routes,

    // Module configuration
    config: {
        enabled: true,
        icon: '🔍',
        route: '/aws-inspector',
        displayOrder: 1,
        permissions: ['read', 'write', 'admin'],
        settings: {
            autoRefresh: {
                type: 'boolean',
                default: false,
                description: 'Auto-refresh vulnerability data'
            },
            refreshInterval: {
                type: 'number',
                default: 300,
                min: 60,
                max: 3600,
                description: 'Refresh interval in seconds'
            },
            severityFilter: {
                type: 'array',
                default: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
                options: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'],
                description: 'Default severity filter'
            }
        }
    },

    // Service initialization
    async initialize(db, services) {
        console.log('Initializing AWS Inspector module...');

        // Initialize AWS Inspector specific database tables if needed
        try {
            await this.initializeDatabase(db);
            console.log('AWS Inspector database initialized');
        } catch (error) {
            console.error('Failed to initialize AWS Inspector database:', error);
            throw error;
        }

        // Initialize services
        if (!services.reportService) {
            throw new Error('Report service is required for AWS Inspector module');
        }

        console.log('AWS Inspector module initialized successfully');
        return true;
    },

    // Database initialization
    async initializeDatabase(db) {
        // AWS Inspector specific table initialization
        const createAwsInspectorTable = `
            CREATE TABLE IF NOT EXISTS aws_inspector_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_id TEXT NOT NULL,
                account_id TEXT,
                region TEXT,
                scan_type TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
            )
        `;

        const createAwsResourcesTable = `
            CREATE TABLE IF NOT EXISTS aws_resources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                resource_id TEXT NOT NULL UNIQUE,
                resource_type TEXT NOT NULL,
                account_id TEXT,
                region TEXT,
                tags TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        await db.run(createAwsInspectorTable);
        await db.run(createAwsResourcesTable);

        // Create indexes for performance
        await db.run('CREATE INDEX IF NOT EXISTS idx_aws_inspector_account ON aws_inspector_reports(account_id)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_aws_resources_type ON aws_resources(resource_type)');
    },

    // Module-specific middleware
    middleware: [
        // Database injection middleware
        (req, res, next) => {
            // Inject database instance for module routes
            if (!req.db) {
                return res.status(500).json({ error: 'Database not available' });
            }
            next();
        },

        // AWS Inspector specific validation
        (req, res, next) => {
            // Add AWS Inspector specific request validation if needed
            next();
        }
    ]
};