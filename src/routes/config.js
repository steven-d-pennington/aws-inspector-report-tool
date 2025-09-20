const express = require('express');
const router = express.Router();
const configService = require('../services/configService');

// GET /api/config - Get current configuration
router.get('/config', async (req, res) => {
  try {
    const config = configService.getCurrentConfiguration();
    res.status(200).json(config);
  } catch (error) {
    console.error('Failed to get configuration:', error);
    res.status(500).json({
      error: 'Failed to retrieve configuration',
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/config/validate - Validate configuration
router.post('/config/validate', async (req, res) => {
  try {
    const configToValidate = req.body;

    if (!configToValidate || typeof configToValidate !== 'object') {
      return res.status(400).json({
        valid: false,
        timestamp: new Date().toISOString(),
        errors: [{
          field: 'request',
          message: 'Configuration object is required'
        }]
      });
    }

    const validation = configService.validateConfiguration(configToValidate);

    res.status(validation.valid ? 200 : 400).json(validation);
  } catch (error) {
    console.error('Configuration validation failed:', error);
    res.status(400).json({
      valid: false,
      timestamp: new Date().toISOString(),
      errors: [{
        field: 'validation',
        message: 'Validation process failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }]
    });
  }
});

// POST /api/config/reload - Reload configuration
router.post('/config/reload', async (req, res) => {
  try {
    const result = configService.reloadConfiguration();
    res.status(200).json(result);
  } catch (error) {
    console.error('Configuration reload failed:', error);
    res.status(500).json({
      error: 'Failed to reload configuration',
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Middleware to check if configuration management is enabled (disabled for now)
// router.use((req, res, next) => {
//   // In production, you might want to add authentication/authorization here
//   if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_CONFIG_API) {
//     return res.status(403).json({
//       error: 'Configuration API is disabled in production',
//       timestamp: new Date().toISOString()
//     });
//   }
//   next();
// });

module.exports = router;