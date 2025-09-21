#!/usr/bin/env node

/**
 * Simple migration runner to bootstrap the primary PostgreSQL schema on Fly.io
 * using the bundled 000-initial-seed.sql script.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load environment variables from .env when available (local convenience)
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const environmentConfig = require('../src/config/environment');

function resolveConnectionOptions() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.DB_URL ||
    process.env.PG_CONNECTION_STRING ||
    environmentConfig.getDatabaseConnectionString();

  if (!connectionString) {
    throw new Error('DATABASE_URL (or equivalent) is required for migrations');
  }

  const sslMode = (process.env.DB_SSL_MODE || '').toLowerCase();
  let ssl;
  if (sslMode === 'require') {
    ssl = { rejectUnauthorized: false };
  } else if (sslMode === 'disable' || sslMode === '') {
    ssl = false;
  } else {
    ssl = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;
  }

  return { connectionString, ssl };
}

function parseSqlStatements(sql) {
  const statements = [];
  let buffer = [];

  for (const rawLine of sql.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('--')) {
      continue;
    }

    buffer.push(line);
    if (trimmed.endsWith(';')) {
      statements.push(buffer.join('\n'));
      buffer = [];
    }
  }

  const remainder = buffer.join('\n').trim();
  if (remainder) {
    statements.push(remainder);
  }

  return statements;
}

async function main() {
  const { connectionString, ssl } = resolveConnectionOptions();
  const pool = new Pool({ connectionString, ssl });
  const client = await pool.connect();

  try {
    const { rows } = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'reports'
      ) AS initialized
    `);

    if (rows[0]?.initialized) {
      console.log('??  Database already initialized; skipping seed script.');
      return;
    }

    const sqlPath = path.join(__dirname, '..', 'migrations', 'postgresql', '000-initial-seed.sql');
    const sqlContents = fs.readFileSync(sqlPath, 'utf8');
    const statements = parseSqlStatements(sqlContents);

    console.log(`Running ${statements.length} statements from ${sqlPath}...`);

    for (const statement of statements) {
      const preview = statement.split('\n')[0].slice(0, 60);
      console.log(`Executing: ${preview}...`);
      await client.query(statement);
    }

    console.log('? Database schema and seed data applied successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error('? Migration failed:', error.message);
  process.exit(1);
});