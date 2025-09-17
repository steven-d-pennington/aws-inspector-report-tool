const request = require('supertest');
const express = require('express');
const path = require('path');
const { expect } = require('chai');

// Import the server application
// Note: We'll need to refactor server.js to export the app for testing
const serverPath = path.join(__dirname, '../../server.js');

describe('GET /api/modules/{moduleId}/config - Contract Tests', () => {
  let app;
  let server;

  before(async () => {
    // For now, create a minimal Express app to test against
    // This will need to be updated once the actual endpoint is implemented
    app = express();
    app.use(express.json());

    // Mock implementation that will be replaced with actual implementation
    // This is intentionally minimal to make tests fail initially (TDD approach)
    app.get('/api/modules/:moduleId/config', (req, res) => {
      // This will be replaced with actual implementation
      // For now, return 404 to make tests fail (TDD approach)
      res.status(404).json({
        error: "Module configuration endpoint not implemented",
        code: "NOT_IMPLEMENTED"
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('Contract validation against OpenAPI specification', () => {
    it('should return 200 with valid config object for existing module', async () => {
      const moduleId = 'aws-inspector';

      const response = await request(app)
        .get(`/api/modules/${moduleId}/config`)
        .expect('Content-Type', /json/);

      // This test will FAIL initially as endpoint returns 404 (TDD approach)
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('config');
      expect(response.body.config).to.be.an('object');

      // Validate schema matches OpenAPI spec:
      // Response should have 'config' property that is an object with additionalProperties: true
      expect(response.body).to.deep.include({
        config: response.body.config
      });
    });

    it('should return 404 for non-existent module', async () => {
      const nonExistentModuleId = 'non-existent-module';

      const response = await request(app)
        .get(`/api/modules/${nonExistentModuleId}/config`)
        .expect('Content-Type', /json/);

      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.be.a('string');

      // Validate error schema matches OpenAPI spec
      expect(response.body).to.have.property('error').that.is.a('string');

      // Optional properties according to Error schema
      if (response.body.code) {
        expect(response.body.code).to.be.a('string');
      }
      if (response.body.details) {
        expect(response.body.details).to.be.an('object');
      }
    });

    it('should handle various module ID formats', async () => {
      const testModuleIds = [
        'aws-inspector',
        'sbom',
        'test-module-123',
        'module_with_underscores',
        'ModuleWithCamelCase'
      ];

      for (const moduleId of testModuleIds) {
        const response = await request(app)
          .get(`/api/modules/${moduleId}/config`)
          .expect('Content-Type', /json/);

        // Should return either 200 with config or 404 with error
        expect([200, 404]).to.include(response.status);

        if (response.status === 200) {
          expect(response.body).to.have.property('config');
          expect(response.body.config).to.be.an('object');
        } else {
          expect(response.body).to.have.property('error');
          expect(response.body.error).to.be.a('string');
        }
      }
    });

    it('should return empty object for module with no configuration', async () => {
      // This test assumes a module exists but has no specific configuration
      const moduleId = 'empty-config-module';

      const response = await request(app)
        .get(`/api/modules/${moduleId}/config`)
        .expect('Content-Type', /json/);

      // This will FAIL initially (TDD approach)
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('config');
      expect(response.body.config).to.deep.equal({});
    });

    it('should support config with any JSON structure (additionalProperties: true)', async () => {
      const moduleId = 'aws-inspector';

      const response = await request(app)
        .get(`/api/modules/${moduleId}/config`)
        .expect('Content-Type', /json/);

      // This will FAIL initially (TDD approach)
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('config');

      const { config } = response.body;

      // Config can be any JSON structure (additionalProperties: true in OpenAPI spec)
      // Test various possible structures:

      if (Object.keys(config).length > 0) {
        // If config has properties, validate they can be any type
        Object.values(config).forEach(value => {
          expect(['string', 'number', 'boolean', 'object']).to.include(typeof value);
        });
      }

      // Examples of valid config structures according to spec:
      const validConfigExamples = [
        {},
        { apiUrl: "https://api.example.com" },
        { settings: { timeout: 5000, retries: 3 } },
        { features: ["feature1", "feature2"] },
        { metadata: { version: "1.0.0", enabled: true } }
      ];

      // Config should be a valid object (any of these structures would be valid)
      expect(config).to.be.an('object');
    });

    it('should validate response headers', async () => {
      const moduleId = 'aws-inspector';

      const response = await request(app)
        .get(`/api/modules/${moduleId}/config`);

      // Should return JSON content type
      expect(response.headers['content-type']).to.match(/application\/json/);
    });

    it('should handle URL encoding in module ID', async () => {
      const encodedModuleId = encodeURIComponent('module-with-special-chars!@#');

      const response = await request(app)
        .get(`/api/modules/${encodedModuleId}/config`)
        .expect('Content-Type', /json/);

      // Should handle encoded URLs properly
      expect([200, 404]).to.include(response.status);
    });

    it('should validate request method is GET only', async () => {
      const moduleId = 'aws-inspector';

      // Test that other HTTP methods are not allowed (if not implemented)
      const postResponse = await request(app)
        .post(`/api/modules/${moduleId}/config`)
        .send({});

      // Should return 404 or 405 for unsupported methods
      expect([404, 405]).to.include(postResponse.status);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty module ID gracefully', async () => {
      const response = await request(app)
        .get('/api/modules//config');

      // Should return appropriate error for malformed URL
      expect([400, 404]).to.include(response.status);
    });

    it('should handle special characters in module ID', async () => {
      const specialCharsModuleId = 'module@#$%^&*()';

      const response = await request(app)
        .get(`/api/modules/${encodeURIComponent(specialCharsModuleId)}/config`)
        .expect('Content-Type', /json/);

      // Should handle special characters appropriately
      expect([200, 404, 400]).to.include(response.status);
    });

    it('should handle very long module ID', async () => {
      const longModuleId = 'a'.repeat(1000);

      const response = await request(app)
        .get(`/api/modules/${longModuleId}/config`);

      // Should handle long IDs appropriately (could be 404, 400, or 414)
      expect([200, 400, 404, 414]).to.include(response.status);
    });
  });

  describe('Performance and reliability', () => {
    it('should respond within reasonable time', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/api/modules/aws-inspector/config');

      const responseTime = Date.now() - startTime;

      // Should respond within 5 seconds (adjust as needed)
      expect(responseTime).to.be.below(5000);
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        request(app).get(`/api/modules/test-module-${i}/config`)
      );

      const responses = await Promise.all(requests);

      // All requests should complete successfully
      responses.forEach(response => {
        expect([200, 404]).to.include(response.status);
      });
    });
  });
});