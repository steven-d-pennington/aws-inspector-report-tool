/**
 * Fix Database Constraint Issue
 *
 * Updates existing fix_available values to conform to the constraint
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'db', 'vulnerabilities.db');

function fixConstraintIssues() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);

    console.log('Fixing fix_available constraint issues...');

    // First, check existing values
    db.all('SELECT DISTINCT fix_available, COUNT(*) as count FROM vulnerabilities GROUP BY fix_available', (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      console.log('Current fix_available values:');
      rows.forEach(row => {
        console.log(`  ${row.fix_available || 'NULL'}: ${row.count} records`);
      });

      // Update invalid values
      db.serialize(() => {
        // Update PARTIAL values to NO (conservative approach)
        db.run("UPDATE vulnerabilities SET fix_available = 'NO' WHERE fix_available = 'PARTIAL'", function(err) {
          if (err) {
            console.error('Error updating PARTIAL values:', err);
          } else {
            console.log(`Updated ${this.changes} PARTIAL values to NO`);
          }
        });

        // Update NULL values to NO (conservative approach)
        db.run("UPDATE vulnerabilities SET fix_available = 'NO' WHERE fix_available IS NULL", function(err) {
          if (err) {
            console.error('Error updating NULL values:', err);
          } else {
            console.log(`Updated ${this.changes} NULL values to NO`);
          }
        });

        // Also fix the vulnerability_history table if it exists
        db.run("UPDATE vulnerability_history SET fix_available = 'NO' WHERE fix_available = 'PARTIAL'", function(err) {
          if (err && !err.message.includes('no such table')) {
            console.error('Error updating history PARTIAL values:', err);
          } else if (!err.message?.includes('no such table')) {
            console.log(`Updated ${this.changes} history PARTIAL values to NO`);
          }
        });

        db.run("UPDATE vulnerability_history SET fix_available = 'NO' WHERE fix_available IS NULL", function(err) {
          if (err && !err.message.includes('no such table')) {
            console.error('Error updating history NULL values:', err);
          } else if (!err.message?.includes('no such table')) {
            console.log(`Updated ${this.changes} history NULL values to NO`);
          }

          // Final verification
          db.all('SELECT DISTINCT fix_available, COUNT(*) as count FROM vulnerabilities GROUP BY fix_available', (err, rows) => {
            if (err) {
              reject(err);
            } else {
              console.log('\nAfter fix, fix_available values:');
              rows.forEach(row => {
                console.log(`  ${row.fix_available || 'NULL'}: ${row.count} records`);
              });

              db.close();
              resolve();
            }
          });
        });
      });
    });
  });
}

// Run the fix
if (require.main === module) {
  console.log('='.repeat(60));
  console.log('FIXING DATABASE CONSTRAINT ISSUES');
  console.log('='.repeat(60));

  fixConstraintIssues()
    .then(() => {
      console.log('\n✅ Database constraint issues fixed successfully');
      console.log('You can now test the upload functionality again');
    })
    .catch(error => {
      console.error('❌ Failed to fix constraint issues:', error);
    });
}

module.exports = { fixConstraintIssues };