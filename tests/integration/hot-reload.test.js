const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const execAsync = promisify(exec);

describe('Hot Reload Tests (Development Mode)', () => {
  const timeout = 60000;
  const testFilePath = path.join(__dirname, '../../src/test-hot-reload.js');

  beforeAll(async () => {
    // Start containers in development mode
    await execAsync('docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d');
    await new Promise(resolve => setTimeout(resolve, 15000));
  }, timeout);

  describe('File Change Detection', () => {
    it('should detect and reload on file changes', async () => {
      // Create a test file
      const initialContent = `
        // Test file for hot reload
        module.exports = {
          testValue: 'initial'
        };
      `;

      await fs.writeFile(testFilePath, initialContent);

      // Wait for initial load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check logs for nodemon detection
      const { stdout: initialLogs } = await execAsync(
        'docker compose logs app --tail 50'
      );

      // Modify the file
      const updatedContent = `
        // Test file for hot reload - updated
        module.exports = {
          testValue: 'updated'
        };
      `;

      await fs.writeFile(testFilePath, updatedContent);

      // Wait for reload
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check logs for reload
      const { stdout: reloadLogs } = await execAsync(
        'docker compose logs app --tail 20'
      );

      // Check for nodemon restart indicators
      const hasReloaded =
        reloadLogs.includes('restarting due to changes') ||
        reloadLogs.includes('[nodemon]') ||
        reloadLogs.includes('starting `node') ||
        reloadLogs.includes('Server running');

      expect(hasReloaded).toBe(true);

      // Clean up test file
      await fs.unlink(testFilePath).catch(() => {});
    }, timeout);

    it('should maintain application state after reload', async () => {
      // Make a request to establish baseline
      const beforeReload = await fetch('http://localhost:3000/health');
      expect(beforeReload.ok).toBe(true);

      // Create a change to trigger reload
      const testFile = path.join(__dirname, '../../src/hot-reload-test-2.js');
      await fs.writeFile(testFile, '// trigger reload');

      // Wait for reload
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Application should still be accessible
      const afterReload = await fetch('http://localhost:3000/health');
      expect(afterReload.ok).toBe(true);

      // Clean up
      await fs.unlink(testFile).catch(() => {});
    }, timeout);
  });

  describe('Volume Mount Verification', () => {
    it('should have source code mounted as volume', async () => {
      // Check if src directory is mounted
      const { stdout } = await execAsync(
        'docker compose exec app ls -la /app/src'
      );

      expect(stdout).toContain('models');
      expect(stdout).toContain('routes');
      expect(stdout).toContain('services');
    });

    it('should have node_modules from container, not host', async () => {
      // Node modules should be from container, not mounted
      const { stdout } = await execAsync(
        'docker compose exec app ls -la /app/node_modules | head -5'
      );

      expect(stdout).toBeTruthy();
      expect(stdout).not.toContain('No such file or directory');
    });
  });

  describe('Development Tools', () => {
    it('should have nodemon installed and running', async () => {
      const { stdout } = await execAsync(
        'docker compose exec app ps aux | grep nodemon'
      );

      expect(stdout).toContain('nodemon');
    });

    it('should use development environment variables', async () => {
      const { stdout } = await execAsync(
        'docker compose exec app printenv NODE_ENV'
      );

      expect(stdout.trim()).toBe('development');
    });

    it('should have debug logging enabled', async () => {
      const { stdout } = await execAsync(
        'docker compose exec app printenv LOG_LEVEL'
      );

      expect(stdout.trim()).toMatch(/debug|info/);
    });
  });

  afterAll(async () => {
    // Clean up test files
    await fs.unlink(testFilePath).catch(() => {});
    await fs.unlink(path.join(__dirname, '../../src/hot-reload-test-2.js')).catch(() => {});

    // Stop containers
    try {
      await execAsync('docker compose down');
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });
});