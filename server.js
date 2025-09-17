// Gracefully handle missing dependencies during development
try {
    var express = require('express');
    var multer = require('multer');
} catch (error) {
    console.error('Missing core dependencies. Please run: npm install');
    console.error('Error:', error.message);
    process.exit(1);
}

const path = require('path');
const fs = require('fs').promises;
const Database = require('./src/models/database');
const reportService = require('./src/services/reportService');
const exportService = require('./src/services/exportService');
const settingsService = require('./src/services/settingsService');
const ModuleService = require('./src/services/moduleService');

const app = express();
const PORT = 3010;

// Rate limiting store
const rateLimitStore = new Map();

// Rate limiting middleware for settings endpoint (max 10 requests per minute)
const settingsRateLimit = (req, res, next) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 10;

    if (!rateLimitStore.has(clientId)) {
        rateLimitStore.set(clientId, []);
    }

    const requests = rateLimitStore.get(clientId);

    // Remove requests older than the window
    const validRequests = requests.filter(timestamp => now - timestamp < windowMs);

    if (validRequests.length >= maxRequests) {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            details: {
                limit: maxRequests,
                window: '1 minute',
                retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000)
            }
        });
    }

    // Add current request
    validRequests.push(now);
    rateLimitStore.set(clientId, validRequests);

    next();
};

// Request body validation middleware for settings endpoint
const validateSettingsRequest = (req, res, next) => {
    const { settings } = req.body;

    // Check if settings object exists
    if (!settings) {
        return res.status(400).json({
            error: 'Missing required field: settings',
            code: 'VALIDATION_ERROR',
            details: {
                field: 'settings',
                message: 'Request body must include a settings object'
            }
        });
    }

    // Check if settings is an object
    if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
        return res.status(400).json({
            error: 'Invalid settings data type',
            code: 'VALIDATION_ERROR',
            details: {
                field: 'settings',
                expected: 'object',
                received: Array.isArray(settings) ? 'array' : typeof settings,
                message: 'Settings must be a plain object'
            }
        });
    }

    // Allow empty settings object - it will be handled in the endpoint logic
    // Empty settings will result in a successful response with empty updated array

    // Validate setting keys and values
    for (const [key, value] of Object.entries(settings)) {
        // Validate key format
        if (typeof key !== 'string' || !key.trim()) {
            return res.status(400).json({
                error: 'Invalid setting key',
                code: 'VALIDATION_ERROR',
                details: {
                    field: key,
                    message: 'Setting keys must be non-empty strings'
                }
            });
        }

        // Validate key format (alphanumeric and underscores only)
        if (!/^[a-zA-Z0-9_]+$/.test(key)) {
            return res.status(400).json({
                error: 'Invalid setting key format',
                code: 'VALIDATION_ERROR',
                details: {
                    field: key,
                    message: 'Setting keys must contain only alphanumeric characters and underscores'
                }
            });
        }

        // Validate value types (must be JSON serializable)
        const allowedTypes = ['string', 'number', 'boolean', 'object'];
        const valueType = typeof value;

        if (value !== null && value !== undefined && !allowedTypes.includes(valueType)) {
            return res.status(400).json({
                error: 'Invalid setting value type',
                code: 'VALIDATION_ERROR',
                details: {
                    field: key,
                    expected: allowedTypes,
                    received: valueType,
                    message: `Setting values must be one of: ${allowedTypes.join(', ')}`
                }
            });
        }

        // Additional validation for objects (must be JSON serializable)
        if (valueType === 'object' && value !== null) {
            try {
                JSON.stringify(value);
            } catch (error) {
                return res.status(400).json({
                    error: 'Invalid setting value format',
                    code: 'VALIDATION_ERROR',
                    details: {
                        field: key,
                        message: 'Object values must be JSON serializable'
                    }
                });
            }
        }
    }

    next();
};

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

// Initialize database and module service
const db = new Database();
const moduleService = new ModuleService();

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/dashboard', async (req, res) => {
    try {
        // Initialize module service if needed
        if (!moduleService.isInitialized) {
            await moduleService.initialize();
        }

        const summary = await db.getSummary();
        const recentReports = await db.getRecentReports(5);
        const modules = await moduleService.getModules();

        res.render('dashboard', {
            summary,
            recentReports,
            modules,
            currentRoute: '/dashboard'
        });
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

// Settings API endpoints
app.get('/api/settings', async (req, res) => {
    const startTime = Date.now();

    try {
        console.log(`[${new Date().toISOString()}] GET /api/settings - Fetching application settings`);

        // Use settingsService to get detailed settings information
        const detailedSettings = await settingsService.getSettingsDetailed();

        // Return response in OpenAPI contract format
        const response = {
            settings: detailedSettings
        };

        const responseTime = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] GET /api/settings - Success (${responseTime}ms) - ${Object.keys(detailedSettings).length} settings`);

        res.setHeader('Content-Type', 'application/json');
        res.json(response);
    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error(`[${new Date().toISOString()}] GET /api/settings - Error (${responseTime}ms):`, error.message);

        // Handle database connection errors gracefully
        if (error.message.includes('database') || error.message.includes('SQLITE')) {
            res.status(503).json({
                error: 'Database temporarily unavailable. Please try again later.',
                code: 'DATABASE_ERROR'
            });
        } else {
            res.status(500).json({
                error: error.message,
                code: 'INTERNAL_ERROR'
            });
        }
    }
});

app.put('/api/settings', settingsRateLimit, validateSettingsRequest, async (req, res) => {
    try {
        const { settings } = req.body;

        // Initialize settings service if not already done
        if (!settingsService.isInitialized) {
            await settingsService.initialize();
        }

        // Handle empty settings object
        if (Object.keys(settings).length === 0) {
            return res.json({
                success: true,
                message: 'No settings to update',
                updated: []
            });
        }

        // Update settings using the service layer with validation
        const updatedSettings = await settingsService.updateSettings(settings, {
            auditUser: req.ip || 'unknown'
        });

        // Get the list of updated keys
        const updatedKeys = Object.keys(settings);

        // Return response in the format specified by the OpenAPI contract
        res.json({
            success: true,
            message: 'Settings updated successfully',
            updated: updatedKeys
        });

    } catch (error) {
        // Handle validation errors from settingsService
        if (error.message.includes('must be of type') ||
            error.message.includes('must be one of') ||
            error.message.includes('must be at least') ||
            error.message.includes('must be at most') ||
            error.message.includes('must contain only') ||
            error.message.includes('Invalid value type')) {

            return res.status(400).json({
                error: error.message,
                code: 'VALIDATION_ERROR',
                details: {
                    message: error.message
                }
            });
        }

        // Handle database or other system errors
        if (error.message.includes('database') ||
            error.message.includes('Failed to update settings') ||
            error.message.includes('Failed to retrieve settings')) {

            return res.status(500).json({
                error: 'Internal server error while updating settings',
                code: 'DATABASE_ERROR',
                details: {
                    message: 'Settings update failed due to a server error'
                }
            });
        }

        // Handle initialization errors
        if (error.message.includes('initialization')) {
            return res.status(500).json({
                error: 'Settings service unavailable',
                code: 'SERVICE_ERROR',
                details: {
                    message: 'Settings service could not be initialized'
                }
            });
        }

        // Generic error fallback
        console.error('Settings update error:', error);
        res.status(500).json({
            error: 'An unexpected error occurred while updating settings',
            code: 'INTERNAL_ERROR',
            details: {
                message: 'Please try again later'
            }
        });
    }
});

// Module API endpoints
app.get('/api/modules', async (req, res) => {
    const startTime = Date.now();

    try {
        // Get modules from moduleService with registry integration
        const modules = await moduleService.getModules();

        // Filter to only include OpenAPI specification fields
        const allowedFields = [
            'module_id', 'name', 'description', 'enabled', 'is_default',
            'display_order', 'config', 'icon', 'route', 'created_at', 'updated_at'
        ];

        const filteredModules = modules.map(module => {
            const filteredModule = {};
            allowedFields.forEach(field => {
                if (module.hasOwnProperty(field)) {
                    filteredModule[field] = module[field];
                }
            });
            return filteredModule;
        });

        // Modules are already sorted by display_order in the service
        // Ensure they are sorted properly
        const sortedModules = filteredModules.sort((a, b) => a.display_order - b.display_order);

        // Calculate response time for performance monitoring
        const responseTime = Date.now() - startTime;

        // Log performance warning if response time exceeds 200ms
        if (responseTime > 200) {
            console.warn(`[PERFORMANCE WARNING] GET /api/modules took ${responseTime}ms (>200ms threshold)`);
        }

        // Return modules in the required format: {modules: [Module objects]}
        res.json({ modules: sortedModules });

        // Log performance info
        console.log(`[PERFORMANCE] GET /api/modules completed in ${responseTime}ms`);

    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error(`[ERROR] GET /api/modules failed after ${responseTime}ms:`, error.message);

        // Return appropriate HTTP status codes based on error type
        if (error.message.includes('not initialized')) {
            res.status(503).json({ error: 'Module service not available' });
        } else if (error.message.includes('not found')) {
            res.status(404).json({ error: error.message });
        } else if (error.message.includes('validation') || error.message.includes('invalid')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

app.get('/api/modules/enabled', async (req, res) => {
    try {
        const enabledModules = await moduleService.getEnabledModules();
        res.json(enabledModules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/modules/:moduleId/toggle', async (req, res) => {
    try {
        const { moduleId } = req.params;
        const { enabled } = req.body;

        // Validate request body structure
        if (!req.body.hasOwnProperty('enabled')) {
            return res.status(400).json({
                error: 'Missing required field: enabled'
            });
        }

        // Validate enabled field type
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                error: 'Invalid enabled value - must be boolean'
            });
        }

        // Use moduleService for comprehensive validation and business logic
        const updatedModule = await moduleService.toggleModule(moduleId, enabled, 'api-user');

        // Return response according to OpenAPI specification
        res.json({
            success: true,
            module: updatedModule
        });

    } catch (error) {
        // Handle specific error types with appropriate HTTP status codes
        const errorMessage = error.message;

        if (errorMessage.includes('not found')) {
            return res.status(404).json({
                error: errorMessage
            });
        }

        if (errorMessage.includes('cannot disable') ||
            errorMessage.includes('Cannot disable') ||
            errorMessage.includes('default module') ||
            errorMessage.includes('at least one module')) {
            return res.status(400).json({
                error: errorMessage
            });
        }

        // Log unexpected errors for debugging
        console.error('Module toggle error:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

// GET /api/modules/:moduleId/config - Get module configuration
app.get('/api/modules/:moduleId/config', async (req, res) => {
    try {
        const { moduleId } = req.params;

        // Validate module ID format
        if (!moduleId || typeof moduleId !== 'string') {
            return res.status(400).json({ error: 'Invalid module ID' });
        }

        // Get module from database
        const module = await db.getModuleById(moduleId);
        if (!module) {
            return res.status(404).json({ error: 'Module not found' });
        }

        // Return configuration in the format specified by OpenAPI spec
        res.json({
            config: module.config || {}
        });
    } catch (error) {
        console.error('Get module config error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/modules/:moduleId/config - Update module configuration
app.put('/api/modules/:moduleId/config', async (req, res) => {
    try {
        const { moduleId } = req.params;
        const { config } = req.body;

        // Validate module ID format
        if (!moduleId || typeof moduleId !== 'string') {
            return res.status(400).json({ error: 'Invalid module ID' });
        }

        // Validate request body
        if (!req.body.hasOwnProperty('config')) {
            return res.status(400).json({ error: 'Request body must contain config property' });
        }

        if (config !== null && config !== undefined && typeof config !== 'object') {
            return res.status(400).json({ error: 'Config must be an object or null' });
        }

        // Use moduleService for comprehensive validation and audit logging
        const updatedModule = await moduleService.updateModuleConfig(moduleId, config, 'api-user');

        // Return response matching OpenAPI specification
        res.json({
            success: true,
            config: updatedModule.config || {}
        });
    } catch (error) {
        console.error('Update module config error:', error);

        if (error.message.includes('not found')) {
            res.status(404).json({ error: error.message });
        } else if (error.message.includes('Configuration conflicts') ||
                   error.message.includes('must be') ||
                   error.message.includes('invalid')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// PUT /api/modules/reorder - Reorder module tabs
app.put('/api/modules/reorder', async (req, res) => {
    try {
        const { order } = req.body;

        // Validate request body structure
        if (!req.body.hasOwnProperty('order')) {
            return res.status(400).json({
                error: 'Request body must contain order property'
            });
        }

        if (!Array.isArray(order)) {
            return res.status(400).json({
                error: 'Order must be an array'
            });
        }

        if (order.length === 0) {
            return res.status(400).json({
                error: 'Order array cannot be empty'
            });
        }

        // Validate each order item structure
        for (let i = 0; i < order.length; i++) {
            const item = order[i];

            if (!item || typeof item !== 'object') {
                return res.status(400).json({
                    error: `Order item at index ${i} must be an object`
                });
            }

            if (!item.hasOwnProperty('module_id') || typeof item.module_id !== 'string' || !item.module_id.trim()) {
                return res.status(400).json({
                    error: `Order item at index ${i} must have a valid module_id string`
                });
            }

            if (!item.hasOwnProperty('display_order') || typeof item.display_order !== 'number' || !Number.isInteger(item.display_order)) {
                return res.status(400).json({
                    error: `Order item at index ${i} must have a valid display_order integer`
                });
            }

            if (item.display_order < 1) {
                return res.status(400).json({
                    error: `Order item at index ${i} display_order must be at least 1`
                });
            }
        }

        // Check for duplicate module_ids
        const moduleIds = order.map(item => item.module_id);
        const uniqueIds = new Set(moduleIds);
        if (uniqueIds.size !== moduleIds.length) {
            return res.status(400).json({
                error: 'Order array cannot contain duplicate module IDs'
            });
        }

        // Check for duplicate display_order values
        const displayOrders = order.map(item => item.display_order);
        const uniqueOrders = new Set(displayOrders);
        if (uniqueOrders.size !== displayOrders.length) {
            return res.status(400).json({
                error: 'Order array cannot contain duplicate display_order values'
            });
        }

        // Use moduleService for comprehensive validation and atomic reordering
        const reorderedModules = await moduleService.reorderModulesWithOrder(order, 'api-user');

        // Return response matching OpenAPI specification
        res.json({
            success: true,
            modules: reorderedModules
        });
    } catch (error) {
        console.error('Reorder modules error:', error);

        // Handle specific error types with appropriate status codes
        if (error.message.includes('not found')) {
            res.status(400).json({ error: error.message });
        } else if (error.message.includes('duplicate') ||
                   error.message.includes('must be') ||
                   error.message.includes('cannot contain') ||
                   error.message.includes('invalid') ||
                   error.message.includes('empty') ||
                   error.message.includes('at least')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Settings page route - renders the settings management interface
app.get('/settings', async (req, res) => {
    const startTime = Date.now();

    try {
        console.log(`[${new Date().toISOString()}] GET /settings - Rendering settings page`);

        // Initialize services if not already done
        if (!settingsService.isInitialized) {
            await settingsService.initialize();
        }
        if (!moduleService.isInitialized) {
            await moduleService.initialize();
        }

        // Get current application settings from settingsService
        const detailedSettings = await settingsService.getSettingsDetailed();

        // Get available modules with their enabled state from moduleService
        const modules = await moduleService.getModules();

        // Filter modules to only include necessary fields for the settings view
        const modulesForView = modules.map(module => ({
            module_id: module.module_id,
            name: module.name,
            description: module.description,
            enabled: module.enabled,
            is_default: module.is_default,
            display_order: module.display_order,
            icon: module.icon,
            route: module.route
        }));

        // Sort modules by display order for consistent presentation
        modulesForView.sort((a, b) => a.display_order - b.display_order);

        // Prepare template variables
        const templateData = {
            // Current application settings
            settings: detailedSettings,

            // Available modules with their enabled state
            modules: modulesForView,

            // Page metadata
            pageTitle: 'Settings',

            // User-specific preferences (placeholder for future implementation)
            userPreferences: {},

            // Flash messages (placeholder for future session-based messaging)
            messages: {
                success: req.query.success || null,
                error: req.query.error || null,
                info: req.query.info || null
            },

            // Additional metadata for the view
            meta: {
                totalModules: modulesForView.length,
                enabledModules: modulesForView.filter(m => m.enabled).length,
                settingsCount: Object.keys(detailedSettings).length,
                lastUpdated: new Date().toISOString()
            }
        };

        // Calculate and log performance metrics
        const responseTime = Date.now() - startTime;

        // Log performance warning if response time exceeds 500ms
        if (responseTime > 500) {
            console.warn(`[PERFORMANCE WARNING] GET /settings took ${responseTime}ms (>500ms threshold)`);
        }

        console.log(`[${new Date().toISOString()}] GET /settings - Success (${responseTime}ms) - ${templateData.meta.settingsCount} settings, ${templateData.meta.totalModules} modules`);

        // Render the settings view with all necessary data
        res.render('settings', templateData);

    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error(`[${new Date().toISOString()}] GET /settings - Error (${responseTime}ms):`, error.message);

        // Handle database connection errors gracefully
        if (error.message.includes('database') ||
            error.message.includes('SQLITE') ||
            error.message.includes('not initialized')) {

            console.error('Database connection error on settings page:', error);

            // Try to render error page with minimal data, or fallback to JSON
            try {
                res.status(503).render('error', {
                    pageTitle: 'Settings - Service Unavailable',
                    error: {
                        status: 503,
                        message: 'Database temporarily unavailable. Please try again later.',
                        details: 'The settings service cannot connect to the database.'
                    }
                });
            } catch (renderError) {
                // Fallback to JSON response if view rendering fails
                res.status(503).json({
                    error: 'Database temporarily unavailable. Please try again later.',
                    code: 'DATABASE_ERROR',
                    requestId: `settings-${Date.now()}`
                });
            }
        } else if (error.message.includes('ENOENT') || error.message.includes('template')) {
            // Handle missing template file
            console.error('Settings template not found:', error);
            res.status(500).json({
                error: 'Settings page temporarily unavailable',
                code: 'TEMPLATE_ERROR',
                message: 'The settings page is being configured. Please try again later.'
            });
        } else {
            // Handle other errors
            console.error('Unexpected error on settings page:', error);

            try {
                res.status(500).render('error', {
                    pageTitle: 'Settings - Error',
                    error: {
                        status: 500,
                        message: 'An unexpected error occurred while loading settings.',
                        details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later.'
                    }
                });
            } catch (renderError) {
                // Fallback to JSON response
                res.status(500).json({
                    error: 'An unexpected error occurred while loading settings',
                    code: 'INTERNAL_ERROR',
                    requestId: `settings-${Date.now()}`
                });
            }
        }
    }
});

// Initialize database and services, then start server
async function initializeServices() {
    try {
        console.log('Initializing services...');

        // Initialize database first
        await db.initialize();
        console.log('Database initialized successfully');

        // Initialize settings service
        await settingsService.initialize();
        console.log('Settings service initialized successfully');

        // Initialize module service
        await moduleService.initialize();
        console.log('Module service initialized successfully');

        app.listen(PORT, () => {
            console.log(`Vulnerability Dashboard running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Failed to initialize services:', err);
        process.exit(1);
    }
}

initializeServices();

// Export app for testing
module.exports = app;