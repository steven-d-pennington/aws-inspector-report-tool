// Express app configuration (without server startup)
// Used for testing and modular deployment

require('dotenv').config();

const express = require('express');
const path = require('path');

// Import environment configuration and routes
const environmentConfig = require('./config/environment');
const healthRoutes = require('./routes/health');
const configRoutes = require('./routes/config');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Register new Docker health and config routes
app.use('/', healthRoutes);
app.use('/api', configRoutes);

// Basic route for testing
app.get('/test', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

module.exports = app;