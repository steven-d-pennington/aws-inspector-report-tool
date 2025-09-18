/**
 * Create Fresh Test Database
 *
 * Backs up existing database and creates a fresh one for testing
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'db', 'vulnerabilities.db');
const backupPath = path.join(__dirname, '..', 'db', 'vulnerabilities_backup.db');

async function createFreshTestDb() {
  console.log('Creating fresh test database...');

  // Backup existing database
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupPath);
    console.log('✅ Existing database backed up to vulnerabilities_backup.db');
  }

  // Delete existing database
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('✅ Existing database removed');
  }

  // Initialize the database service to recreate tables
  const Database = require('../src/models/database');
  const db = new Database();

  console.log('✅ Fresh database created with proper schema');
  console.log('📝 You can now test the date picker upload functionality');
  console.log('📝 To restore the original database, copy vulnerabilities_backup.db back to vulnerabilities.db');

  return db;
}

// Run if called directly
if (require.main === module) {
  console.log('='.repeat(60));
  console.log('CREATING FRESH TEST DATABASE');
  console.log('='.repeat(60));

  createFreshTestDb()
    .then(() => {
      console.log('\n✅ Fresh test database created successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Failed to create fresh database:', error);
      process.exit(1);
    });
}

module.exports = { createFreshTestDb };