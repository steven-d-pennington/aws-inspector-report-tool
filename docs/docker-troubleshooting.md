# Docker Troubleshooting Guide
text
This guide helps resolve common issues when running the AWS Inspector Report Tool in Docker containers.

## Common Issues

### 1. Container Startup Failures

#### Symptoms
- Containers exit immediately after starting
- `docker compose ps` shows containers in "Exit" state
- Application not accessible on expected port

#### Diagnosis
```bash
# Check container logs
docker compose logs app
docker compose logs postgres

# Verify configuration
docker compose config

# Check for port conflicts
netstat -an | grep 3000
lsof -i :3000  # On macOS/Linux
```

#### Solutions

**Port Already in Use**
```bash
# Find process using port
netstat -an | grep 3000
# Kill the process or change PORT in .env
echo "PORT=3001" >> .env
```

**Environment Variables Missing**
```bash
# Verify .env file exists and has required variables
cat .env | grep DB_PASSWORD
# If missing, copy from template
cp .env.example .env
# Edit with required values
```

**Docker Daemon Issues**
```bash
# Restart Docker Desktop (Windows/Mac)
# Or restart Docker service (Linux)
sudo systemctl restart docker
```

### 2. Database Connection Problems

#### Symptoms
- Application starts but shows database errors
- Health check endpoints return 503
- "Connection refused" or "timeout" errors in logs

#### Diagnosis
```bash
# Check postgres container status
docker compose ps postgres

# Test network connectivity
docker compose exec app nc -zv postgres 5432

# Check database logs
docker compose logs postgres

# Verify database initialization
docker compose exec postgres psql -U appuser -d vulnerability_dashboard -c "\\dt"
```

#### Solutions

**Database Not Ready**
```bash
# Wait for database initialization (first startup can take 60+ seconds)
docker compose logs postgres | grep "database system is ready"

# If stuck, restart postgres container
docker compose restart postgres
```

**Wrong Credentials**
```bash
# Check environment variables
docker compose exec app printenv | grep DB_

# Verify .env file
cat .env | grep DB_PASSWORD

# Reset database with correct credentials
docker compose down -v
docker compose up -d
```

**Database Corruption**
```bash
# Reset database completely (WARNING: destroys data)
docker compose down -v
docker volume rm postgres_data
docker compose up -d
```

### 3. Application Not Responding

#### Symptoms
- Container running but HTTP requests timeout
- Health endpoints not accessible
- No response on port 3000

#### Diagnosis
```bash
# Check if container is running
docker compose ps app

# Check application logs
docker compose logs app --tail 50

# Test container network
docker compose exec app curl http://localhost:3000/health

# Check port mapping
docker compose ps | grep app
```

#### Solutions

**Application Crashed**
```bash
# Check for crash in logs
docker compose logs app | grep -i error

# Restart application container
docker compose restart app

# If persistent, check Node.js memory
docker stats
```

**Wrong Host Binding**
```bash
# Ensure HOST=0.0.0.0 in .env (not localhost or 127.0.0.1)
echo "HOST=0.0.0.0" >> .env
docker compose restart app
```

**Firewall/Network Issues**
```bash
# Test direct container access
docker compose exec app curl http://localhost:3000/health

# Check Docker network
docker network ls
docker network inspect aws-inspector-network
```

### 4. File Upload Issues

#### Symptoms
- File uploads fail or hang
- "No space left on device" errors
- Upload directory not accessible

#### Diagnosis
```bash
# Check disk space
df -h
docker system df

# Check upload directory permissions
docker compose exec app ls -la /app/uploads

# Check volume mounts
docker compose exec app mount | grep uploads
```

#### Solutions

**Disk Space Full**
```bash
# Clean up Docker
docker system prune -f
docker volume prune -f

# Clean up old containers
docker container prune -f
```

**Permission Issues**
```bash
# Fix upload directory permissions
docker compose exec app chown -R nodejs:nodejs /app/uploads
docker compose exec app chmod 755 /app/uploads
```

**Volume Mount Problems**
```bash
# Recreate volumes
docker compose down
docker volume rm app_uploads
docker compose up -d
```

### 5. Development Hot Reload Not Working

#### Symptoms
- Code changes not reflected in container
- Need to restart container for changes
- nodemon not detecting file changes

#### Diagnosis
```bash
# Check if development mode is active
docker compose logs app | grep nodemon

# Verify volume mounts
docker compose exec app ls -la /app/src

# Check file system events
docker compose logs app | grep "restarting due to changes"
```

#### Solutions

**Wrong Compose File**
```bash
# Ensure using development compose file
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

**Volume Mount Issues**
```bash
# On Windows, ensure file sharing is enabled in Docker Desktop
# Restart with fresh mounts
docker compose down
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

**File Watching Limits (Linux)**
```bash
# Increase inotify limits
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 6. Database Data Loss

#### Symptoms
- Database appears empty after restart
- Previous uploads/data missing
- Schema not initialized

#### Diagnosis
```bash
# Check if volumes exist
docker volume ls | grep postgres_data

# Check database contents
docker compose exec postgres psql -U appuser -d vulnerability_dashboard -c "SELECT COUNT(*) FROM vulnerabilities;"

# Check volume mount
docker compose exec postgres ls -la /var/lib/postgresql/data
```

#### Solutions

**Volume Not Persisting**
```bash
# Verify named volumes in compose file
grep -A 5 "volumes:" docker-compose.yml

# Recreate with proper volumes
docker compose down
docker compose up -d
```

**Database Not Initialized**
```bash
# Check initialization scripts
docker compose exec postgres ls -la /docker-entrypoint-initdb.d/

# Force reinitialization (destroys data)
docker compose down -v
docker compose up -d
```

### 7. Performance Issues

#### Symptoms
- Slow response times
- High memory usage
- Container crashes under load

#### Diagnosis
```bash
# Check resource usage
docker stats

# Check container limits
docker inspect aws-inspector-app | grep -i memory

# Monitor application logs
docker compose logs app | grep -i "memory\|timeout\|slow"
```

#### Solutions

**Increase Memory Limits**
```yaml
# In docker-compose.yml or docker-compose.prod.yml
deploy:
  resources:
    limits:
      memory: 2048M  # Increase from 1024M
      cpus: '2.0'    # Increase from 1.0
```

**Optimize Database Connection Pool**
```bash
# Adjust in .env
echo "DB_POOL_MAX=10" >> .env  # Reduce from 20
echo "DB_POOL_MIN=1" >> .env   # Reduce from 2
docker compose restart app
```

**Clean Up Resources**
```bash
# Clear old data
docker compose exec postgres psql -U appuser -d vulnerability_dashboard -c "DELETE FROM vulnerabilities WHERE created_at < NOW() - INTERVAL '90 days';"

# Vacuum database
docker compose exec postgres psql -U appuser -d vulnerability_dashboard -c "VACUUM ANALYZE;"
```

## Health Check Commands

### Quick Health Check
```bash
#!/bin/bash
echo "=== Docker Compose Health Check ==="

echo "1. Container Status:"
docker compose ps

echo -e "\n2. Application Health:"
curl -s http://localhost:3000/health | jq . || echo "Health endpoint not responding"

echo -e "\n3. Database Health:"
docker compose exec postgres pg_isready -U appuser -d vulnerability_dashboard

echo -e "\n4. Resource Usage:"
docker stats --no-stream

echo -e "\n5. Recent Errors:"
docker compose logs app --tail 10 | grep -i error || echo "No recent errors"
```

### Full Diagnostic
```bash
#!/bin/bash
echo "=== Full Docker Diagnostic ==="

echo "1. Docker Version:"
docker --version
docker compose version

echo -e "\n2. System Resources:"
df -h
free -h 2>/dev/null || echo "Memory info not available"

echo -e "\n3. Docker System Info:"
docker system df

echo -e "\n4. Network Configuration:"
docker network ls
docker network inspect aws-inspector-network

echo -e "\n5. Volume Information:"
docker volume ls | grep aws-inspector
docker volume inspect postgres_data app_uploads

echo -e "\n6. Container Details:"
docker compose config --services
docker compose ps --format table

echo -e "\n7. Environment Variables:"
docker compose exec app printenv | grep -E "NODE_ENV|PORT|DB_" | sort

echo -e "\n8. Log Summary:"
echo "App logs (last 20 lines):"
docker compose logs app --tail 20
echo -e "\nPostgres logs (last 10 lines):"
docker compose logs postgres --tail 10
```

## Getting Help

If you're still experiencing issues:

1. **Check the application logs** for specific error messages
2. **Search GitHub issues** for similar problems
3. **Create a new issue** with:
   - Your operating system and Docker version
   - Complete error logs
   - Your `.env` configuration (without sensitive values)
   - Output of `docker compose config`

## Emergency Recovery

### Complete Reset (Nuclear Option)
```bash
# WARNING: This destroys ALL data and containers
docker compose down -v --remove-orphans
docker system prune -a -f
docker volume prune -f

# Start fresh
cp .env.example .env
# Edit .env with your settings
docker compose up -d
```

### Backup Before Troubleshooting
```bash
# Always backup data before major changes
docker compose exec postgres pg_dump -U appuser vulnerability_dashboard > emergency_backup.sql

# Backup volumes
docker run --rm -v postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/data_backup_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .
```