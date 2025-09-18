// Test setup file for Jest
const path = require('path');
const fs = require('fs').promises;

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_PATH = ':memory:'; // Use in-memory SQLite for tests

// Global test utilities
global.testUtils = {
  // Helper to create mock files for upload tests
  createMockFile: async (filename, content) => {
    const tempDir = path.join(__dirname, 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    const filePath = path.join(tempDir, filename);
    await fs.writeFile(filePath, content);
    return filePath;
  },

  // Helper to clean up test files
  cleanupTempFiles: async () => {
    const tempDir = path.join(__dirname, 'temp');
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors if directory doesn't exist
    }
  },

  // Mock AWS Inspector report data
  mockInspectorReport: {
    findings: [
      {
        findingArn: "arn:aws:inspector2:us-east-1:123456789012:finding/example1",
        awsAccountId: "123456789012",
        description: "Test vulnerability description",
        packageVulnerabilityDetails: {
          cvss: {
            baseScore: 7.5,
            scoringVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N"
          },
          vulnerabilityId: "CVE-2023-1234"
        },
        remediation: {
          recommendation: {
            text: "Update package to latest version"
          }
        },
        resources: [{
          id: "i-1234567890abcdef0",
          type: "AwsEc2Instance"
        }],
        severity: "HIGH",
        status: "ACTIVE",
        title: "Test Vulnerability",
        type: "PACKAGE_VULNERABILITY",
        updatedAt: "2025-09-18T00:00:00.000Z",
        firstObservedAt: "2025-09-15T00:00:00.000Z",
        lastObservedAt: "2025-09-18T00:00:00.000Z"
      }
    ]
  }
};

// Setup and teardown for each test
beforeEach(async () => {
  // Clear any temporary files before each test
  await global.testUtils.cleanupTempFiles();
});

afterEach(async () => {
  // Clean up after each test
  await global.testUtils.cleanupTempFiles();
});

// Add a simple test to prevent Jest from failing on empty test file
test('test setup configured correctly', () => {
  expect(global.testUtils).toBeDefined();
  expect(global.testUtils.mockInspectorReport).toBeDefined();
});