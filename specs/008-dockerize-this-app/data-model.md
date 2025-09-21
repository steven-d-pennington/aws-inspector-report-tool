# Data Model: Dockerize Application with PostgreSQL

**Date**: 2025-09-20
**Feature**: 008-dockerize-this-app

## Overview
This feature primarily involves infrastructure and deployment configuration rather than data model changes. However, the containerization impacts how the existing data model is accessed and configured.

## Configuration Entities

### 1. Container Configuration
**Entity**: DockerConfig
**Purpose**: Runtime configuration for containerized application
**Fields**:
- `NODE_ENV`: string (development | production | test)
- `PORT`: number (application port, default: 3000)
- `HOST`: string (binding host, default: 0.0.0.0)
- `LOG_LEVEL`: string (error | warn | info | debug)

**Validation**:
- NODE_ENV must be valid environment
- PORT must be between 1-65535
- HOST must be valid IP or hostname

### 2. Database Connection Configuration
**Entity**: DatabaseConfig
**Purpose**: PostgreSQL connection parameters for container environment
**Fields**:
- `DB_HOST`: string (PostgreSQL host, default: postgres)
- `DB_PORT`: number (PostgreSQL port, default: 5432)
- `DB_NAME`: string (database name, default: vulnerability_dashboard)
- `DB_USER`: string (database user, required)
- `DB_PASSWORD`: string (database password, required, sensitive)
- `DB_SSL_MODE`: string (disable | prefer | require)
- `DB_POOL_MIN`: number (minimum pool size, default: 2)
- `DB_POOL_MAX`: number (maximum pool size, default: 20)

**Validation**:
- DB_PORT must be valid port number
- DB_PASSWORD must not be empty in production
- DB_POOL_MAX must be greater than DB_POOL_MIN
- DB_SSL_MODE should be 'require' in production

**State Transitions**:
- Connecting → Connected → Ready
- Connected → Error → Reconnecting
- Reconnecting → Connected | Failed

### 3. Volume Mount Configuration
**Entity**: VolumeConfig
**Purpose**: Persistent storage mapping for container
**Fields**:
- `dataVolume`: string (postgres data volume name)
- `uploadsVolume`: string (application uploads volume name)
- `backupVolume`: string (backup storage volume name)

**Relationships**:
- PostgreSQL container → dataVolume (1:1)
- Application container → uploadsVolume (1:1)
- Backup service → backupVolume (1:1)

### 4. Health Check Configuration
**Entity**: HealthCheck
**Purpose**: Container health monitoring
**Fields**:
- `endpoint`: string (health check URL path)
- `interval`: number (check interval in seconds)
- `timeout`: number (timeout in seconds)
- `retries`: number (failure retries before unhealthy)
- `start_period`: number (initialization grace period)

**Validation**:
- interval must be greater than timeout
- retries must be positive integer
- start_period should accommodate app startup time

## Environment-Specific Configurations

### Development Environment
```yaml
environment:
  NODE_ENV: development
  PORT: 3000
  DB_SSL_MODE: disable
  LOG_LEVEL: debug
volumes:
  - ./src:/app/src  # Hot reload
  - ./public:/app/public
```

### Production Environment
```yaml
environment:
  NODE_ENV: production
  PORT: 3000
  DB_SSL_MODE: require
  LOG_LEVEL: info
volumes:
  - uploads_data:/app/uploads  # Named volume only
deploy:
  resources:
    limits:
      memory: 1024M
      cpus: '1.0'
```

## Migration Considerations

### Database Schema Migration
**Current State**: Migrations in `/migrations` directory
**Container Approach**:
- Run migrations on container startup
- Use init container pattern for production
- Maintain migration state in database

### Data Persistence
**Volumes Required**:
1. PostgreSQL data: `/var/lib/postgresql/data`
2. Application uploads: `/app/uploads`
3. Backup storage: `/backups`

**Backup Strategy**:
- Scheduled pg_dump to backup volume
- Volume snapshots for disaster recovery
- Export functionality remains unchanged

## Security Model

### Secret Management
**Sensitive Data**:
- DB_PASSWORD
- API keys (if any)
- SSL certificates

**Storage Methods**:
1. Development: .env files (gitignored)
2. Production: Docker secrets or environment injection
3. CI/CD: Secure variable storage

### Network Isolation
**Network Segments**:
- `app_network`: Internal bridge network
- Database: Not exposed externally
- Application: Only specified PORT exposed

## Compatibility Matrix

| Component | Current | Containerized |
|-----------|---------|---------------|
| Node.js | Local install | node:18-alpine |
| PostgreSQL | Local/Remote | postgres:15-alpine |
| File Storage | Local FS | Docker volumes |
| Networking | Host | Bridge network |
| Process Mgmt | PM2/systemd | Docker daemon |

## Impact on Existing Models

**No changes required to**:
- Vulnerability data model
- Report structure
- User session handling
- Export formats

**Configuration updates needed for**:
- Database connection string construction
- File path resolution for uploads
- Logging output streams
- Health check endpoints

## Validation Rules Summary

1. **Environment Variables**: All required variables must be set
2. **Port Conflicts**: Ensure no port collisions in compose
3. **Volume Permissions**: Proper ownership for mounted volumes
4. **Resource Limits**: Must not exceed host capabilities
5. **Network Security**: Internal services not exposed
6. **Health Checks**: Must pass before traffic routing