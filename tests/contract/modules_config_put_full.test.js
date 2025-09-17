/**
 * COMPREHENSIVE Contract Test for PUT /api/modules/{moduleId}/config endpoint
 *
 * This is the full version with supertest integration - to be used once:
 * 1. Dependencies are installed (npm install express supertest jest)
 * 2. The endpoint is implemented in server.js
 *
 * This test verifies the complete API contract as defined in settings-api.yaml
 * Replace modules_config_put.test.js with this file once ready.
 */

const request = require('supertest');
const express = require('express');
const path = require('path');
const Database = require('../../src/models/database');

describe('PUT /api/modules/{moduleId}/config - Full Contract Tests', () => {
  let app;
  let server;
  let db;

  before(async () => {
    // Create Express app for testing
    app = express();
    app.use(express.json());

    // Initialize database with in-memory SQLite for isolation
    db = new Database();
    // Override database path for testing
    db.dbPath = ':memory:';
    await db.initialize();

    // TODO: Add the actual endpoint implementation here
    // app.put('/api/modules/:moduleId/config', async (req, res) => {
    //   // Implementation will go here
    // });

    // Start server
    server = app.listen(0); // Use random available port
  });

  after(async () => {
    if (db && db.db) {
      await new Promise((resolve) => db.db.close(resolve));
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(async () => {
    // Reset database state before each test
    await new Promise((resolve, reject) => {
      db.db.serialize(() => {
        // Clear existing module_settings
        db.db.run('DELETE FROM module_settings', (err) => {
          if (err) reject(err);
        });

        // Insert test modules
        db.db.run(`
          INSERT INTO module_settings (module_id, name, description, enabled, is_default, display_order, config, route)
          VALUES
          ('aws-inspector', 'AWS Inspector', 'AWS Inspector vulnerability reports', 1, 1, 1, '{"theme": "light", "autoRefresh": false}', '/'),
          ('sbom', 'SBOM Reports', 'Software Bill of Materials reports', 1, 0, 2, '{"format": "json", "includeDevDeps": true}', '/sbom'),
          ('compliance', 'Compliance', 'Security compliance reports', 0, 0, 3, '{}', '/compliance')
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  });

  describe('Successful Configuration Update (200 OK)', () => {
    it('should update module configuration and return success response', async () => {
      const moduleId = 'aws-inspector';
      const newConfig = {
        theme: 'dark',
        autoRefresh: true,
        refreshInterval: 30,
        notifications: {
          email: true,
          slack: false
        }
      };

      const response = await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send({ config: newConfig })
        .expect('Content-Type', /json/)
        .expect(200);

      // Verify response structure matches OpenAPI spec
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('config');
      expect(response.body.config).toEqual(newConfig);
    });

    it('should handle simple primitive config values', async () => {
      const moduleId = 'sbom';
      const simpleConfig = {
        enabled: true,
        maxFileSize: 1024,
        outputFormat: 'xml'
      };

      const response = await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send({ config: simpleConfig })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.config).toEqual(simpleConfig);
    });

    it('should handle array configurations', async () => {
      const moduleId = 'compliance';
      const arrayConfig = {
        supportedStandards: ['SOC2', 'PCI-DSS', 'HIPAA'],
        reportTypes: [
          { name: 'summary', enabled: true },
          { name: 'detailed', enabled: false }
        ],
        excludedChecks: [101, 205, 309]
      };

      const response = await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send({ config: arrayConfig })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.config).toEqual(arrayConfig);
    });

    it('should handle deeply nested object configurations', async () => {
      const moduleId = 'aws-inspector';
      const nestedConfig = {
        aws: {
          regions: ['us-east-1', 'us-west-2'],
          credentials: {
            useInstanceProfile: true,
            roleArn: null
          }
        },
        reporting: {
          schedule: {
            enabled: true,
            frequency: 'daily',
            time: '06:00'
          },
          formats: {
            pdf: { enabled: true, includeGraphs: true },
            json: { enabled: false },
            csv: { enabled: true, delimiter: ',' }
          }
        }
      };

      const response = await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send({ config: nestedConfig })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.config).toEqual(nestedConfig);
    });

    it('should handle empty configuration object', async () => {
      const moduleId = 'compliance';
      const emptyConfig = {};

      const response = await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send({ config: emptyConfig })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.config).toEqual(emptyConfig);
    });

    it('should preserve data types in configuration', async () => {
      const moduleId = 'sbom';
      const typedConfig = {
        stringValue: 'text',
        numberValue: 42,
        floatValue: 3.14159,
        booleanTrue: true,
        booleanFalse: false,
        nullValue: null,
        arrayEmpty: [],
        arrayMixed: [1, 'two', true, null, { nested: 'object' }],
        objectEmpty: {}
      };

      const response = await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send({ config: typedConfig })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.config).toEqual(typedConfig);

      // Verify specific data types are preserved
      expect(typeof response.body.config.stringValue).toBe('string');
      expect(typeof response.body.config.numberValue).toBe('number');
      expect(typeof response.body.config.floatValue).toBe('number');
      expect(typeof response.body.config.booleanTrue).toBe('boolean');
      expect(typeof response.body.config.booleanFalse).toBe('boolean');
      expect(response.body.config.nullValue).toBeNull();
      expect(Array.isArray(response.body.config.arrayEmpty)).toBe(true);
      expect(Array.isArray(response.body.config.arrayMixed)).toBe(true);
      expect(typeof response.body.config.objectEmpty).toBe('object');
    });
  });

  describe('Request Body Validation (400 Bad Request)', () => {
    it('should return 400 when config property is missing', async () => {
      const moduleId = 'aws-inspector';

      const response = await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send({}) // Missing required 'config' property
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/config/i);
    });

    it('should return 400 when request body is empty', async () => {
      const moduleId = 'sbom';

      const response = await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send()
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 when config is null', async () => {
      const moduleId = 'compliance';

      const response = await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send({ config: null })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 when config is not an object (string)', async () => {
      const moduleId = 'aws-inspector';

      const response = await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send({ config: 'invalid-config-string' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 when config is not an object (number)', async () => {
      const moduleId = 'sbom';

      const response = await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send({ config: 123 })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 when config is not an object (array)', async () => {
      const moduleId = 'compliance';

      const response = await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send({ config: ['invalid', 'array'] })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for malformed JSON', async () => {
      const moduleId = 'aws-inspector';

      const response = await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .set('Content-Type', 'application/json')
        .send('{"config": invalid json}')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Module Not Found (404 Not Found)', () => {
    it('should return 404 when module does not exist', async () => {
      const nonExistentModuleId = 'non-existent-module';
      const validConfig = { setting: 'value' };

      const response = await request(app)
        .put(`/api/modules/${nonExistentModuleId}/config`)
        .send({ config: validConfig })
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/module not found/i);
    });

    it('should return 404 for empty moduleId', async () => {
      const emptyModuleId = '';
      const validConfig = { setting: 'value' };

      const response = await request(app)
        .put(`/api/modules/${emptyModuleId}/config`)
        .send({ config: validConfig })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for special characters in moduleId', async () => {
      const invalidModuleId = 'module@#$%';
      const validConfig = { setting: 'value' };

      const response = await request(app)
        .put(`/api/modules/${invalidModuleId}/config`)
        .send({ config: validConfig })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for path traversal attempts', async () => {
      const maliciousModuleId = '../../etc/passwd';
      const validConfig = { setting: 'value' };

      const response = await request(app)
        .put(`/api/modules/${maliciousModuleId}/config`)
        .send({ config: validConfig })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Complex Configuration Test Cases', () => {
    it('should handle large configuration objects', async () => {
      const moduleId = 'aws-inspector';
      const largeConfig = {};

      // Create a large configuration object
      for (let i = 0; i < 100; i++) {
        largeConfig[`setting${i}`] = {
          value: `value-${i}`,
          enabled: i % 2 === 0,
          metadata: {
            created: new Date().toISOString(),
            tags: [`tag-${i}`, `category-${Math.floor(i / 10)}`]
          }
        };
      }

      const response = await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send({ config: largeConfig })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.config).toEqual(largeConfig);
    });

    it('should handle configuration with special characters and unicode', async () => {
      const moduleId = 'sbom';
      const specialConfig = {
        unicode: 'Test with émojis 🚀 and special chars: äöü',
        specialChars: 'Quotes: "double" and \'single\', backslash: \\, newline: \\n',
        regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
      };

      const response = await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send({ config: specialConfig })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.config).toEqual(specialConfig);
    });
  });

  describe('Response Format Validation', () => {
    it('should return response in exact format specified by OpenAPI spec', async () => {
      const moduleId = 'compliance';
      const testConfig = { format: 'yaml', version: 2 };

      const response = await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send({ config: testConfig })
        .expect('Content-Type', /json/)
        .expect(200);

      // Verify response matches OpenAPI specification exactly
      expect(response.body).toEqual({
        success: true,
        config: testConfig
      });

      // Ensure no additional properties are returned
      expect(Object.keys(response.body)).toHaveLength(2);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('config');
    });

    it('should return error response in correct format for 400 errors', async () => {
      const moduleId = 'aws-inspector';

      const response = await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send({}) // Missing config
        .expect('Content-Type', /json/)
        .expect(400);

      // Verify error response matches OpenAPI Error schema
      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');

      // Optional properties from Error schema
      if (response.body.code) {
        expect(typeof response.body.code).toBe('string');
      }
      if (response.body.details) {
        expect(typeof response.body.details).toBe('object');
      }
    });

    it('should return error response in correct format for 404 errors', async () => {
      const moduleId = 'non-existent';
      const testConfig = { setting: 'value' };

      const response = await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send({ config: testConfig })
        .expect('Content-Type', /json/)
        .expect(404);

      // Verify error response matches OpenAPI Error schema
      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
    });
  });

  describe('Database Integration Verification', () => {
    it('should persist configuration changes in database', async () => {
      const moduleId = 'aws-inspector';
      const newConfig = { theme: 'dark', feature: 'enabled' };

      await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send({ config: newConfig })
        .expect(200);

      // Verify configuration was saved to database
      const savedConfig = await new Promise((resolve, reject) => {
        db.db.get(
          'SELECT config FROM module_settings WHERE module_id = ?',
          [moduleId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row ? JSON.parse(row.config) : null);
          }
        );
      });

      expect(savedConfig).toEqual(newConfig);
    });

    it('should update updated_at timestamp when config changes', async () => {
      const moduleId = 'sbom';
      const newConfig = { updatedSetting: 'new value' };

      // Get original timestamp
      const originalTimestamp = await new Promise((resolve, reject) => {
        db.db.get(
          'SELECT updated_at FROM module_settings WHERE module_id = ?',
          [moduleId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row?.updated_at);
          }
        );
      });

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send({ config: newConfig })
        .expect(200);

      // Get updated timestamp
      const updatedTimestamp = await new Promise((resolve, reject) => {
        db.db.get(
          'SELECT updated_at FROM module_settings WHERE module_id = ?',
          [moduleId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row?.updated_at);
          }
        );
      });

      expect(updatedTimestamp).not.toBe(originalTimestamp);
      expect(new Date(updatedTimestamp)).toBeInstanceOf(Date);
    });

    it('should not modify other module properties when updating config', async () => {
      const moduleId = 'compliance';
      const newConfig = { preserveTest: true };

      // Get original module data
      const originalModule = await new Promise((resolve, reject) => {
        db.db.get(
          'SELECT * FROM module_settings WHERE module_id = ?',
          [moduleId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      await request(app)
        .put(`/api/modules/${moduleId}/config`)
        .send({ config: newConfig })
        .expect(200);

      // Get updated module data
      const updatedModule = await new Promise((resolve, reject) => {
        db.db.get(
          'SELECT * FROM module_settings WHERE module_id = ?',
          [moduleId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      // Verify only config and updated_at changed
      expect(updatedModule.module_id).toBe(originalModule.module_id);
      expect(updatedModule.name).toBe(originalModule.name);
      expect(updatedModule.description).toBe(originalModule.description);
      expect(updatedModule.enabled).toBe(originalModule.enabled);
      expect(updatedModule.is_default).toBe(originalModule.is_default);
      expect(updatedModule.display_order).toBe(originalModule.display_order);
      expect(updatedModule.icon).toBe(originalModule.icon);
      expect(updatedModule.route).toBe(originalModule.route);
      expect(updatedModule.created_at).toBe(originalModule.created_at);

      // Config and updated_at should be different
      expect(JSON.parse(updatedModule.config)).toEqual(newConfig);
      expect(updatedModule.updated_at).not.toBe(originalModule.updated_at);
    });
  });
});