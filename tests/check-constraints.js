const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'db', 'vulnerabilities.db');

const db = new sqlite3.Database(dbPath);

console.log('=== CHECKING ALL CONSTRAINT VALUES ===');

// Check severity values
db.all('SELECT DISTINCT severity, COUNT(*) as count FROM vulnerabilities GROUP BY severity', (err, rows) => {
  if (err) {
    console.error('Error checking severity:', err);
  } else {
    console.log('\nSeverity values:');
    rows.forEach(r => {
      console.log(`  ${r.severity || 'NULL'}: ${r.count} records`);
    });
  }

  // Check status values
  db.all('SELECT DISTINCT status, COUNT(*) as count FROM vulnerabilities GROUP BY status', (err, rows) => {
    if (err) {
      console.error('Error checking status:', err);
    } else {
      console.log('\nStatus values:');
      rows.forEach(r => {
        console.log(`  ${r.status || 'NULL'}: ${r.count} records`);
      });
    }

    // Check fix_available values
    db.all('SELECT DISTINCT fix_available, COUNT(*) as count FROM vulnerabilities GROUP BY fix_available', (err, rows) => {
      if (err) {
        console.error('Error checking fix_available:', err);
      } else {
        console.log('\nFix Available values:');
        rows.forEach(r => {
          console.log(`  ${r.fix_available || 'NULL'}: ${r.count} records`);
        });
      }

      db.close();
    });
  });
});