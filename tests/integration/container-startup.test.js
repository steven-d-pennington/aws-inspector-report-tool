const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

describe('Container Startup Tests', () => {
  const timeout = 60000; // 60 seconds for container operations

  describe('Docker Compose Startup', () => {
    it('should start all services successfully', async () => {
      try {
        // Start containers
        const { stdout: upOutput } = await execAsync(
          'docker compose up -d',
          { timeout }
        );

        expect(upOutput).toContain('Created');

        // Wait for services to be ready
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Check services are running
        const { stdout: psOutput } = await execAsync('docker compose ps');
        expect(psOutput).toContain('running');
        expect(psOutput).toContain('app');
        expect(psOutput).toContain('postgres');
      } catch (error) {
        throw new Error(`Container startup failed: ${error.message}`);
      }
    }, timeout);

    it('should have healthy status for application container', async () => {
      try {
        // Wait for health check to complete
        await new Promise(resolve => setTimeout(resolve, 15000));

        const { stdout } = await execAsync(
          'docker compose ps --format json'
        );

        const containers = JSON.parse(stdout);
        const appContainer = containers.find(c => c.Service === 'app');

        expect(appContainer).toBeDefined();
        expect(appContainer.State).toBe('running');
        expect(appContainer.Health).toMatch(/healthy/i);
      } catch (error) {
        // Fallback for systems without --format json
        const { stdout } = await execAsync('docker compose ps');
        expect(stdout).toContain('healthy');
      }
    }, timeout);

    it('should expose application on correct port', async () => {
      const response = await fetch('http://localhost:3000/health');
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('status');
    });

    it('should connect to PostgreSQL database', async () => {
      const { stdout } = await execAsync(
        'docker compose exec -T postgres psql -U appuser -d vulnerability_dashboard -c "SELECT 1"'
      );

      expect(stdout).toContain('1');
      expect(stdout).toContain('(1 row)');
    }, timeout);
  });

  describe('Environment Configuration', () => {
    it('should load environment variables correctly', async () => {
      const { stdout } = await execAsync(
        'docker compose exec app printenv NODE_ENV'
      );

      expect(stdout.trim()).toMatch(/development|production/);
    });

    it('should have correct database connection string', async () => {
      const { stdout } = await execAsync(
        'docker compose exec app printenv DB_HOST'
      );

      expect(stdout.trim()).toBe('postgres');
    });
  });

  describe('Container Restart', () => {
    it('should restart gracefully', async () => {
      // Stop containers
      await execAsync('docker compose stop');

      // Start containers again
      await execAsync('docker compose start');

      // Wait for services
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Check they're running
      const { stdout } = await execAsync('docker compose ps');
      expect(stdout).toContain('running');
    }, timeout);
  });

  afterAll(async () => {
    // Clean up containers after tests
    try {
      await execAsync('docker compose down');
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });
});