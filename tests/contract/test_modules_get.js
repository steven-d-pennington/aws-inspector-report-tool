const request = require('supertest');
const { expect } = require('chai');
const path = require('path');

// Import the Express app
const app = require('../../server.js');

describe('GET /api/modules - Contract Tests', function() {
  this.timeout(10000); // 10 second timeout for all tests

  describe('API Contract Validation', function() {

    it('should return 200 status for successful request', async function() {
      const response = await request(app)
        .get('/api/modules')
        .expect('Content-Type', /json/);

      expect(response.status).to.equal(200);
    });

    it('should return response matching OpenAPI schema structure', async function() {
      const response = await request(app)
        .get('/api/modules')
        .expect(200);

      // Validate top-level response structure
      expect(response.body).to.be.an('object');
      expect(response.body).to.have.property('modules');
      expect(response.body.modules).to.be.an('array');
    });

    it('should return modules array with Module objects having required fields', async function() {
      const response = await request(app)
        .get('/api/modules')
        .expect(200);

      const { modules } = response.body;

      // Each module must have required fields according to OpenAPI spec
      modules.forEach((module, index) => {
        expect(module, `Module at index ${index}`).to.be.an('object');

        // Required fields from OpenAPI schema
        expect(module, `Module at index ${index} missing module_id`).to.have.property('module_id');
        expect(module.module_id, `Module at index ${index} module_id should be string`).to.be.a('string');

        expect(module, `Module at index ${index} missing name`).to.have.property('name');
        expect(module.name, `Module at index ${index} name should be string`).to.be.a('string');

        expect(module, `Module at index ${index} missing enabled`).to.have.property('enabled');
        expect(module.enabled, `Module at index ${index} enabled should be boolean`).to.be.a('boolean');
      });
    });

    it('should include optional fields when present with correct types', async function() {
      const response = await request(app)
        .get('/api/modules')
        .expect(200);

      const { modules } = response.body;

      modules.forEach((module, index) => {
        // Optional fields - check type if present
        if (module.hasOwnProperty('description')) {
          expect(module.description, `Module at index ${index} description should be string`).to.be.a('string');
        }

        if (module.hasOwnProperty('is_default')) {
          expect(module.is_default, `Module at index ${index} is_default should be boolean`).to.be.a('boolean');
        }

        if (module.hasOwnProperty('display_order')) {
          expect(module.display_order, `Module at index ${index} display_order should be number`).to.be.a('number');
        }

        if (module.hasOwnProperty('config')) {
          expect(module.config, `Module at index ${index} config should be object`).to.be.an('object');
        }

        if (module.hasOwnProperty('icon')) {
          expect(module.icon, `Module at index ${index} icon should be string`).to.be.a('string');
        }

        if (module.hasOwnProperty('route')) {
          expect(module.route, `Module at index ${index} route should be string`).to.be.a('string');
        }

        if (module.hasOwnProperty('created_at')) {
          expect(module.created_at, `Module at index ${index} created_at should be string`).to.be.a('string');
          // Validate ISO 8601 date format
          expect(() => new Date(module.created_at).toISOString()).to.not.throw();
        }

        if (module.hasOwnProperty('updated_at')) {
          expect(module.updated_at, `Module at index ${index} updated_at should be string`).to.be.a('string');
          // Validate ISO 8601 date format
          expect(() => new Date(module.updated_at).toISOString()).to.not.throw();
        }
      });
    });

    it('should include default modules with correct configuration', async function() {
      const response = await request(app)
        .get('/api/modules')
        .expect(200);

      const { modules } = response.body;

      // Find aws-inspector module (should be enabled and default)
      const awsInspectorModule = modules.find(m => m.module_id === 'aws-inspector');
      expect(awsInspectorModule, 'aws-inspector module should be present').to.exist;
      expect(awsInspectorModule.enabled, 'aws-inspector should be enabled').to.be.true;
      expect(awsInspectorModule.is_default, 'aws-inspector should be default').to.be.true;
      expect(awsInspectorModule.name, 'aws-inspector should have correct name').to.equal('AWS Inspector');

      // Find SBOM module (should be disabled)
      const sbomModule = modules.find(m => m.module_id === 'sbom');
      expect(sbomModule, 'sbom module should be present').to.exist;
      expect(sbomModule.enabled, 'sbom should be disabled').to.be.false;
      expect(sbomModule.name, 'sbom should have correct name').to.equal('SBOM Reports');
    });

    it('should return modules in display order when display_order is specified', async function() {
      const response = await request(app)
        .get('/api/modules')
        .expect(200);

      const { modules } = response.body;

      // Filter modules that have display_order
      const modulesWithOrder = modules.filter(m => m.hasOwnProperty('display_order'));

      if (modulesWithOrder.length > 1) {
        // Check that modules are ordered by display_order
        for (let i = 1; i < modulesWithOrder.length; i++) {
          expect(modulesWithOrder[i].display_order)
            .to.be.at.least(modulesWithOrder[i - 1].display_order,
              'Modules should be ordered by display_order');
        }
      }
    });

    it('should validate exact schema compliance with OpenAPI specification', async function() {
      const response = await request(app)
        .get('/api/modules')
        .expect(200);

      const { modules } = response.body;

      // Validate the response matches the exact OpenAPI example structure
      modules.forEach((module, index) => {
        // Check that module doesn't have unexpected properties
        const allowedProperties = [
          'module_id', 'name', 'description', 'enabled', 'is_default',
          'display_order', 'config', 'icon', 'route', 'created_at', 'updated_at'
        ];

        Object.keys(module).forEach(key => {
          expect(allowedProperties).to.include(key,
            `Module at index ${index} has unexpected property: ${key}`);
        });
      });
    });

    it('should return non-empty modules array', async function() {
      const response = await request(app)
        .get('/api/modules')
        .expect(200);

      const { modules } = response.body;
      expect(modules.length).to.be.at.least(1, 'Should return at least one module');
    });

    it('should return unique module_id values', async function() {
      const response = await request(app)
        .get('/api/modules')
        .expect(200);

      const { modules } = response.body;
      const moduleIds = modules.map(m => m.module_id);
      const uniqueModuleIds = [...new Set(moduleIds)];

      expect(uniqueModuleIds.length).to.equal(moduleIds.length,
        'All module_id values should be unique');
    });
  });

  describe('Error Handling', function() {
    it('should return proper Content-Type header', async function() {
      const response = await request(app)
        .get('/api/modules');

      expect(response.headers['content-type']).to.match(/application\/json/);
    });

    it('should handle malformed requests gracefully', async function() {
      // Test with invalid query parameters
      const response = await request(app)
        .get('/api/modules?invalid=malformed')
        .expect(200);

      // Should still return valid response structure
      expect(response.body).to.have.property('modules');
      expect(response.body.modules).to.be.an('array');
    });
  });
});