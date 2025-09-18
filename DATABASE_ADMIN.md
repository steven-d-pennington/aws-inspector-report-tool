# PostgreSQL Database Administration Setup

## Overview
Complete database administration setup for the `vulnerability_reports` PostgreSQL database with automated backup, monitoring, maintenance, and disaster recovery procedures.

## Database Details
- **Database Name:** vulnerability_reports
- **Host:** localhost:5432
- **Admin User:** report_gen
- **Password:** StarDust

## User Accounts
- `report_gen` - Database administrator (superuser)
- `app_user` - Application user with read/write access
- `report_reader` - Read-only user for reporting
- `backup_user` - Backup operations user

## Available Scripts

### Core Administration
- `db_admin_summary.js` - Comprehensive status overview
- `db_monitor.js` - Real-time monitoring and health checks
- `db_pool.js` - Connection pool management and testing
- `maintenance_scheduler.js` - Automated maintenance tasks

### User Management
- `setup_users.sql` - User creation and permission setup

### Backup & Recovery
- `backup_script.js` - Automated backup with retention policy
- `disaster_recovery.md` - Emergency procedures and runbook

## Quick Start Commands

```bash
# Check database health
node db_monitor.js

# Test connection pool
node db_pool.js

# Run manual maintenance
node maintenance_scheduler.js --manual

# Generate admin summary
node db_admin_summary.js
```

## Automated Maintenance Schedule

### Daily (2:00 AM)
- Database backup with 7-day retention
- Health check and alerting
- Statistics update (ANALYZE)
- Idle connection cleanup

### Weekly (Sunday 3:00 AM)
- Full VACUUM ANALYZE
- Database reindexing
- Detailed monitoring report generation

### Business Hours (9-17, Mon-Fri)
- Health checks every 15 minutes
- Performance monitoring

## Monitoring Alerts

The system monitors and alerts for:
- Database connection failures
- High connection counts (>80)
- Idle transactions (>5)
- Slow queries (>5 seconds)
- Backup failures
- Disk space issues

## Connection Pool Configuration

- **Max Connections:** 10
- **Min Connections:** 2
- **Idle Timeout:** 30 seconds
- **Connection Timeout:** 5 seconds
- **Acquire Timeout:** 10 seconds

## Backup Strategy

- **Type:** Logical backup using pg_dump
- **Frequency:** Daily at 2:00 AM
- **Retention:** 7 days
- **Location:** ./backups/
- **Format:** SQL dump with CREATE statements

### Manual Backup
```bash
node backup_script.js
```

## Disaster Recovery

### RTO (Recovery Time Objective): 4 hours
### RPO (Recovery Point Objective): 1 hour

See `disaster_recovery.md` for detailed procedures including:
- Complete database loss recovery
- Data corruption handling
- Performance degradation troubleshooting
- Replication failure recovery

## Security Features

- Principle of least privilege for user accounts
- Connection limits and timeouts
- SSL support (configurable)
- Application-specific database users
- Audit logging through pg_stat_activity

## Performance Monitoring

Key metrics tracked:
- Connection counts and states
- Query execution times
- Table and index sizes
- Lock statistics
- Replication lag (if applicable)

## Maintenance Best Practices

1. **Regular Statistics Updates** - Automated via ANALYZE
2. **Index Maintenance** - Weekly REINDEX operations
3. **Connection Management** - Automatic cleanup of idle connections
4. **Backup Verification** - Automated testing of backup integrity
5. **Health Monitoring** - Continuous health checks with alerting

## Emergency Procedures

### Quick Database Check
```bash
node db_monitor.js
```

### Emergency Backup
```bash
node backup_script.js
```

### Stop All Connections
```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'vulnerability_reports' AND pid != pg_backend_pid();
```

### Check Database Size
```sql
SELECT pg_size_pretty(pg_database_size('vulnerability_reports'));
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check PostgreSQL service status
   - Verify host and port configuration
   - Check firewall settings

2. **Authentication Failed**
   - Verify username and password
   - Check pg_hba.conf configuration
   - Ensure user exists with proper permissions

3. **High Connection Count**
   - Run connection cleanup script
   - Check for connection leaks in application
   - Consider increasing max_connections

4. **Slow Queries**
   - Run ANALYZE to update statistics
   - Check for missing indexes
   - Review query execution plans

### Log Locations
- PostgreSQL logs: Check PostgreSQL configuration for log_directory
- Application logs: Console output from Node.js scripts
- Backup logs: Generated during backup_script.js execution

## Support

For emergency database issues:
- **Email:** steve.d.pennington@gmail.com
- **Documentation:** disaster_recovery.md
- **Monitoring:** node db_monitor.js

---

*This database administration setup provides enterprise-grade operational excellence with automated maintenance, comprehensive monitoring, and robust disaster recovery procedures.*