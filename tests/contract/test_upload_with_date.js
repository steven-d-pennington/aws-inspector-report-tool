/**
 * Contract Tests: POST /upload endpoint with reportRunDate field
 *
 * These tests validate the upload endpoint contract according to upload-endpoint.json
 * Tests MUST FAIL before implementation as per TDD principles.
 *
 * Contract Requirements:
 * - Accept reportRunDate field in multipart/form-data
 * - Validate reportRunDate format (YYYY-MM-DD)
 * - Reject future dates
 * - Reject dates more than 2 years old
 * - Return proper response format with both uploadDate and reportRunDate
 * - Return appropriate error responses for validation failures
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs').promises;

// Import the app (this will fail until server.js is properly modularized)
let app;
try {
  // For now, we'll need to create a test version of the app
  // This will fail until implementation provides proper app export
  app = require('../../server.js');
} catch (error) {
  // Expected to fail - implementation not ready
  console.warn('Server module not ready for testing:', error.message);
}

describe('Contract Tests: POST /upload with reportRunDate', () => {
  let testFilePath;

  beforeEach(async () => {
    // Create a test file for uploads
    const testReportData = JSON.stringify(global.testUtils.mockInspectorReport);
    testFilePath = await global.testUtils.createMockFile('test-report.json', testReportData);
  });

  describe('Successful Upload Scenarios', () => {
    test('should accept upload with valid reportRunDate (today)', async () => {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      const response = await request(app)
        .post('/upload')
        .field('reportRunDate', today)
        .attach('file', testFilePath)
        .expect(200);

      // Validate response structure according to contract
      expect(response.body).toMatchObject({
        success: true,
        message: 'Report uploaded and processed successfully',
        reportId: expect.any(Number),
        filename: expect.any(String),
        fileFormat: 'json',
        uploadDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        reportRunDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        vulnerabilityCount: expect.any(Number),
        awsAccountId: expect.any(String),
        processingTime: expect.any(Number)
      });

      // Verify reportRunDate matches what was sent
      const sentDate = new Date(today + 'T00:00:00.000Z');
      const returnedDate = new Date(response.body.reportRunDate);
      expect(returnedDate.toDateString()).toBe(sentDate.toDateString());
    });

    test('should accept upload with valid historical reportRunDate (1 week ago)', async () => {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const historicalDate = oneWeekAgo.toISOString().split('T')[0];

      const response = await request(app)
        .post('/upload')
        .field('reportRunDate', historicalDate)
        .attach('file', testFilePath)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.reportRunDate).toBeDefined();

      // Verify historical date is preserved
      const returnedDate = new Date(response.body.reportRunDate);
      const sentDate = new Date(historicalDate + 'T00:00:00.000Z');
      expect(returnedDate.toDateString()).toBe(sentDate.toDateString());
    });

    test('should accept upload with valid historical reportRunDate (1 year ago)', async () => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const historicalDate = oneYearAgo.toISOString().split('T')[0];

      const response = await request(app)
        .post('/upload')
        .field('reportRunDate', historicalDate)
        .attach('file', testFilePath)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.reportRunDate).toBeDefined();
    });

    test('should return different uploadDate and reportRunDate when appropriate', async () => {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const historicalDate = oneWeekAgo.toISOString().split('T')[0];

      const response = await request(app)
        .post('/upload')
        .field('reportRunDate', historicalDate)
        .attach('file', testFilePath)
        .expect(200);

      const uploadDate = new Date(response.body.uploadDate);
      const reportRunDate = new Date(response.body.reportRunDate);

      // Upload date should be recent (within last minute)
      const now = new Date();
      expect(now.getTime() - uploadDate.getTime()).toBeLessThan(60000);

      // Report run date should be the historical date
      const sentDate = new Date(historicalDate + 'T00:00:00.000Z');
      expect(reportRunDate.toDateString()).toBe(sentDate.toDateString());
    });
  });

  describe('Date Validation Error Scenarios', () => {
    test('should reject upload with missing reportRunDate', async () => {
      const response = await request(app)
        .post('/upload')
        .attach('file', testFilePath)
        .expect(400);

      // Validate error response according to contract
      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed',
        details: 'Report run date is required',
        field: 'reportRunDate'
      });
    });

    test('should reject upload with future reportRunDate', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const response = await request(app)
        .post('/upload')
        .field('reportRunDate', futureDateStr)
        .attach('file', testFilePath)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed',
        details: 'Report run date cannot be in the future',
        field: 'reportRunDate'
      });
    });

    test('should reject upload with reportRunDate more than 2 years old', async () => {
      const tooOldDate = new Date();
      tooOldDate.setFullYear(tooOldDate.getFullYear() - 3);
      const tooOldDateStr = tooOldDate.toISOString().split('T')[0];

      const response = await request(app)
        .post('/upload')
        .field('reportRunDate', tooOldDateStr)
        .attach('file', testFilePath)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed',
        details: 'Report run date cannot be more than 2 years old',
        field: 'reportRunDate'
      });
    });

    test('should reject upload with invalid reportRunDate format', async () => {
      const invalidFormats = ['2025-13-01', '2025/09/18', '09-18-2025', '2025-9-1', 'invalid-date'];

      for (const invalidDate of invalidFormats) {
        const response = await request(app)
          .post('/upload')
          .field('reportRunDate', invalidDate)
          .attach('file', testFilePath)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Validation failed',
          details: 'Date must be in YYYY-MM-DD format',
          field: 'reportRunDate'
        });
      }
    });

    test('should reject upload with empty reportRunDate', async () => {
      const response = await request(app)
        .post('/upload')
        .field('reportRunDate', '')
        .attach('file', testFilePath)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed',
        details: 'Report run date is required',
        field: 'reportRunDate'
      });
    });
  });

  describe('File Format Compatibility', () => {
    test('should accept CSV file with valid reportRunDate', async () => {
      // Create a mock CSV file
      const csvContent = `Finding ARN,AWS Account ID,Description,Severity,Status,Title,Type,Updated At,First Observed At,Last Observed At,CVE ID,CVSS Base Score,Remediation Recommendation,Resource ID,Resource Type
arn:aws:inspector2:us-east-1:123456789012:finding/example1,123456789012,Test vulnerability,HIGH,ACTIVE,Test Vulnerability,PACKAGE_VULNERABILITY,2025-09-18T00:00:00.000Z,2025-09-15T00:00:00.000Z,2025-09-18T00:00:00.000Z,CVE-2023-1234,7.5,Update package,i-1234567890abcdef0,AwsEc2Instance`;

      const csvFilePath = await global.testUtils.createMockFile('test-report.csv', csvContent);
      const today = new Date().toISOString().split('T')[0];

      const response = await request(app)
        .post('/upload')
        .field('reportRunDate', today)
        .attach('file', csvFilePath)
        .expect(200);

      expect(response.body.fileFormat).toBe('csv');
      expect(response.body.reportRunDate).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    test('should handle reportRunDate at exactly 2 years boundary', async () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      twoYearsAgo.setDate(twoYearsAgo.getDate() + 1); // Just within 2 years
      const boundaryDate = twoYearsAgo.toISOString().split('T')[0];

      const response = await request(app)
        .post('/upload')
        .field('reportRunDate', boundaryDate)
        .attach('file', testFilePath)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should handle leap year dates correctly', async () => {
      // Test with February 29 on a leap year (if current year is leap year)
      const currentYear = new Date().getFullYear();
      const isLeapYear = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);

      if (isLeapYear) {
        const leapDate = `${currentYear}-02-29`;

        const response = await request(app)
          .post('/upload')
          .field('reportRunDate', leapDate)
          .attach('file', testFilePath)
          .expect(200);

        expect(response.body.success).toBe(true);
      }
    });
  });
});

// These tests should fail until implementation is complete
describe('Implementation Status Check', () => {
  test('server should export app for testing', () => {
    // This test documents that we need proper app export for testing
    expect(app).toBeDefined();
    expect(typeof app).toBe('object');
  });
});