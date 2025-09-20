#!/bin/bash

# PostgreSQL Backup Script for Docker Container
# This script creates backups of the PostgreSQL database

set -e

# Configuration
BACKUP_DIR="/backups"
DATE=$(date +"%Y%m%d_%H%M%S")
DB_NAME=${PGDATABASE:-vulnerability_dashboard}
DB_USER=${PGUSER:-appuser}
DB_HOST=${PGHOST:-postgres}
BACKUP_FILE="$BACKUP_DIR/backup_${DB_NAME}_${DATE}.sql"
COMPRESSED_FILE="$BACKUP_FILE.gz"

# Retention settings
KEEP_DAYS=${BACKUP_RETENTION_DAYS:-30}

echo "Starting PostgreSQL backup..."
echo "Database: $DB_NAME"
echo "Host: $DB_HOST"
echo "User: $DB_USER"
echo "Backup file: $COMPRESSED_FILE"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if PostgreSQL is accessible
if ! pg_isready -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -q; then
    echo "Error: PostgreSQL is not accessible"
    exit 1
fi

# Create backup
echo "Creating database dump..."
if pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
    --verbose \
    --clean \
    --if-exists \
    --create \
    --format=plain \
    --no-password \
    > "$BACKUP_FILE"; then

    echo "Database dump created successfully"

    # Compress the backup
    echo "Compressing backup..."
    if gzip "$BACKUP_FILE"; then
        echo "Backup compressed: $COMPRESSED_FILE"

        # Verify the backup
        echo "Verifying backup..."
        if gunzip -t "$COMPRESSED_FILE"; then
            echo "Backup verification successful"

            # Calculate file size
            BACKUP_SIZE=$(stat -c%s "$COMPRESSED_FILE" 2>/dev/null || stat -f%z "$COMPRESSED_FILE" 2>/dev/null || echo "unknown")
            echo "Backup size: $BACKUP_SIZE bytes"

        else
            echo "Error: Backup verification failed"
            rm -f "$COMPRESSED_FILE"
            exit 1
        fi
    else
        echo "Error: Failed to compress backup"
        rm -f "$BACKUP_FILE"
        exit 1
    fi
else
    echo "Error: Failed to create database dump"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Clean up old backups
echo "Cleaning up old backups (keeping last $KEEP_DAYS days)..."
if command -v find >/dev/null 2>&1; then
    DELETED_COUNT=$(find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.sql.gz" -type f -mtime +$KEEP_DAYS -delete -print | wc -l)
    echo "Deleted $DELETED_COUNT old backup files"
else
    echo "Warning: 'find' command not available, skipping cleanup"
fi

# Create a 'latest' symlink
LATEST_LINK="$BACKUP_DIR/latest_${DB_NAME}.sql.gz"
rm -f "$LATEST_LINK"
ln -s "$(basename "$COMPRESSED_FILE")" "$LATEST_LINK"
echo "Created latest backup symlink: $LATEST_LINK"

# Log backup completion
echo "Backup completed successfully at $(date)"
echo "Backup file: $COMPRESSED_FILE"

# Optional: Send notification (if webhook URL is provided)
if [ -n "$BACKUP_WEBHOOK_URL" ]; then
    curl -X POST "$BACKUP_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"message\":\"PostgreSQL backup completed\",\"database\":\"$DB_NAME\",\"file\":\"$(basename "$COMPRESSED_FILE")\",\"size\":$BACKUP_SIZE}" \
        --silent --show-error || echo "Warning: Failed to send notification"
fi