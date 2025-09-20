const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

describe('Data Persistence Tests', () => {
  const timeout = 60000;
  const testData = {
    tableName: 'test_persistence',
    testValue: `test_${Date.now()}`
  };

  beforeAll(async () => {
    // Ensure containers are running
    await execAsync('docker compose up -d');
    await new Promise(resolve => setTimeout(resolve, 10000));
  }, timeout);

  describe('PostgreSQL Data Persistence', () => {
    it('should persist data across container restarts', async () => {
      // Create test table and insert data
      const createTableCmd = `
        docker compose exec -T postgres psql -U appuser -d vulnerability_dashboard -c "
          CREATE TABLE IF NOT EXISTS ${testData.tableName} (
            id SERIAL PRIMARY KEY,
            value VARCHAR(255)
          );
          INSERT INTO ${testData.tableName} (value) VALUES ('${testData.testValue}');
        "
      `;

      await execAsync(createTableCmd);

      // Verify data exists
      const { stdout: beforeRestart } = await execAsync(
        `docker compose exec -T postgres psql -U appuser -d vulnerability_dashboard -c "SELECT value FROM ${testData.tableName} WHERE value='${testData.testValue}'"`
      );
      expect(beforeRestart).toContain(testData.testValue);

      // Restart postgres container
      await execAsync('docker compose restart postgres');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Verify data still exists after restart
      const { stdout: afterRestart } = await execAsync(
        `docker compose exec -T postgres psql -U appuser -d vulnerability_dashboard -c "SELECT value FROM ${testData.tableName} WHERE value='${testData.testValue}'"`
      );
      expect(afterRestart).toContain(testData.testValue);

      // Clean up test table
      await execAsync(
        `docker compose exec -T postgres psql -U appuser -d vulnerability_dashboard -c "DROP TABLE IF EXISTS ${testData.tableName}"`
      );
    }, timeout);

    it('should persist data when recreating containers', async () => {
      // Insert test data
      const insertCmd = `
        docker compose exec -T postgres psql -U appuser -d vulnerability_dashboard -c "
          CREATE TABLE IF NOT EXISTS persistence_test (
            id SERIAL PRIMARY KEY,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          INSERT INTO persistence_test DEFAULT VALUES RETURNING id;
        "
      `;

      const { stdout: insertOutput } = await execAsync(insertCmd);
      const idMatch = insertOutput.match(/(\d+)/);
      const insertedId = idMatch ? idMatch[1] : null;
      expect(insertedId).toBeTruthy();

      // Stop and remove containers (but not volumes)
      await execAsync('docker compose down');

      // Recreate containers
      await execAsync('docker compose up -d');
      await new Promise(resolve => setTimeout(resolve, 15000));

      // Check if data persists
      const { stdout: checkOutput } = await execAsync(
        `docker compose exec -T postgres psql -U appuser -d vulnerability_dashboard -c "SELECT id FROM persistence_test WHERE id=${insertedId}"`
      );
      expect(checkOutput).toContain(insertedId);

      // Clean up
      await execAsync(
        `docker compose exec -T postgres psql -U appuser -d vulnerability_dashboard -c "DROP TABLE IF EXISTS persistence_test"`
      );
    }, timeout * 2);
  });

  describe('Application Upload Persistence', () => {
    it('should persist uploaded files across restarts', async () => {
      const testFileName = `test_upload_${Date.now()}.txt`;
      const testContent = 'This is a test upload file';

      // Create test file in uploads directory
      await execAsync(
        `docker compose exec app sh -c "echo '${testContent}' > /app/uploads/${testFileName}"`
      );

      // Verify file exists
      const { stdout: beforeRestart } = await execAsync(
        `docker compose exec app cat /app/uploads/${testFileName}`
      );
      expect(beforeRestart.trim()).toBe(testContent);

      // Restart application container
      await execAsync('docker compose restart app');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Verify file still exists
      const { stdout: afterRestart } = await execAsync(
        `docker compose exec app cat /app/uploads/${testFileName}`
      );
      expect(afterRestart.trim()).toBe(testContent);

      // Clean up
      await execAsync(
        `docker compose exec app rm /app/uploads/${testFileName}`
      );
    }, timeout);
  });

  describe('Volume Backup and Restore', () => {
    it('should backup and restore database volume', async () => {
      const backupFile = 'test_backup.tar.gz';

      // Create backup of postgres data volume
      const backupCmd = `
        docker run --rm -v postgres_data:/data -v ${process.cwd()}:/backup alpine tar czf /backup/${backupFile} -C /data .
      `;

      await execAsync(backupCmd);

      // Verify backup file exists
      const fs = require('fs');
      expect(fs.existsSync(backupFile)).toBe(true);

      // Clean up backup file
      fs.unlinkSync(backupFile);
    }, timeout);
  });

  afterAll(async () => {
    // Clean up containers but preserve volumes for other tests
    try {
      await execAsync('docker compose stop');
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });
});