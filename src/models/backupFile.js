const fs = require('fs').promises;
const path = require('path');

class BackupFile {
    constructor(filename, filePath, options = {}) {
        this.filename = filename;
        this.path = filePath;
        this.size = null;
        this.created = new Date();
        this.compressed = options.compressed || true; // always true for our implementation
        this.checksum = options.checksum || null;
        this.metadata = options.metadata || {};
    }

    async updateFileInfo() {
        try {
            const stats = await fs.stat(this.path);
            this.size = stats.size;
            this.created = stats.mtime;
            return this;
        } catch (error) {
            throw new Error(`Failed to get file info for ${this.path}: ${error.message}`);
        }
    }

    async exists() {
        try {
            await fs.access(this.path);
            return true;
        } catch {
            return false;
        }
    }

    async delete() {
        try {
            await fs.unlink(this.path);
            return true;
        } catch (error) {
            throw new Error(`Failed to delete backup file ${this.path}: ${error.message}`);
        }
    }

    getFormattedSize() {
        if (!this.size) return 'Unknown';

        const units = ['B', 'KB', 'MB', 'GB'];
        let size = this.size;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    getAge() {
        const now = new Date();
        const ageMs = now.getTime() - this.created.getTime();
        const ageMinutes = Math.floor(ageMs / (1000 * 60));
        const ageHours = Math.floor(ageMinutes / 60);
        const ageDays = Math.floor(ageHours / 24);

        if (ageDays > 0) {
            return `${ageDays} day${ageDays > 1 ? 's' : ''} ago`;
        } else if (ageHours > 0) {
            return `${ageHours} hour${ageHours > 1 ? 's' : ''} ago`;
        } else if (ageMinutes > 0) {
            return `${ageMinutes} minute${ageMinutes > 1 ? 's' : ''} ago`;
        } else {
            return 'Just now';
        }
    }

    toJSON() {
        return {
            filename: this.filename,
            path: this.path,
            size: this.size,
            formattedSize: this.getFormattedSize(),
            created: this.created,
            age: this.getAge(),
            compressed: this.compressed,
            checksum: this.checksum,
            metadata: this.metadata
        };
    }

    static generateFilename(prefix = 'backup', extension = '.sql.gz') {
        const timestamp = new Date().toISOString()
            .replace(/[:.]/g, '-')
            .replace('T', '_')
            .split('.')[0]; // Remove milliseconds
        return `${prefix}_${timestamp}${extension}`;
    }

    static validateFilename(filename) {
        // Security: only allow alphanumeric, dash, underscore, and dot
        const validPattern = /^[a-zA-Z0-9._-]+$/;
        if (!validPattern.test(filename)) {
            throw new Error('Invalid filename: contains illegal characters');
        }

        // Prevent path traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            throw new Error('Invalid filename: path traversal attempt detected');
        }

        return true;
    }

    static async fromPath(filePath) {
        const filename = path.basename(filePath);
        this.validateFilename(filename);

        const backupFile = new BackupFile(filename, filePath);
        await backupFile.updateFileInfo();
        return backupFile;
    }
}

// Backup file manager for handling multiple backup files
class BackupFileManager {
    constructor(backupDir) {
        this.backupDir = backupDir;
    }

    async list() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backupFiles = [];

            for (const filename of files) {
                try {
                    BackupFile.validateFilename(filename);
                    const filePath = path.join(this.backupDir, filename);
                    const backupFile = await BackupFile.fromPath(filePath);
                    backupFiles.push(backupFile);
                } catch (error) {
                    // Skip invalid files
                    console.warn(`Skipping invalid backup file ${filename}: ${error.message}`);
                }
            }

            // Sort by creation date (newest first)
            return backupFiles.sort((a, b) => b.created.getTime() - a.created.getTime());
        } catch (error) {
            throw new Error(`Failed to list backup files: ${error.message}`);
        }
    }

    async get(filename) {
        BackupFile.validateFilename(filename);
        const filePath = path.join(this.backupDir, filename);

        const backupFile = new BackupFile(filename, filePath);
        if (await backupFile.exists()) {
            await backupFile.updateFileInfo();
            return backupFile;
        }

        return null;
    }

    async cleanup(maxAge = 7 * 24 * 60 * 60 * 1000, maxCount = 10) { // 7 days, max 10 files
        const backupFiles = await this.list();
        const cutoffTime = Date.now() - maxAge;
        const filesToDelete = [];

        // Delete files older than maxAge
        for (const file of backupFiles) {
            if (file.created.getTime() < cutoffTime) {
                filesToDelete.push(file);
            }
        }

        // If still too many files, delete oldest ones beyond maxCount
        if (backupFiles.length - filesToDelete.length > maxCount) {
            const sortedFiles = backupFiles
                .filter(file => !filesToDelete.includes(file))
                .sort((a, b) => a.created.getTime() - b.created.getTime()); // oldest first

            const excessCount = sortedFiles.length - maxCount;
            filesToDelete.push(...sortedFiles.slice(0, excessCount));
        }

        // Delete the files
        const results = [];
        for (const file of filesToDelete) {
            try {
                await file.delete();
                results.push({ filename: file.filename, deleted: true });
            } catch (error) {
                results.push({ filename: file.filename, deleted: false, error: error.message });
            }
        }

        return results;
    }

    async getTotalSize() {
        const backupFiles = await this.list();
        return backupFiles.reduce((total, file) => total + (file.size || 0), 0);
    }

    async getCount() {
        const backupFiles = await this.list();
        return backupFiles.length;
    }
}

module.exports = {
    BackupFile,
    BackupFileManager
};