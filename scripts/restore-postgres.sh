#!/bin/bash

# PostgreSQL Restore Script for Docker Container
# This script restores a PostgreSQL database from backup

set -e

# Configuration
BACKUP_DIR="/backups"
DB_NAME=${PGDATABASE:-vulnerability_dashboard}
DB_USER=${PGUSER:-appuser}
DB_HOST=${PGHOST:-postgres}

# Function to show usage
usage() {
    echo "Usage: $0 [OPTIONS] <backup_file>"
    echo ""
    echo "Options:"
    echo "  -f, --force     Force restore without confirmation"
    echo "  -l, --list      List available backup files"
    echo "  -h, --help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 backup_vulnerability_dashboard_20241220_143022.sql.gz"
    echo "  $0 --list"
    echo "  $0 --force latest_vulnerability_dashboard.sql.gz"
    exit 1
}

# Function to list available backups
list_backups() {
    echo "Available backup files in $BACKUP_DIR:"
    echo ""
    if ls "$BACKUP_DIR"/backup_*.sql.gz >/dev/null 2>&1; then
        for backup in "$BACKUP_DIR"/backup_*.sql.gz; do
            if [ -f "$backup" ]; then
                BACKUP_SIZE=$(stat -c%s "$backup" 2>/dev/null || stat -f%z "$backup" 2>/dev/null || echo "unknown")
                BACKUP_DATE=$(stat -c%y "$backup" 2>/dev/null || stat -f%Sm "$backup" 2>/dev/null || echo "unknown")
                echo "  $(basename "$backup") - Size: $BACKUP_SIZE bytes - Date: $BACKUP_DATE"
            fi
        done
    else
        echo "  No backup files found"
    fi

    # Show latest symlinks
    echo ""
    echo "Latest backup symlinks:"
    for latest in "$BACKUP_DIR"/latest_*.sql.gz; do
        if [ -L "$latest" ]; then
            TARGET=$(readlink "$latest")
            echo "  $(basename "$latest") -> $TARGET"
        fi
    done
}

# Parse command line arguments
FORCE=false
BACKUP_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE=true
            shift
            ;;
        -l|--list)
            list_backups
            exit 0
            ;;
        -h|--help)
            usage
            ;;
        -*)
            echo "Unknown option $1"
            usage
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

# Check if backup file is provided
if [ -z "$BACKUP_FILE" ]; then
    echo "Error: Backup file not specified"
    echo ""
    usage
fi

# Resolve full path
if [[ "$BACKUP_FILE" = /* ]]; then
    FULL_BACKUP_PATH="$BACKUP_FILE"
else
    FULL_BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"
fi

# Check if backup file exists
if [ ! -f "$FULL_BACKUP_PATH" ]; then
    echo "Error: Backup file '$FULL_BACKUP_PATH' not found"
    echo ""
    list_backups
    exit 1
fi

echo "PostgreSQL Database Restore"
echo "=========================="
echo "Database: $DB_NAME"
echo "Host: $DB_HOST"
echo "User: $DB_USER"
echo "Backup file: $FULL_BACKUP_PATH"
echo ""

# Check if PostgreSQL is accessible
if ! pg_isready -h "$DB_HOST" -U "$DB_USER" -d postgres -q; then
    echo "Error: PostgreSQL is not accessible"
    exit 1
fi

# Warning and confirmation
if [ "$FORCE" = false ]; then
    echo "WARNING: This will completely replace the existing database!"
    echo "All current data in '$DB_NAME' will be lost!"
    echo ""
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " CONFIRM

    if [ "$CONFIRM" != "yes" ]; then
        echo "Restore cancelled"
        exit 0
    fi
fi

echo ""
echo "Starting restore process..."

# Create a temporary file for the uncompressed backup
TEMP_BACKUP="/tmp/restore_$(basename "$BACKUP_FILE" .gz)"
trap "rm -f '$TEMP_BACKUP'" EXIT

# Decompress backup if it's gzipped
if [[ "$FULL_BACKUP_PATH" == *.gz ]]; then
    echo "Decompressing backup..."
    if ! gunzip -c "$FULL_BACKUP_PATH" > "$TEMP_BACKUP"; then
        echo "Error: Failed to decompress backup file"
        exit 1
    fi
    RESTORE_FILE="$TEMP_BACKUP"
else
    RESTORE_FILE="$FULL_BACKUP_PATH"
fi

# Verify the backup file
echo "Verifying backup file..."
if ! head -n 5 "$RESTORE_FILE" | grep -q "PostgreSQL database dump" 2>/dev/null; then
    echo "Warning: Backup file doesn't appear to be a PostgreSQL dump"
    if [ "$FORCE" = false ]; then
        read -p "Continue anyway? (y/N): " CONTINUE
        if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
            echo "Restore cancelled"
            exit 1
        fi
    fi
fi

# Drop existing connections to the database
echo "Dropping existing connections..."
psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
" 2>/dev/null || true

# Restore the database
echo "Restoring database..."
if psql -h "$DB_HOST" -U "$DB_USER" -d postgres < "$RESTORE_FILE"; then
    echo "Database restore completed successfully"

    # Verify the restore
    echo "Verifying restore..."
    TABLE_COUNT=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    " | tr -d ' \n')

    echo "Restored database contains $TABLE_COUNT tables"

    # Check for critical tables
    CRITICAL_TABLES=("vulnerabilities" "reports" "settings")
    for table in "${CRITICAL_TABLES[@]}"; do
        EXISTS=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = '$table'
            );
        " | tr -d ' \n')

        if [ "$EXISTS" = "t" ]; then
            echo "✓ Table '$table' exists"
        else
            echo "⚠ Warning: Critical table '$table' not found"
        fi
    done

else
    echo "Error: Database restore failed"
    exit 1
fi

echo ""
echo "Restore completed successfully at $(date)"
echo "Database '$DB_NAME' has been restored from '$BACKUP_FILE'"