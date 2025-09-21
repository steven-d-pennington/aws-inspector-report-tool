const request = require('supertest');
const app = require('../../src/app');

describe('Health Check API Contract Tests', () => {
  describe('GET /health', () => {
    it('should return health status with required fields', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);

      // Status can be 200 or 503 depending on health
      expect([200, 503]).toContain(response.status);

      // Validate response schema
      expect(response.body).toHaveProperty('status');
      expect(['healthy', 'unhealthy']).toContain(response.body.status);
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);

      // Optional checks object
      if (response.body.checks) {
        if (response.body.checks.database) {
          expect(['connected', 'disconnected', 'error']).toContain(
            response.body.checks.database
          );
        }
        if (response.body.checks.memory) {
          expect(['ok', 'warning', 'critical']).toContain(
            response.body.checks.memory
          );
        }
        if (response.body.checks.disk) {
          expect(['ok', 'warning', 'critical']).toContain(
            response.body.checks.disk
          );
        }
      }
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status with required fields', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect('Content-Type', /json/);

      expect([200, 503]).toContain(response.status);

      // Validate response schema
      expect(response.body).toHaveProperty('ready');
      expect(typeof response.body.ready).toBe('boolean');
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);

      // Optional checks
      if (response.body.checks) {
        if (response.body.checks.hasOwnProperty('database')) {
          expect(typeof response.body.checks.database).toBe('boolean');
        }
        if (response.body.checks.hasOwnProperty('migrations')) {
          expect(typeof response.body.checks.migrations).toBe('boolean');
        }
        if (response.body.checks.hasOwnProperty('cache')) {
          expect(typeof response.body.checks.cache).toBe('boolean');
        }
      }

      // Optional message
      if (response.body.message) {
        expect(typeof response.body.message).toBe('string');
      }
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness status with required fields', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect('Content-Type', /json/);

      expect([200, 503]).toContain(response.status);

      // Validate response schema
      expect(response.body).toHaveProperty('alive');
      expect(typeof response.body.alive).toBe('boolean');
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);

      // Optional uptime
      if (response.body.hasOwnProperty('uptime')) {
        expect(typeof response.body.uptime).toBe('number');
        expect(response.body.uptime).toBeGreaterThanOrEqual(0);
      }

      // Optional memory object
      if (response.body.memory) {
        if (response.body.memory.hasOwnProperty('used')) {
          expect(typeof response.body.memory.used).toBe('number');
          expect(response.body.memory.used).toBeGreaterThanOrEqual(0);
        }
        if (response.body.memory.hasOwnProperty('limit')) {
          expect(typeof response.body.memory.limit).toBe('number');
          expect(response.body.memory.limit).toBeGreaterThan(0);
        }
        if (response.body.memory.hasOwnProperty('percentage')) {
          expect(typeof response.body.memory.percentage).toBe('number');
          expect(response.body.memory.percentage).toBeGreaterThanOrEqual(0);
          expect(response.body.memory.percentage).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  describe('Health check response time', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();

      await request(app).get('/health');

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });

  describe('Health check availability', () => {
    it('should handle concurrent health check requests', async () => {
      const requests = Array(10).fill().map(() =>
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect([200, 503]).toContain(response.status);
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('timestamp');
      });
    });
  });
});