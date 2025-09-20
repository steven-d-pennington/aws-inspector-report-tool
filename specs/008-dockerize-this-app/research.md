# Research & Discovery: Dockerize Application with PostgreSQL

**Date**: 2025-09-20
**Feature**: 008-dockerize-this-app

## Executive Summary
Research findings for containerizing the AWS Inspector Report Tool with Docker and PostgreSQL, addressing all NEEDS CLARIFICATION items from the specification.

## Clarification Resolutions

### 1. Hot-reload Support for Development
**Decision**: Enable hot-reload using volume mounts and nodemon
**Rationale**:
- Package.json already includes nodemon in devDependencies
- Development efficiency requires immediate feedback on code changes
- Industry standard for Node.js development containers
**Alternatives Considered**:
- Container rebuild on each change (rejected - too slow)
- File watchers with container restart (rejected - partial solution)

### 2. Database Connection Parameters
**Decision**: All connection parameters configurable via environment variables
**Rationale**:
- Follows 12-factor app methodology
- Secure credential management through Docker secrets/env files
- Flexibility across environments without code changes
**Configuration Parameters**:
- DB_HOST (default: postgres)
- DB_PORT (default: 5432)
- DB_NAME (default: vulnerability_dashboard)
- DB_USER (default: appuser)
- DB_PASSWORD (required, no default)
- DB_SSL_MODE (default: prefer for production)

### 3. Application Port Configuration
**Decision**: Port 3000 (configurable via PORT env variable)
**Rationale**:
- Standard Node.js/Express convention
- Easily remappable in docker-compose
- Consistent with typical web application deployments
**Alternatives Considered**:
- Port 8080 (common alternative, but 3000 is Node.js standard)
- Port 80 (rejected - requires root in container)

### 4. Development vs Production Configurations
**Decision**: Dual configuration with environment-specific compose files
**Rationale**:
- Clear separation of concerns
- Optimized settings per environment
- Security hardening for production
**Implementation**:
- docker-compose.yml (base configuration)
- docker-compose.dev.yml (development overrides)
- docker-compose.prod.yml (production overrides)

### 5. Image Distribution Strategy
**Decision**: Both Dockerfile for building and pre-built image support
**Rationale**:
- Dockerfile enables customization and security auditing
- Pre-built images speed up deployment
- CI/CD can publish to registry
**Documentation Coverage**:
- Build from source instructions
- Pull from registry instructions
- Multi-stage builds for optimization

### 6. Environment Variable Configuration Method
**Decision**: Multiple methods supported with clear precedence
**Rationale**:
- .env files for local development
- Docker secrets for production passwords
- Compose environment section for defaults
- Command-line overrides for flexibility
**Precedence Order**: CLI > .env > compose file > Dockerfile defaults

## Technology Research

### Docker Best Practices for Node.js
- **Multi-stage builds**: Reduce final image size (build stage + runtime stage)
- **Non-root user**: Security requirement, use node:18-alpine base
- **Layer caching**: Order Dockerfile commands for optimal caching
- **Health checks**: Built-in Express endpoint + Docker HEALTHCHECK
- **.dockerignore**: Exclude node_modules, .git, tests from context

### PostgreSQL Container Configuration
- **Version**: PostgreSQL 15 (latest stable, compatible with pg client 8.x)
- **Initialization**: Use docker-entrypoint-initdb.d for schema setup
- **Volumes**: Named volumes for data persistence (not bind mounts)
- **Backup strategy**: Document pg_dump/pg_restore procedures
- **Connection pooling**: Leverage existing pg pool in application

### Docker Compose Patterns
- **Service dependencies**: depends_on with health checks
- **Network isolation**: Custom bridge network for security
- **Volume management**: Named volumes with backup procedures
- **Environment files**: .env.example as template
- **Scaling considerations**: Document horizontal scaling limitations

### Security Considerations
- **Secret management**: Never commit .env files, use .env.example
- **Network policies**: Internal network for DB, expose only app port
- **Image scanning**: Document vulnerability scanning process
- **Update strategy**: Regular base image updates
- **Production hardening**: Read-only root filesystem where possible

## Performance Optimization

### Container Resource Limits
**Decision**: Set explicit limits based on application profiling
**Recommended Settings**:
```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 1024M
    reservations:
      cpus: '0.5'
      memory: 512M
```
**Rationale**: Prevents resource exhaustion, ensures predictable performance

### Database Connection Pooling
**Decision**: Use existing pg pool configuration
**Settings**:
- max: 20 connections
- idleTimeoutMillis: 30000
- connectionTimeoutMillis: 2000
**Rationale**: Application already implements pooling, avoid double-pooling

### Build Optimization
**Decision**: Multi-stage builds with layer caching
**Techniques**:
- Copy package*.json first, then npm install (cache dependencies)
- Use .dockerignore to reduce context size
- Alpine Linux base for minimal size
- Production npm install (--omit=dev)

## Migration Path

### Phase 1: Local Development
- Docker Compose for local development
- Volume mounts for hot-reload
- Seed data scripts

### Phase 2: Testing
- Containerized test environment
- CI/CD integration
- Automated testing in containers

### Phase 3: Production Readiness
- Production compose configuration
- Monitoring and logging setup
- Backup and restore procedures

## Resolved Uncertainties Summary

| Item | Resolution |
|------|------------|
| Hot-reload development | Volume mounts + nodemon |
| DB connection params | All configurable via env vars |
| Application port | 3000 (configurable via PORT) |
| Dev vs Prod configs | Separate compose override files |
| Image distribution | Both Dockerfile and registry |
| Environment config | Multiple methods with precedence |
| Resource limits | Explicit CPU/memory constraints |
| Data persistence | Named volumes with backups |
| Health checks | Express endpoint + HEALTHCHECK |
| Logging | Docker logs with proper levels |

## Next Steps
With all clarifications resolved, proceed to Phase 1 for detailed design of:
- Dockerfile with multi-stage build
- Docker Compose configurations
- Database initialization scripts
- Environment configuration templates
- Updated documentation structure