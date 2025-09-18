const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class DatabaseBackup {
    constructor(config) {
        this.config = {
            host: config.host || 'localhost',
            port: config.port || 5432,
            user: config.user || 'backup_user',
            password: config.password || 'BackupPassword123!',
            database: config.database || 'vulnerability_reports',
            backupDir: config.backupDir || './backups'
        };
    }

    async createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `vulnerability_reports_backup_${timestamp}.sql`;
        const backupPath = path.join(this.config.backupDir, backupFileName);

        // Ensure backup directory exists
        if (!fs.existsSync(this.config.backupDir)) {
            fs.mkdirSync(this.config.backupDir, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            const pgDumpArgs = [
                '-h', this.config.host,
                '-p', this.config.port.toString(),
                '-U', this.config.user,
                '-d', this.config.database,
                '--no-password',
                '--verbose',
                '--clean',
                '--if-exists',
                '--create',
                '-f', backupPath
            ];

            const pgDump = spawn('pg_dump', pgDumpArgs, {
                env: { ...process.env, PGPASSWORD: this.config.password }
            });

            pgDump.stdout.on('data', (data) => {
                console.log(`pg_dump stdout: ${data}`);
            });

            pgDump.stderr.on('data', (data) => {
                console.log(`pg_dump stderr: ${data}`);
            });

            pgDump.on('close', (code) => {
                if (code === 0) {
                    console.log(`Backup created successfully: ${backupPath}`);
                    this.cleanOldBackups();
                    resolve(backupPath);
                } else {
                    reject(new Error(`pg_dump exited with code ${code}`));
                }
            });

            pgDump.on('error', (error) => {
                reject(new Error(`Failed to start pg_dump: ${error.message}`));
            });
        });
    }

    cleanOldBackups(retentionDays = 7) {
        try {
            const files = fs.readdirSync(this.config.backupDir);
            const now = Date.now();
            const maxAge = retentionDays * 24 * 60 * 60 * 1000;

            files.forEach(file => {
                const filePath = path.join(this.config.backupDir, file);
                const stats = fs.statSync(filePath);

                if (now - stats.mtime.getTime() > maxAge) {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted old backup: ${file}`);
                }
            });
        } catch (error) {
            console.error('Error cleaning old backups:', error.message);
        }
    }

    async testBackup(backupPath) {
        // Test backup by attempting to restore to a test database
        console.log('Testing backup integrity...');

        // This is a simplified test - in production, you'd restore to a test database
        try {
            const stats = fs.statSync(backupPath);
            if (stats.size > 0) {
                console.log(`Backup file exists and has size: ${stats.size} bytes`);
                return true;
            }
        } catch (error) {
            console.error('Backup test failed:', error.message);
            return false;
        }
    }
}

// Usage example and scheduled backup
async function runBackup() {
    const backup = new DatabaseBackup({
        host: 'localhost',
        port: 5432,
        user: 'backup_user',
        password: 'BackupPassword123!',
        database: 'vulnerability_reports',
        backupDir: './backups'
    });

    try {
        const backupPath = await backup.createBackup();
        const isValid = await backup.testBackup(backupPath);

        if (isValid) {
            console.log('Backup completed and validated successfully');
        } else {
            console.error('Backup validation failed');
        }
    } catch (error) {
        console.error('Backup failed:', error.message);

        // In production, send alert to monitoring system
        console.error('ALERT: Database backup failed - manual intervention required');
    }
}

// Schedule daily backups (uncomment to enable)
// setInterval(runBackup, 24 * 60 * 60 * 1000); // Daily backup

module.exports = { DatabaseBackup, runBackup };

// Run backup if called directly
if (require.main === module) {
    runBackup();
}