#!/usr/bin/env node

/**
 * Simple migration runner to bootstrap and evolve the PostgreSQL schema.
 *
 * - Runs the initial seed script when the database is empty.
 * - Applies idempotent schema upgrades on every run so new columns/indexes are ensured.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load environment variables from .env when available (local convenience)
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const environmentConfig = require('../src/config/environment');

function resolveConnectionOptions() {
  let connectionString =
    process.env.DATABASE_URL ||
    process.env.DB_URL ||
    process.env.PG_CONNECTION_STRING;

  if (!connectionString) {
    const {
      PGHOST,
      PGPORT,
      PGUSER,
      PGPASSWORD,
      PGDATABASE,
      PGSSLMODE
    } = process.env;

    const hasPgEnv = PGHOST && PGUSER && PGDATABASE;

    if (hasPgEnv) {
      const encodedUser = encodeURIComponent(PGUSER);
      const encodedPassword = PGPASSWORD ? `:${encodeURIComponent(PGPASSWORD)}` : '';
      const port = PGPORT || '5432';
      const sslMode = (PGSSLMODE || process.env.DB_SSL_MODE || '').toLowerCase();
      const sslParam =
        sslMode === 'require' || sslMode === 'prefer'
          ? 'sslmode=require'
          : sslMode === 'disable'
            ? 'sslmode=disable'
            : '';

      const querySuffix = sslParam ? `?${sslParam}` : '';
      connectionString = `postgresql://${encodedUser}${encodedPassword}@${PGHOST}:${port}/${PGDATABASE}${querySuffix}`;
    }
  }

  connectionString = connectionString || environmentConfig.getDatabaseConnectionString();

  if (!connectionString) {
    throw new Error('DATABASE_URL (or equivalent) is required for migrations');
  }

  const sslMode = (process.env.DB_SSL_MODE || process.env.PGSSLMODE || '').toLowerCase();
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

async function applyInitialSeed(client) {
  const sqlPath = path.join(__dirname, '..', 'migrations', 'postgresql', '000-initial-seed.sql');
  const sqlContents = fs.readFileSync(sqlPath, 'utf8');
  const statements = parseSqlStatements(sqlContents);

  console.log(`Running ${statements.length} statements from ${sqlPath}...`);

  for (const statement of statements) {
    const preview = statement.split('\n')[0].slice(0, 60);
    console.log(`Executing: ${preview}...`);
    await client.query(statement);
  }

  console.log('✅ Database schema and seed data applied successfully.');
}

async function applySchemaUpgrades(client) {
  const upgrades = [
    `ALTER TABLE vulnerability_history ADD COLUMN IF NOT EXISTS finding_arn TEXT`,
    `ALTER TABLE vulnerability_history ADD COLUMN IF NOT EXISTS aws_account_id VARCHAR(32)`,
    `ALTER TABLE vulnerability_history ADD COLUMN IF NOT EXISTS status VARCHAR(20)`,
    `ALTER TABLE vulnerability_history ADD COLUMN IF NOT EXISTS fix_available VARCHAR(10)`,
    `ALTER TABLE vulnerability_history ADD COLUMN IF NOT EXISTS inspector_score NUMERIC`,
    `ALTER TABLE vulnerability_history ADD COLUMN IF NOT EXISTS epss_score NUMERIC`,
    `ALTER TABLE vulnerability_history ADD COLUMN IF NOT EXISTS exploit_available VARCHAR(10)`,
    `ALTER TABLE vulnerability_history ADD COLUMN IF NOT EXISTS first_observed_at TIMESTAMPTZ`,
    `ALTER TABLE vulnerability_history ADD COLUMN IF NOT EXISTS last_observed_at TIMESTAMPTZ`,
    `CREATE INDEX IF NOT EXISTS idx_vulnerability_history_finding_arn ON vulnerability_history(finding_arn)`
  ];

  console.log('Applying schema upgrades (idempotent)...');
  for (const statement of upgrades) {
    await client.query(statement);
  }

  // Backfill convenience values where possible so older rows behave consistently.
  await client.query(`
    UPDATE vulnerability_history
    SET finding_arn = COALESCE(finding_arn, vulnerability_id)
    WHERE finding_arn IS NULL
  `);

  await client.query(`
    UPDATE vulnerability_history
    SET status = COALESCE(status, resolution_type, 'ARCHIVED')
    WHERE status IS NULL
  `);

  await client.query(`
    UPDATE vulnerability_history
    SET fix_available = COALESCE(fix_available, CASE WHEN fix_version IS NOT NULL THEN 'Yes' ELSE 'No' END)
    WHERE fix_available IS NULL
  `);

  console.log('✅ Schema upgrades applied.');
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

    const initialized = rows[0]?.initialized;

    if (!initialized) {
      await applyInitialSeed(client);
    } else {
      console.log('ℹ️  Reports table already present; skipping initial seed.');
    }

    await applySchemaUpgrades(client);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
});
