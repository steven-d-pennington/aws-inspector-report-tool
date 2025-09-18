const { DatabaseMonitor } = require('./db_monitor');
const { getPool } = require('./db_pool');

async function generateAdminSummary() {
    console.log('='.repeat(60));
    console.log('     POSTGRESQL DATABASE ADMINISTRATION SUMMARY');
    console.log('='.repeat(60));

    const monitor = new DatabaseMonitor({
        host: 'localhost',
        port: 5432,
        user: 'report_gen',
        password: 'StarDust',
        database: 'vulnerability_reports'
    });

    try {
        await monitor.connect();

        // Database overview
        console.log('\n📊 DATABASE OVERVIEW');
        console.log('-'.repeat(30));
        const dbSize = await monitor.getDatabaseSize();
        console.log(`Database: vulnerability_reports`);
        console.log(`Size: ${dbSize.size} (${dbSize.size_bytes.toLocaleString()} bytes)`);
        console.log(`Host: localhost:5432`);
        console.log(`Admin User: report_gen`);

        // Connection statistics
        console.log('\n🔗 CONNECTION STATISTICS');
        console.log('-'.repeat(30));
        const connections = await monitor.getConnectionStats();
        console.log(`Total Connections: ${connections.total_connections}`);
        console.log(`Active: ${connections.active_connections}`);
        console.log(`Idle: ${connections.idle_connections}`);
        console.log(`Idle in Transaction: ${connections.idle_in_transaction}`);

        // Tables information
        console.log('\n📋 TABLES INFORMATION');
        console.log('-'.repeat(30));
        const tables = await monitor.getTableSizes();
        if (tables.length > 0) {
            tables.forEach(table => {
                console.log(`${table.tablename}: ${table.size}`);
            });
        } else {
            console.log('No user tables found (database is empty)');
        }

        // Health check
        console.log('\n🏥 HEALTH STATUS');
        console.log('-'.repeat(30));
        const health = await monitor.checkHealth();
        console.log(`Status: ${health.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);

        if (health.warnings && health.warnings.length > 0) {
            console.log('Warnings:');
            health.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
        }

        if (health.issues && health.issues.length > 0) {
            console.log('Issues:');
            health.issues.forEach(issue => console.log(`  🚨 ${issue}`));
        }

        // Users and permissions
        console.log('\n👥 USER ACCOUNTS');
        console.log('-'.repeat(30));
        try {
            const users = await monitor.client.query(`
                SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin
                FROM pg_roles
                WHERE rolname NOT LIKE 'pg_%'
                ORDER BY rolname
            `);

            users.rows.forEach(user => {
                const flags = [];
                if (user.rolsuper) flags.push('SUPERUSER');
                if (user.rolcreatedb) flags.push('CREATEDB');
                if (user.rolcreaterole) flags.push('CREATEROLE');
                if (user.rolcanlogin) flags.push('LOGIN');

                console.log(`${user.rolname}: ${flags.join(', ') || 'No special privileges'}`);
            });
        } catch (error) {
            console.log('Unable to retrieve user information');
        }

        await monitor.disconnect();

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
    }

    // Available tools and scripts
    console.log('\n🛠️  AVAILABLE ADMINISTRATION TOOLS');
    console.log('-'.repeat(30));
    console.log('1. create_database.js - Database creation script');
    console.log('2. setup_users.sql - User management script');
    console.log('3. db_monitor.js - Real-time monitoring');
    console.log('4. db_pool.js - Connection pool management');
    console.log('5. backup_script.js - Backup automation');
    console.log('6. maintenance_scheduler.js - Automated maintenance');
    console.log('7. disaster_recovery.md - Emergency procedures');

    console.log('\n📋 MAINTENANCE SCHEDULE');
    console.log('-'.repeat(30));
    console.log('Daily (2:00 AM):');
    console.log('  - Automated backup');
    console.log('  - Health check');
    console.log('  - Statistics update');
    console.log('  - Connection cleanup');
    console.log('');
    console.log('Weekly (Sunday 3:00 AM):');
    console.log('  - VACUUM ANALYZE');
    console.log('  - REINDEX DATABASE');
    console.log('  - Detailed monitoring report');
    console.log('');
    console.log('Business Hours (9-17, Mon-Fri):');
    console.log('  - Health checks every 15 minutes');

    console.log('\n🚨 EMERGENCY CONTACTS');
    console.log('-'.repeat(30));
    console.log('Database Admin: steve.d.pennington@gmail.com');
    console.log('Emergency: See disaster_recovery.md');

    console.log('\n📖 QUICK COMMANDS');
    console.log('-'.repeat(30));
    console.log('Health Check:     node db_monitor.js');
    console.log('Manual Backup:    node backup_script.js');
    console.log('Pool Test:        node db_pool.js');
    console.log('Maintenance:      node maintenance_scheduler.js --manual');
    console.log('User Setup:       node setup_users_script.js');

    console.log('\n' + '='.repeat(60));
    console.log('Database administration setup completed successfully!');
    console.log('='.repeat(60));
}

// Run summary
generateAdminSummary().catch(console.error);