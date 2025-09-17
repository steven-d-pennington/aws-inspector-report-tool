/**
 * Jest test setup file
 * Configures test environment and global test utilities
 */

const path = require('path');
const fs = require('fs').promises;
const Database = require('../src/models/database');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:'; // Use in-memory database for tests

// Global test utilities
global.testUtils = {
    // Reset database before each test
    async resetDatabase() {
        const db = new Database();
        // Initialize with clean schema
        await db.init();
        return db;
    },

    // Create test data for modules
    async seedTestModules(db) {
        const modules = [
            {
                module_id: 'aws-inspector',
                name: 'AWS Inspector',
                description: 'AWS Inspector vulnerability reports',
                enabled: true,
                is_default: true,
                display_order: 1,
                route: '/'
            },
            {
                module_id: 'sbom',
                name: 'SBOM Reports',
                description: 'Software Bill of Materials reports',
                enabled: true,
                is_default: false,
                display_order: 2,
                route: '/sbom'
            },
            {
                module_id: 'security-scan',
                name: 'Security Scan',
                description: 'Security scanning results',
                enabled: false,
                is_default: false,
                display_order: 3,
                route: '/security'
            }
        ];

        for (const module of modules) {
            await db.insertModule(module);
        }

        return modules;
    }
};

// Jest configuration
module.exports = {
    testEnvironment: 'node',
    setupFilesAfterEnv: [__filename]
};