const path = require('path');
const fs = require('fs').promises;
const zlib = require('zlib');
const { promisify } = require('util');
const { execFile } = require('child_process');
const { DatabaseOperation, DatabaseOperationManager } = require('../models/databaseOperation');
const { BackupFile, BackupFileManager } = require('../models/backupFile');

const execFileAsync = promisify(execFile);
const gzipAsync = promisify(zlib.gzip);

class SettingsService {
    constructor(database) {
        this.database = database;
        this.operationManager = new DatabaseOperationManager();
        this.backupDir = path.join(process.cwd(), 'backups');
        this.backupFileManager = new BackupFileManager(this.backupDir);
    }

    // System Information
    async getSystemInfo() {
        try {
            const dbInfo = await this.database.getConnectionInfo?.() || {};
            const startTime = process.uptime();

            return {
                database: {
                    type: process.env.DATABASE_TYPE || 'postgresql',
                    version: dbInfo.version || 'Unknown',
                    connectionCount: dbInfo.connectionCount || 0
                },
                server: {
                    uptime: this.formatUptime(startTime),
                    uptimeSeconds: Math.floor(startTime),
                    nodeVersion: process.version,
                    platform: process.platform,
                    memory: process.memoryUsage()
                },
                backup: {
                    totalFiles: await this.backupFileManager.getCount(),
                    totalSize: await this.backupFileManager.getTotalSize(),
                    lastBackup: await this.getLastBackupTime()
                }
            };
        } catch (error) {
            throw new Error(`Failed to get system info: ${error.message}`);
        }
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);

        return parts.length > 0 ? parts.join(' ') : 'Less than 1 minute';
    }

    async getLastBackupTime() {
        try {
            const backups = await this.backupFileManager.list();
            return backups.length > 0 ? backups[0].created : null;
        } catch {
            return null;
        }
    }

    // Backup Operations
    async createBackup() {
        try {
            // Check for concurrent operations
            if (this.operationManager.hasActiveOperation()) {
                throw new Error('Another operation is already in progress');
            }

            const operation = this.operationManager.create('backup');
            operation.start();

            // Start backup in background
            this.performBackup(operation).catch(error => {
                operation.fail(error.message);
            });

            return operation;
        } catch (error) {
            throw new Error(`Failed to start backup: ${error.message}`);
        }
    }

    async performBackup(operation) {
        try {
            const filename = BackupFile.generateFilename('vulnerability_backup');
            const filePath = path.join(this.backupDir, filename);

            operation.updateProgress(10);
            operation.metadata.filename = filename;
            operation.metadata.filePath = filePath;

            console.log('🔄 Starting JavaScript-based database backup...');

            operation.updateProgress(20);

            // Get all table data using JavaScript instead of pg_dump
            const backupData = await this.createJavaScriptBackup();

            operation.updateProgress(60);

            // Convert to SQL format
            console.log('🔄 Converting to SQL format...');
            const sqlDump = this.generateSQLDump(backupData);

            operation.updateProgress(75);

            // Compress the dump
            console.log('🔄 Compressing backup...');
            const compressedData = await gzipAsync(Buffer.from(sqlDump, 'utf8'));

            operation.updateProgress(85);

            // Write to file
            await fs.writeFile(filePath, compressedData);

            operation.updateProgress(95);

            // Verify file and update metadata
            const backupFile = await BackupFile.fromPath(filePath);
            operation.metadata.fileSize = backupFile.size;
            operation.metadata.compressed = true;

            operation.updateProgress(100);
            operation.complete({
                filename: filename,
                filePath: filePath,
                size: backupFile.size,
                downloadUrl: `/api/settings/backup/download/${filename}`
            });

            console.log(`✅ Backup completed: ${filename} (${backupFile.getFormattedSize()})`);

            // Cleanup old backups
            setTimeout(() => this.cleanupOldBackups(), 5000);

        } catch (error) {
            console.error('❌ Backup failed:', error.message);
            throw error;
        }
    }

    async createJavaScriptBackup() {
        const tables = ['reports', 'vulnerabilities', 'historical_data'];
        const backupData = {
            metadata: {
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                database: 'postgresql'
            },
            tables: {}
        };

        for (const tableName of tables) {
            try {
                console.log(`🔄 Backing up table: ${tableName}`);

                // Get table structure
                const schemaResult = await this.database.query(`
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_name = $1
                    ORDER BY ordinal_position
                `, [tableName]);

                // Get table data
                const dataResult = await this.database.query(`SELECT * FROM ${tableName}`);

                backupData.tables[tableName] = {
                    schema: schemaResult.rows,
                    data: dataResult.rows,
                    rowCount: dataResult.rows.length
                };

                console.log(`✅ Backed up ${dataResult.rows.length} rows from ${tableName}`);
            } catch (error) {
                console.warn(`⚠️ Failed to backup table ${tableName}:`, error.message);
                backupData.tables[tableName] = {
                    error: error.message,
                    schema: [],
                    data: [],
                    rowCount: 0
                };
            }
        }

        return backupData;
    }

    generateSQLDump(backupData) {
        let sql = '';

        // Header
        sql += '-- PostgreSQL Database Backup\n';
        sql += `-- Generated on: ${backupData.metadata.timestamp}\n`;
        sql += `-- Database: ${backupData.metadata.database}\n`;
        sql += '-- Generated by: Vulnerability Dashboard Settings\n\n';

        sql += 'SET statement_timeout = 0;\n';
        sql += 'SET lock_timeout = 0;\n';
        sql += 'SET client_encoding = \'UTF8\';\n';
        sql += 'SET standard_conforming_strings = on;\n';
        sql += 'SET check_function_bodies = false;\n';
        sql += 'SET xmloption = content;\n';
        sql += 'SET client_min_messages = warning;\n\n';

        // Generate SQL for each table
        for (const [tableName, tableData] of Object.entries(backupData.tables)) {
            if (tableData.error) {
                sql += `-- ERROR backing up table ${tableName}: ${tableData.error}\n\n`;
                continue;
            }

            sql += `-- Table: ${tableName}\n`;
            sql += `-- Rows: ${tableData.rowCount}\n\n`;

            if (tableData.data.length > 0) {
                // Clear existing data
                sql += `DELETE FROM ${tableName};\n\n`;

                // Insert data
                const columns = Object.keys(tableData.data[0]);
                sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES\n`;

                const values = tableData.data.map(row => {
                    const rowValues = columns.map(col => {
                        const value = row[col];
                        if (value === null) return 'NULL';
                        if (typeof value === 'string') {
                            return `'${value.replace(/'/g, "''")}'`;
                        }
                        if (value instanceof Date) {
                            return `'${value.toISOString()}'`;
                        }
                        return value;
                    });
                    return `(${rowValues.join(', ')})`;
                });

                sql += values.join(',\n') + ';\n\n';
            } else {
                sql += `-- No data in table ${tableName}\n\n`;
            }
        }

        return sql;
    }

    async cleanupOldBackups() {
        try {
            await this.backupFileManager.cleanup();
        } catch (error) {
            console.warn('⚠️ Failed to cleanup old backups:', error.message);
        }
    }

    // Backup File Management
    async listBackups() {
        try {
            return await this.backupFileManager.list();
        } catch (error) {
            throw new Error(`Failed to list backups: ${error.message}`);
        }
    }

    async getBackupFile(filename) {
        try {
            return await this.backupFileManager.get(filename);
        } catch (error) {
            throw new Error(`Failed to get backup file: ${error.message}`);
        }
    }

    // Clear Database Operations
    async clearDatabase() {
        try {
            // Check for concurrent operations
            if (this.operationManager.hasActiveOperation()) {
                throw new Error('Another operation is already in progress');
            }

            const operation = this.operationManager.create('clear');
            operation.start();

            // Start clear operation in background
            this.performClear(operation).catch(error => {
                operation.fail(error.message);
            });

            return operation;
        } catch (error) {
            throw new Error(`Failed to start database clear: ${error.message}`);
        }
    }

    async performClear(operation) {
        try {
            operation.updateProgress(10);

            // Get counts before clearing
            const beforeCounts = await this.database.getTableCounts?.() || {};
            operation.metadata.beforeCounts = beforeCounts;

            operation.updateProgress(25);

            // Clear data while preserving settings
            console.log('🔄 Starting database clear operation...');
            const result = await this.database.clearDatabase();

            operation.updateProgress(75);

            // Get counts after clearing
            const afterCounts = await this.database.getTableCounts?.() || {};
            operation.metadata.afterCounts = afterCounts;
            operation.metadata.recordsCleared = result.recordsCleared || 0;

            operation.updateProgress(100);
            operation.complete({
                recordsCleared: result.recordsCleared || 0,
                tablesCleared: result.tablesCleared || [],
                preservedTables: result.preservedTables || []
            });

            console.log(`✅ Database clear completed: ${result.recordsCleared || 0} records cleared`);

        } catch (error) {
            console.error('❌ Database clear failed:', error.message);
            throw error;
        }
    }

    // Operation Management
    getOperation(id) {
        const operation = this.operationManager.get(id);
        if (!operation) {
            throw new Error('Operation not found');
        }
        return operation;
    }

    getActiveOperations() {
        return this.operationManager.getActive();
    }

    hasActiveOperation() {
        return this.operationManager.hasActiveOperation();
    }

    // Admin Authentication Helper
    isAdminEnabled() {
        return process.env.ADMIN_ENABLED === 'true';
    }

    validateAdminAccess(req) {
        if (!this.isAdminEnabled()) {
            throw new Error('Admin functionality is disabled');
        }

        // Additional admin validation can be added here
        // For now, we rely on the environment variable
        return true;
    }

    // Maintenance Operations
    async performMaintenance() {
        try {
            console.log('🔄 Starting settings service maintenance...');

            // Cleanup old operations
            this.operationManager.cleanup();

            // Cleanup old backup files
            await this.cleanupOldBackups();

            console.log('✅ Settings service maintenance completed');
        } catch (error) {
            console.error('❌ Settings service maintenance failed:', error.message);
            throw error;
        }
    }
}

module.exports = SettingsService;