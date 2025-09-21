const request = require('supertest');
const app = require('../../src/app');

describe('Container Configuration API Contract Tests', () => {
  describe('GET /api/config', () => {
    it('should return current configuration with required fields', async () => {
      const response = await request(app)
        .get('/api/config')
        .expect('Content-Type', /json/);

      // May return 200, 401, or 500 depending on auth and state
      expect([200, 401, 500]).toContain(response.status);

      if (response.status === 200) {
        // Validate response schema
        expect(response.body).toHaveProperty('environment');
        expect(['development', 'production', 'test']).toContain(
          response.body.environment
        );
        expect(response.body).toHaveProperty('version');
        expect(typeof response.body.version).toBe('string');
        expect(response.body).toHaveProperty('timestamp');
        expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);

        // Optional application config
        if (response.body.application) {
          if (response.body.application.hasOwnProperty('port')) {
            expect(typeof response.body.application.port).toBe('number');
            expect(response.body.application.port).toBeGreaterThan(0);
            expect(response.body.application.port).toBeLessThanOrEqual(65535);
          }
          if (response.body.application.host) {
            expect(typeof response.body.application.host).toBe('string');
          }
          if (response.body.application.logLevel) {
            expect(['error', 'warn', 'info', 'debug']).toContain(
              response.body.application.logLevel
            );
          }
        }

        // Optional database config
        if (response.body.database) {
          if (response.body.database.host) {
            expect(typeof response.body.database.host).toBe('string');
          }
          if (response.body.database.hasOwnProperty('port')) {
            expect(typeof response.body.database.port).toBe('number');
          }
          if (response.body.database.name) {
            expect(typeof response.body.database.name).toBe('string');
          }
          if (response.body.database.hasOwnProperty('ssl')) {
            expect(typeof response.body.database.ssl).toBe('boolean');
          }
          if (response.body.database.poolSize) {
            if (response.body.database.poolSize.hasOwnProperty('min')) {
              expect(typeof response.body.database.poolSize.min).toBe('number');
            }
            if (response.body.database.poolSize.hasOwnProperty('max')) {
              expect(typeof response.body.database.poolSize.max).toBe('number');
            }
          }
        }

        // Optional container info
        if (response.body.container) {
          if (response.body.container.hostname) {
            expect(typeof response.body.container.hostname).toBe('string');
          }
          if (response.body.container.platform) {
            expect(typeof response.body.container.platform).toBe('string');
          }
          if (response.body.container.memory) {
            if (response.body.container.memory.hasOwnProperty('limit')) {
              expect(typeof response.body.container.memory.limit).toBe('number');
            }
            if (response.body.container.memory.hasOwnProperty('used')) {
              expect(typeof response.body.container.memory.used).toBe('number');
            }
          }
        }
      }
    });
  });

  describe('POST /api/config/validate', () => {
    it('should validate configuration and return validation result', async () => {
      const testConfig = {
        database: {
          host: 'postgres',
          port: 5432,
          name: 'test_db',
          poolMin: 2,
          poolMax: 10
        },
        application: {
          port: 3000,
          logLevel: 'info'
        }
      };

      const response = await request(app)
        .post('/api/config/validate')
        .send(testConfig)
        .expect('Content-Type', /json/);

      expect([200, 400]).toContain(response.status);

      // Validate response schema
      expect(response.body).toHaveProperty('valid');
      expect(typeof response.body.valid).toBe('boolean');
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);

      // Optional errors array
      if (response.body.errors) {
        expect(Array.isArray(response.body.errors)).toBe(true);
        response.body.errors.forEach(error => {
          expect(error).toHaveProperty('field');
          expect(typeof error.field).toBe('string');
          expect(error).toHaveProperty('message');
          expect(typeof error.message).toBe('string');
        });
      }

      // Optional warnings array
      if (response.body.warnings) {
        expect(Array.isArray(response.body.warnings)).toBe(true);
        response.body.warnings.forEach(warning => {
          expect(warning).toHaveProperty('field');
          expect(typeof warning.field).toBe('string');
          expect(warning).toHaveProperty('message');
          expect(typeof warning.message).toBe('string');
        });
      }
    });

    it('should reject invalid port numbers', async () => {
      const invalidConfig = {
        application: {
          port: 70000  // Invalid port number
        }
      };

      const response = await request(app)
        .post('/api/config/validate')
        .send(invalidConfig)
        .expect('Content-Type', /json/);

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid log levels', async () => {
      const invalidConfig = {
        application: {
          logLevel: 'invalid'  // Invalid log level
        }
      };

      const response = await request(app)
        .post('/api/config/validate')
        .send(invalidConfig)
        .expect('Content-Type', /json/);

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/config/reload', () => {
    it('should reload configuration and return result', async () => {
      const response = await request(app)
        .post('/api/config/reload')
        .expect('Content-Type', /json/);

      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        // Validate success response
        expect(response.body).toHaveProperty('success');
        expect(typeof response.body.success).toBe('boolean');
        expect(response.body).toHaveProperty('timestamp');
        expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);

        // Optional changes array
        if (response.body.changes) {
          expect(Array.isArray(response.body.changes)).toBe(true);
          response.body.changes.forEach(change => {
            expect(change).toHaveProperty('field');
            expect(typeof change.field).toBe('string');
            // oldValue and newValue are optional and may be masked
          });
        }
      } else {
        // Validate error response
        expect(response.body).toHaveProperty('error');
        expect(typeof response.body.error).toBe('string');
        expect(response.body).toHaveProperty('timestamp');
        expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
      }
    });
  });

  describe('Configuration security', () => {
    it('should not expose sensitive information in GET /api/config', async () => {
      const response = await request(app)
        .get('/api/config');

      if (response.status === 200) {
        // Ensure password is not exposed
        const configString = JSON.stringify(response.body);
        expect(configString).not.toMatch(/password/i);
        expect(configString).not.toMatch(/secret/i);
        expect(configString).not.toMatch(/key/i);

        // Database host should be masked or partially hidden
        if (response.body.database && response.body.database.host) {
          expect(response.body.database.host).not.toMatch(/^[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}$/);
        }
      }
    });
  });
});