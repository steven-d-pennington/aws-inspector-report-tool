# Disaster Recovery Runbook - vulnerability_reports Database

## Recovery Time Objective (RTO): 4 hours
## Recovery Point Objective (RPO): 1 hour

## Emergency Contacts
- Database Administrator: steve.d.pennington@gmail.com
- System Administrator: [Add contact]
- Application Team Lead: [Add contact]

## Pre-requisites
- PostgreSQL installation available
- Access to backup storage location
- Network connectivity to database server
- Administrative credentials

---

## Scenario 1: Complete Database Loss

### Immediate Actions (0-15 minutes)
1. **Assess the situation**
   ```bash
   # Check if PostgreSQL service is running
   systemctl status postgresql  # Linux
   Get-Service postgresql*      # Windows PowerShell
   ```

2. **Notify stakeholders**
   - Send alert to emergency contacts
   - Update status page if available

3. **Document the incident**
   - Record time of failure
   - Note error messages
   - Screenshot any relevant error displays

### Recovery Steps (15 minutes - 2 hours)

#### Step 1: Verify Infrastructure
```bash
# Check disk space
df -h  # Linux
Get-WmiObject -Class Win32_LogicalDisk  # Windows

# Check system resources
top    # Linux
tasklist  # Windows
```

#### Step 2: Reinstall PostgreSQL (if needed)
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install postgresql postgresql-contrib

# Windows - Download from postgresql.org
# Install using provided installer
```

#### Step 3: Restore from Latest Backup
```bash
# Find latest backup
ls -la ./backups/*.sql

# Create new database
createdb -h localhost -U postgres vulnerability_reports

# Restore from backup
psql -h localhost -U postgres -d vulnerability_reports -f ./backups/[latest_backup].sql
```

#### Step 4: Verify Data Integrity
```javascript
// Run verification script
node -e "
const { Client } = require('pg');
const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'report_gen',
    password: 'StarDust',
    database: 'vulnerability_reports'
});

client.connect().then(() => {
    return client.query('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = \'public\'');
}).then(result => {
    console.log('Tables restored:', result.rows[0].count);
    return client.end();
}).catch(console.error);
"
```

#### Step 5: Recreate Users and Permissions
```bash
psql -h localhost -U postgres -d vulnerability_reports -f setup_users.sql
```

---

## Scenario 2: Data Corruption

### Immediate Actions
1. **Stop application connections**
   ```bash
   # Revoke connect privilege temporarily
   psql -c "REVOKE CONNECT ON DATABASE vulnerability_reports FROM public;"
   ```

2. **Assess corruption extent**
   ```sql
   -- Check for corrupt indexes
   REINDEX DATABASE vulnerability_reports;

   -- Verify table integrity
   SELECT schemaname, tablename, attname, n_distinct, correlation
   FROM pg_stats
   WHERE schemaname = 'public';
   ```

### Recovery Options

#### Option A: Point-in-Time Recovery (if WAL archiving enabled)
```bash
# Stop PostgreSQL
systemctl stop postgresql

# Restore base backup
tar -xzf base_backup.tar.gz -C /var/lib/postgresql/data

# Configure recovery
echo "restore_command = 'cp /archive/%f %p'" > recovery.conf
echo "recovery_target_time = '2023-XX-XX XX:XX:XX'" >> recovery.conf

# Start PostgreSQL
systemctl start postgresql
```

#### Option B: Restore from Daily Backup
```bash
# Restore from most recent clean backup
psql -h localhost -U postgres -c "DROP DATABASE vulnerability_reports;"
createdb -h localhost -U postgres vulnerability_reports
psql -h localhost -U postgres -d vulnerability_reports -f ./backups/[clean_backup].sql
```

---

## Scenario 3: Performance Degradation

### Immediate Diagnostics
```javascript
// Run monitoring script
node db_monitor.js
```

### Quick Fixes
```sql
-- Update table statistics
ANALYZE;

-- Rebuild indexes
REINDEX DATABASE vulnerability_reports;

-- Check for blocking queries
SELECT pid, query, state, query_start
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;

-- Kill long-running queries if necessary
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = [problematic_pid];
```

---

## Scenario 4: Replication Failure

### Check Replication Status
```sql
-- On master server
SELECT * FROM pg_stat_replication;

-- On replica server
SELECT * FROM pg_stat_wal_receiver;
```

### Recovery Steps
```bash
# Restart replication
systemctl restart postgresql

# If replication slot is corrupted
psql -c "SELECT pg_drop_replication_slot('replica_slot_name');"
psql -c "SELECT pg_create_physical_replication_slot('replica_slot_name');"

# Resync replica if needed
pg_basebackup -h master_host -D /var/lib/postgresql/replica -U replication_user -P -W
```

---

## Automated Recovery Scripts

### Auto-Recovery Script
```javascript
// auto_recovery.js
const { DatabaseMonitor } = require('./db_monitor');
const { runBackup } = require('./backup_script');

async function autoRecover() {
    const monitor = new DatabaseMonitor({
        host: 'localhost',
        port: 5432,
        user: 'report_gen',
        password: 'StarDust',
        database: 'vulnerability_reports'
    });

    try {
        await monitor.connect();
        const health = await monitor.checkHealth();

        if (!health.healthy) {
            console.log('Database unhealthy, attempting recovery...');

            // Create backup before recovery attempts
            await runBackup();

            // Attempt automated fixes
            await monitor.client.query('ANALYZE;');
            await monitor.client.query('REINDEX DATABASE vulnerability_reports;');

            // Re-check health
            const newHealth = await monitor.checkHealth();
            if (newHealth.healthy) {
                console.log('Automated recovery successful');
            } else {
                console.log('Automated recovery failed - manual intervention required');
                // Send alert to administrators
            }
        }
    } catch (error) {
        console.error('Auto-recovery failed:', error);
    } finally {
        await monitor.disconnect();
    }
}

module.exports = { autoRecover };
```

---

## Post-Recovery Checklist

- [ ] Verify all tables are present and accessible
- [ ] Check row counts match expected values
- [ ] Test application connectivity
- [ ] Verify user permissions are correct
- [ ] Run application health checks
- [ ] Update monitoring dashboards
- [ ] Document lessons learned
- [ ] Review and update backup procedures
- [ ] Test recovery procedures monthly

---

## Prevention Measures

### Daily Tasks
- [ ] Verify backup completion
- [ ] Check database health metrics
- [ ] Monitor disk space usage
- [ ] Review slow query logs

### Weekly Tasks
- [ ] Test backup restoration
- [ ] Review user access logs
- [ ] Update statistics and optimize
- [ ] Check replication lag (if applicable)

### Monthly Tasks
- [ ] Full disaster recovery drill
- [ ] Review and update security
- [ ] Capacity planning review
- [ ] Update documentation

---

## Monitoring Alerts Configuration

Set up alerts for:
- Database connection failures
- Disk space < 85% full
- Backup failures
- Replication lag > 5 minutes
- Query runtime > 30 seconds
- Connection count > 80% of max

---

## Emergency Commands Quick Reference

```bash
# Check PostgreSQL status
systemctl status postgresql

# Emergency shutdown
pg_ctl stop -m immediate

# Create emergency backup
pg_dump vulnerability_reports > emergency_backup.sql

# Check active connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Kill all connections to database
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'vulnerability_reports';"

# Check database size
psql -c "SELECT pg_size_pretty(pg_database_size('vulnerability_reports'));"
```