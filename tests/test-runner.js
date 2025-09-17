#!/usr/bin/env node

/**
 * Simple test runner for contract tests
 * This can be used when npm/mocha dependencies have issues
 */

const express = require('express');
const http = require('http');

console.log('=== Contract Test Runner ===');
console.log('Testing GET /api/modules/{moduleId}/config endpoint');
console.log('');

// Create a minimal Express app that mimics the current server behavior
const app = express();
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

const server = app.listen(0, () => {
  const port = server.address().port;
  console.log(`Test server started on port ${port}`);

  runTests(port).then(() => {
    server.close();
    console.log('\n=== Test Summary ===');
    console.log('Tests have been executed.');
    console.log('As expected in TDD approach, most tests should FAIL until the actual endpoint is implemented.');
  }).catch(err => {
    console.error('Test execution error:', err);
    server.close();
    process.exit(1);
  });
});

async function runTests(port) {
  const baseUrl = `http://localhost:${port}`;

  console.log('\n--- Running Contract Tests ---');

  // Test 1: Should return 200 with valid config object for existing module (WILL FAIL - TDD)
  try {
    console.log('\n1. Testing GET /api/modules/aws-inspector/config (expect 200)');
    const response = await makeRequest(`${baseUrl}/api/modules/aws-inspector/config`);
    console.log(`   Status: ${response.status} (Expected: 200)`);
    console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);

    if (response.status === 200 && response.data.config) {
      console.log('   ✓ Test PASSED');
    } else {
      console.log('   ✗ Test FAILED (Expected - TDD approach)');
    }
  } catch (err) {
    console.log(`   ✗ Test FAILED: ${err.message} (Expected - TDD approach)`);
  }

  // Test 2: Should return 404 for non-existent module
  try {
    console.log('\n2. Testing GET /api/modules/non-existent/config (expect 404)');
    const response = await makeRequest(`${baseUrl}/api/modules/non-existent/config`);
    console.log(`   Status: ${response.status} (Expected: 404)`);
    console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);

    if (response.status === 404 && response.data.error) {
      console.log('   ✓ Test PASSED');
    } else {
      console.log('   ✗ Test FAILED');
    }
  } catch (err) {
    console.log(`   ✗ Test FAILED: ${err.message}`);
  }

  // Test 3: Test various module IDs
  const testModuleIds = ['sbom', 'test-module-123', 'module_with_underscores'];

  for (const moduleId of testModuleIds) {
    try {
      console.log(`\n3. Testing GET /api/modules/${moduleId}/config`);
      const response = await makeRequest(`${baseUrl}/api/modules/${moduleId}/config`);
      console.log(`   Status: ${response.status} (Expected: 200 or 404)`);

      if ([200, 404].includes(response.status)) {
        if (response.status === 200) {
          console.log('   ✓ Test PASSED (200 with config)');
        } else {
          console.log('   ✓ Test PASSED (404 for non-existent module)');
        }
      } else {
        console.log('   ✗ Test FAILED (Unexpected status)');
      }
    } catch (err) {
      console.log(`   ✗ Test FAILED: ${err.message}`);
    }
  }

  // Test 4: Test response headers
  try {
    console.log('\n4. Testing response headers');
    const response = await makeRequest(`${baseUrl}/api/modules/aws-inspector/config`);
    const contentType = response.headers['content-type'] || '';
    console.log(`   Content-Type: ${contentType}`);

    if (contentType.includes('application/json')) {
      console.log('   ✓ Test PASSED (JSON content type)');
    } else {
      console.log('   ✗ Test FAILED (Expected JSON content type)');
    }
  } catch (err) {
    console.log(`   ✗ Test FAILED: ${err.message}`);
  }
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (err) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.abort();
      reject(new Error('Request timeout'));
    });
  });
}