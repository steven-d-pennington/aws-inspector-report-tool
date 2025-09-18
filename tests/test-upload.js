/**
 * Test Upload Script
 *
 * This script tests the upload functionality directly to debug
 * the constraint error we're seeing.
 */

const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testUpload() {
  const testFile = path.join(__dirname, 'sample-inspector-report.json');
  const formData = new FormData();

  // Read the test file
  const fileContent = fs.readFileSync(testFile);
  formData.append('reportFile', fileContent, {
    filename: 'test-report.json',
    contentType: 'application/json'
  });

  // Add report date (3 days ago)
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const reportDate = threeDaysAgo.toISOString().split('T')[0];
  formData.append('reportDate', reportDate);

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('http://localhost:3010/upload', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    const result = await response.json();

    console.log('=== UPLOAD TEST RESULT ===');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log('✅ Upload successful with date tracking');
    } else {
      console.log('❌ Upload failed:', result.error);
    }

  } catch (error) {
    console.error('❌ Upload test failed:', error.message);
  }
}

// Check database after upload
async function checkDatabaseAfterUpload() {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, '..', 'db', 'vulnerabilities.db');

  return new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath);

    db.all("SELECT id, filename, upload_date, report_run_date FROM reports ORDER BY id DESC LIMIT 3", (err, reports) => {
      if (err) {
        console.error('Database error:', err.message);
      } else {
        console.log('\n=== RECENT REPORTS AFTER UPLOAD ===');
        reports.forEach(report => {
          console.log(`ID: ${report.id}`);
          console.log(`Filename: ${report.filename}`);
          console.log(`Upload Date: ${report.upload_date}`);
          console.log(`Report Run Date: ${report.report_run_date}`);
          console.log('---');
        });
      }

      db.close();
      resolve();
    });
  });
}

// Run the test
if (require.main === module) {
  console.log('Testing upload functionality with date picker...');

  testUpload()
    .then(() => {
      // Wait a moment for database to update
      setTimeout(() => {
        checkDatabaseAfterUpload();
      }, 1000);
    })
    .catch(console.error);
}

module.exports = { testUpload, checkDatabaseAfterUpload };