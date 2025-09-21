# Quickstart Guide: Dockerized AWS Inspector Report Tool

## Prerequisites
- Docker Desktop 4.0+ or Docker Engine 20.10+
- Docker Compose v2.0+
- 4GB RAM available for containers
- 10GB disk space for images and data

## Quick Setup (5 minutes)

### 1. Clone and Navigate
```bash
git clone <repository-url>
cd aws-inspector-report-tool
```

### 2. Environment Setup
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your settings (especially DB_PASSWORD)
# For quick start, defaults work except password
```

### 3. Start Application
```bash
# Development mode with hot-reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production mode
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 4. Verify Installation
```bash
# Check services are running
docker compose ps

# Check application health
curl http://localhost:3000/health

# View logs
docker compose logs -f app
```

### 5. Access Application
Open browser: http://localhost:3000

## Development Workflow

### Making Code Changes
1. Edit files in your IDE
2. Changes auto-reload (development mode)
3. Check logs for errors: `docker compose logs -f app`

### Running Tests
```bash
# Run test suite in container
docker compose exec app npm test

# Run specific test
docker compose exec app npm test -- --testNamePattern="health check"
```

### Database Access
```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U appuser -d vulnerability_dashboard

# Run migrations
docker compose exec app npm run migrate
```

## Common Operations

### Upload Inspector Report
1. Navigate to http://localhost:3000
2. Click "Upload Report"
3. Select JSON or CSV file
4. View processed vulnerabilities

### Export Reports
1. Go to Dashboard
2. Apply filters as needed
3. Click "Export"
4. Choose format (PDF/CSV/JSON)

### Container Management
```bash
# Stop all containers
docker compose down

# Stop and remove volumes (CAUTION: deletes data)
docker compose down -v

# Rebuild after Dockerfile changes
docker compose build --no-cache

# View resource usage
docker stats
```

## Production Deployment

### 1. Production Configuration
```bash
# Create production .env
cp .env.example .env.production

# Edit with production values
# - Set strong DB_PASSWORD
# - Set NODE_ENV=production
# - Configure SSL if needed
```

### 2. Build and Deploy
```bash
# Build production image
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start in background
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Enable auto-restart
docker update --restart=unless-stopped $(docker compose ps -q)
```

### 3. Setup Backups
```bash
# Manual backup
docker compose exec postgres pg_dump -U appuser vulnerability_dashboard > backup.sql

# Restore from backup
docker compose exec -T postgres psql -U appuser vulnerability_dashboard < backup.sql
```

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker compose logs app
docker compose logs postgres

# Verify environment variables
docker compose config

# Check port availability
netstat -an | grep 3000
```

### Database Connection Failed
```bash
# Verify postgres is running
docker compose ps postgres

# Check connectivity
docker compose exec app nc -zv postgres 5432

# Verify credentials
docker compose exec postgres psql -U appuser -d vulnerability_dashboard -c "SELECT 1"
```

### High Memory Usage
```bash
# Check current usage
docker stats

# Adjust limits in docker-compose.yml
# Under services.app.deploy.resources.limits

# Restart with new limits
docker compose restart app
```

### Application Not Responding
```bash
# Check health endpoint
curl http://localhost:3000/health

# Restart application
docker compose restart app

# Check for JavaScript errors
docker compose logs app | grep ERROR
```

## Quick Commands Reference

| Task | Command |
|------|---------|
| Start (dev) | `docker compose up` |
| Start (prod) | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` |
| Stop | `docker compose down` |
| View logs | `docker compose logs -f [service]` |
| Shell access | `docker compose exec app sh` |
| Run tests | `docker compose exec app npm test` |
| Database console | `docker compose exec postgres psql -U appuser -d vulnerability_dashboard` |
| Backup database | `docker compose exec postgres pg_dump -U appuser vulnerability_dashboard > backup.sql` |
| Clean everything | `docker compose down -v --remove-orphans` |

## Validation Tests

### Test 1: Fresh Installation
```bash
# Clean start
docker compose down -v
docker compose up -d
sleep 30
curl -f http://localhost:3000/health || echo "FAILED"
```

### Test 2: Data Persistence
```bash
# Create data
curl -X POST http://localhost:3000/api/test-data

# Restart containers
docker compose restart

# Verify data exists
curl http://localhost:3000/api/test-data || echo "FAILED"
```

### Test 3: Hot Reload (Dev)
```bash
# Start in dev mode
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Modify a file
echo "// test" >> src/app.js

# Check logs for reload
docker compose logs app | grep -i reload || echo "FAILED"
```

### Test 4: Resource Limits
```bash
# Check memory limit enforced
docker inspect aws-inspector-report-tool_app_1 | grep -i memory

# Verify CPU limits
docker inspect aws-inspector-report-tool_app_1 | grep -i cpu
```

## Next Steps
- Review [README.md](../../README.md) for detailed documentation
- Check [contracts/](./contracts/) for API specifications
- See [data-model.md](./data-model.md) for configuration details
- Explore production best practices in docker-compose.prod.yml