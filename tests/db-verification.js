/**
 * Database Verification Script
 *
 * This script verifies that the database has been properly updated
 * to support the date picker feature (report_run_date column).
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'db', 'vulnerabilities.db');

function verifyDatabaseSchema() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(`Error opening database: ${err.message}`);
        return;
      }
      console.log('✅ Database connection established');
    });

    // Check the reports table schema
    db.all("PRAGMA table_info(reports)", (err, rows) => {
      if (err) {
        reject(`Error getting table info: ${err.message}`);
        return;
      }

      console.log('\n=== REPORTS TABLE SCHEMA ===');
      console.log('Column Name | Type | Not Null | Default | Primary Key');
      console.log('-'.repeat(60));

      let hasReportRunDate = false;
      rows.forEach(row => {
        console.log(`${row.name.padEnd(12)} | ${row.type.padEnd(8)} | ${row.notnull.toString().padEnd(8)} | ${(row.dflt_value || 'NULL').toString().padEnd(7)} | ${row.pk}`);
        if (row.name === 'report_run_date') {
          hasReportRunDate = true;
        }
      });

      if (hasReportRunDate) {
        console.log('\n✅ report_run_date column exists in reports table');
      } else {
        console.log('\n❌ report_run_date column is MISSING from reports table');
      }

      // Check recent reports to see if dates are being stored
      db.all("SELECT id, filename, upload_date, report_run_date FROM reports ORDER BY id DESC LIMIT 5", (err, reports) => {
        if (err) {
          console.log(`Error querying reports: ${err.message}`);
        } else {
          console.log('\n=== RECENT REPORTS ===');
          if (reports.length === 0) {
            console.log('No reports found in database');
          } else {
            console.log('ID | Filename | Upload Date | Report Run Date');
            console.log('-'.repeat(80));
            reports.forEach(report => {
              console.log(`${report.id.toString().padEnd(3)} | ${(report.filename || 'NULL').padEnd(20)} | ${(report.upload_date || 'NULL').padEnd(20)} | ${(report.report_run_date || 'NULL')}`);
            });

            // Check if any reports have report_run_date
            const reportsWithRunDate = reports.filter(r => r.report_run_date);
            if (reportsWithRunDate.length > 0) {
              console.log(`\n✅ ${reportsWithRunDate.length} reports have report_run_date values`);
            } else {
              console.log('\n⚠️  No reports have report_run_date values yet');
            }
          }
        }

        db.close((err) => {
          if (err) {
            console.error(`Error closing database: ${err.message}`);
          } else {
            console.log('\n✅ Database connection closed');
          }

          resolve({
            hasReportRunDate,
            recentReports: reports
          });
        });
      });
    });
  });
}

// Run the verification
if (require.main === module) {
  console.log('='.repeat(60));
  console.log('DATABASE VERIFICATION FOR DATE PICKER FEATURE');
  console.log('='.repeat(60));

  verifyDatabaseSchema()
    .then(result => {
      console.log('\n' + '='.repeat(60));
      console.log('VERIFICATION SUMMARY');
      console.log('='.repeat(60));

      if (result.hasReportRunDate) {
        console.log('✅ Database schema supports date picker feature');
        console.log('✅ report_run_date column is present');
      } else {
        console.log('❌ Database schema needs migration');
        console.log('❌ report_run_date column is missing');
        console.log('\nTo fix this, run the migration script:');
        console.log('node migrations/add-report-run-date.js');
      }
    })
    .catch(error => {
      console.error('❌ Verification failed:', error);
    });
}

module.exports = { verifyDatabaseSchema };