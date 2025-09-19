const { randomUUID } = require('crypto');

class DatabaseOperation {
    constructor(type) {
        this.id = randomUUID();
        this.type = type; // 'backup' | 'clear'
        this.status = 'pending'; // 'pending' | 'running' | 'completed' | 'failed'
        this.startTime = new Date();
        this.endTime = null;
        this.progress = 0; // 0-100
        this.errorMessage = null;
        this.metadata = {}; // file path for backups, counts for clear
    }

    start() {
        this.status = 'running';
        this.startTime = new Date();
        this.progress = 0;
    }

    updateProgress(progress) {
        if (progress < 0 || progress > 100) {
            throw new Error('Progress must be between 0 and 100');
        }
        this.progress = progress;
    }

    complete(metadata = {}) {
        this.status = 'completed';
        this.endTime = new Date();
        this.progress = 100;
        this.metadata = { ...this.metadata, ...metadata };
    }

    fail(errorMessage, metadata = {}) {
        this.status = 'failed';
        this.endTime = new Date();
        this.errorMessage = errorMessage;
        this.metadata = { ...this.metadata, ...metadata };
    }

    getDuration() {
        if (!this.endTime) {
            return Date.now() - this.startTime.getTime();
        }
        return this.endTime.getTime() - this.startTime.getTime();
    }

    isActive() {
        return this.status === 'pending' || this.status === 'running';
    }

    isCompleted() {
        return this.status === 'completed';
    }

    isFailed() {
        return this.status === 'failed';
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            status: this.status,
            startTime: this.startTime,
            endTime: this.endTime,
            progress: this.progress,
            errorMessage: this.errorMessage,
            metadata: this.metadata,
            duration: this.getDuration()
        };
    }

    static fromJSON(data) {
        const operation = new DatabaseOperation(data.type);
        operation.id = data.id;
        operation.status = data.status;
        operation.startTime = new Date(data.startTime);
        operation.endTime = data.endTime ? new Date(data.endTime) : null;
        operation.progress = data.progress;
        operation.errorMessage = data.errorMessage;
        operation.metadata = data.metadata || {};
        return operation;
    }

    static validateType(type) {
        const validTypes = ['backup', 'clear'];
        if (!validTypes.includes(type)) {
            throw new Error(`Invalid operation type: ${type}. Must be one of: ${validTypes.join(', ')}`);
        }
        return true;
    }

    static validateStatus(status) {
        const validStatuses = ['pending', 'running', 'completed', 'failed'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid operation status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
        }
        return true;
    }
}

// In-memory storage for active operations (runtime entity, not persisted)
class DatabaseOperationManager {
    constructor() {
        this.operations = new Map();
    }

    create(type) {
        DatabaseOperation.validateType(type);
        const operation = new DatabaseOperation(type);
        this.operations.set(operation.id, operation);
        return operation;
    }

    get(id) {
        return this.operations.get(id);
    }

    getAll() {
        return Array.from(this.operations.values());
    }

    getByType(type) {
        return this.getAll().filter(op => op.type === type);
    }

    getActive() {
        return this.getAll().filter(op => op.isActive());
    }

    hasActiveOperation(type = null) {
        const activeOps = this.getActive();
        if (type) {
            return activeOps.some(op => op.type === type);
        }
        return activeOps.length > 0;
    }

    remove(id) {
        return this.operations.delete(id);
    }

    cleanup(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
        const cutoff = Date.now() - maxAge;
        for (const [id, operation] of this.operations) {
            if (!operation.isActive() && operation.startTime.getTime() < cutoff) {
                this.operations.delete(id);
            }
        }
    }

    clear() {
        this.operations.clear();
    }
}

module.exports = {
    DatabaseOperation,
    DatabaseOperationManager
};