const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'db', 'vulnerabilities.db');

const db = new sqlite3.Database(dbPath);

db.all('PRAGMA table_info(vulnerabilities)', (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log('=== VULNERABILITIES TABLE SCHEMA ===');
    rows.forEach(row => {
      console.log(`${row.name} | ${row.type}`);
    });
  }

  db.close();
});